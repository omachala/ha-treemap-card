/**
 * Integration tests for sparkline.entity and sparkline.function.
 *
 * Covers issue #57: a tile's sparkline may plot a completely different entity
 * than the one the tile's value comes from.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createCard,
  mockEntity,
  mockHass,
  mockCallWS,
  getRenderedItems,
  getSparklines,
  flushSparklines,
} from './helpers';
import { clearHistoryCache } from '../src/utils/history';
import type { TreemapCard } from '../src';

let card: TreemapCard;

afterEach(async () => {
  card?.remove();
  // A detached card can still have a debounced fetch in flight; let it settle
  // before clearing, or it repopulates the cache during the next test.
  await new Promise(resolve => setTimeout(resolve, 200));
  clearHistoryCache();
});

beforeEach(() => {
  clearHistoryCache();
});

/** Parse a polyline "x,y x,y" attribute into points. */
function points(attr: string | null | undefined): { x: number; y: number }[] {
  if (!attr) return [];
  return attr
    .trim()
    .split(/\s+/)
    .map(pair => {
      const [x, y] = pair.split(',').map(Number);
      return { x: x ?? 0, y: y ?? 0 };
    });
}

/** SVG y grows downward, so a rising series ends higher up the box. */
function isRising(attr: string | null | undefined): boolean {
  const parsed = points(attr);
  if (parsed.length < 2) return false;
  return parsed[0]!.y > parsed.at(-1)!.y;
}

const RISING = [0, 100];
const FALLING = [100, 0];

describe('sparkline.entity', () => {
  it('plots a different entity than the one the tile value comes from', async () => {
    const ws = mockCallWS({ statistics: { 'sensor.outdoor_humidity': RISING } });
    card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: [
        {
          entity: 'sensor.living_room_temperature',
          sparkline: { entity: 'sensor.outdoor_humidity' },
        },
      ],
    });
    card.hass = mockHass(
      [
        mockEntity('sensor.living_room_temperature', '21.5'),
        mockEntity('sensor.outdoor_humidity', '62'),
      ],
      ws.callWS
    );
    await flushSparklines(card);

    // The tile still shows its own value...
    expect(getRenderedItems(card)[0]?.displayValue).toContain('21.5');
    // ...but the statistics call asked for the humidity sensor
    const statsCall = ws.calls.find(c => c['type'] === 'recorder/statistics_during_period');
    expect(statsCall?.['statistic_ids']).toEqual(['sensor.outdoor_humidity']);
    expect(isRising(getSparklines(card)[0])).toBe(true);
  });

  it('falls back to the tile entity when no source is configured', async () => {
    const ws = mockCallWS({ statistics: { 'sensor.living_room_temperature': RISING } });
    card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.living_room_temperature'],
    });
    card.hass = mockHass([mockEntity('sensor.living_room_temperature', '21.5')], ws.callWS);
    await flushSparklines(card);

    const statsCall = ws.calls.find(c => c['type'] === 'recorder/statistics_during_period');
    expect(statsCall?.['statistic_ids']).toEqual(['sensor.living_room_temperature']);
    expect(isRising(getSparklines(card)[0])).toBe(true);
  });

  it('renders the new series when the source entity is swapped at the same period', async () => {
    // Guards the length-only equality check that used to swallow the update:
    // both series have the same point count, so only the values differ.
    const ws = mockCallWS({
      statistics: { 'sensor.up': RISING, 'sensor.down': FALLING },
    });
    const entities = [
      mockEntity('sensor.tile', '1'),
      mockEntity('sensor.up', '1'),
      mockEntity('sensor.down', '1'),
    ];

    card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: [{ entity: 'sensor.tile', sparkline: { entity: 'sensor.up' } }],
    });
    card.hass = mockHass(entities, ws.callWS);
    await flushSparklines(card);
    expect(isRising(getSparklines(card)[0])).toBe(true);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: [{ entity: 'sensor.tile', sparkline: { entity: 'sensor.down' } }],
    });
    card.hass = mockHass(entities, ws.callWS);
    await flushSparklines(card);

    expect(isRising(getSparklines(card)[0])).toBe(false);
  });

  it('applies a card-level source to every tile', async () => {
    const ws = mockCallWS({ statistics: { 'sensor.grid_price': RISING } });
    card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.a', 'sensor.b'],
      sparkline: { entity: 'sensor.grid_price' },
    });
    card.hass = mockHass(
      [
        mockEntity('sensor.a', '1'),
        mockEntity('sensor.b', '2'),
        mockEntity('sensor.grid_price', '3'),
      ],
      ws.callWS
    );
    await flushSparklines(card);

    const sparklines = getSparklines(card);
    expect(sparklines).toHaveLength(2);
    expect(sparklines.every(s => isRising(s))).toBe(true);
    // Both tiles share one source, so one fetch is enough
    const statsCalls = ws.calls.filter(c => c['type'] === 'recorder/statistics_during_period');
    expect(statsCalls).toHaveLength(1);
  });

  it('lets a per-entity source beat the card-level source', async () => {
    const ws = mockCallWS({
      statistics: { 'sensor.card_default': FALLING, 'sensor.override': RISING },
    });
    card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: [{ entity: 'sensor.tile', sparkline: { entity: 'sensor.override' } }],
      sparkline: { entity: 'sensor.card_default' },
    });
    card.hass = mockHass(
      [
        mockEntity('sensor.tile', '1'),
        mockEntity('sensor.card_default', '1'),
        mockEntity('sensor.override', '1'),
      ],
      ws.callWS
    );
    await flushSparklines(card);

    expect(isRising(getSparklines(card)[0])).toBe(true);
  });

  it('applies a source override to every entity matched by a wildcard', async () => {
    const ws = mockCallWS({ statistics: { 'sensor.house_power': RISING } });
    card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: [{ entity: 'sensor.*_energy', sparkline: { entity: 'sensor.house_power' } }],
    });
    card.hass = mockHass(
      [
        mockEntity('sensor.fridge_energy', '10'),
        mockEntity('sensor.washer_energy', '20'),
        mockEntity('sensor.house_power', '300'),
      ],
      ws.callWS
    );
    await flushSparklines(card);

    const sparklines = getSparklines(card);
    expect(sparklines).toHaveLength(2);
    expect(sparklines.every(s => isRising(s))).toBe(true);
  });

  it('renders no sparkline when the source entity does not exist', async () => {
    const ws = mockCallWS({ statistics: {} });
    card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: [{ entity: 'sensor.tile', sparkline: { entity: 'sensor.nope' } }],
    });
    card.hass = mockHass([mockEntity('sensor.tile', '5')], ws.callWS);
    await flushSparklines(card);

    expect(getRenderedItems(card)).toHaveLength(1);
    expect(getSparklines(card)[0]).toBeNull();
  });
});

describe('sparkline.function', () => {
  it('defaults to mean', async () => {
    const ws = mockCallWS({ statistics: { 'sensor.a': RISING } });
    card = createCard();
    card.setConfig({ type: 'custom:treemap-card', entities: ['sensor.a'] });
    card.hass = mockHass([mockEntity('sensor.a', '1')], ws.callWS);
    await flushSparklines(card);

    const statsCall = ws.calls.find(c => c['type'] === 'recorder/statistics_during_period');
    expect(statsCall?.['types']).toEqual(['mean']);
  });

  it('applies a card-level function to every tile', async () => {
    const ws = mockCallWS({ statistics: { 'sensor.a': RISING, 'sensor.b': RISING } });
    card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.a', 'sensor.b'],
      sparkline: { function: 'change' },
    });
    card.hass = mockHass([mockEntity('sensor.a', '1'), mockEntity('sensor.b', '2')], ws.callWS);
    await flushSparklines(card);

    const statsCalls = ws.calls.filter(c => c['type'] === 'recorder/statistics_during_period');
    expect(statsCalls).toHaveLength(1);
    expect(statsCalls[0]?.['types']).toEqual(['change']);
  });

  it('lets one entity override the function without a second entity', async () => {
    const ws = mockCallWS({ statistics: { 'sensor.a': RISING, 'sensor.washer_energy': RISING } });
    card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.a', { entity: 'sensor.washer_energy', sparkline: { function: 'change' } }],
    });
    card.hass = mockHass(
      [mockEntity('sensor.a', '1'), mockEntity('sensor.washer_energy', '2')],
      ws.callWS
    );
    await flushSparklines(card);

    const statsCalls = ws.calls.filter(c => c['type'] === 'recorder/statistics_during_period');
    const types = statsCalls.map(c => c['types']);
    expect(types).toEqual(expect.arrayContaining([['mean'], ['change']]));
  });

  it('rejects an unknown function at config time', () => {
    card = createCard();

    expect(() =>
      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.a'],
        // @ts-expect-error deliberately invalid
        sparkline: { function: 'average' },
      })
    ).toThrow(/function/i);
  });

  it('rejects an unknown per-entity function at config time', () => {
    card = createCard();

    expect(() =>
      card.setConfig({
        type: 'custom:treemap-card',
        // @ts-expect-error deliberately invalid
        entities: [{ entity: 'sensor.a', sparkline: { function: 'avg' } }],
      })
    ).toThrow(/function/i);
  });
});

describe('sparkline.period overrides', () => {
  it('lets one entity use a different period', async () => {
    const ws = mockCallWS({ statistics: { 'sensor.a': RISING, 'sensor.b': RISING } });
    card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.a', { entity: 'sensor.b', sparkline: { period: '30d' } }],
    });
    card.hass = mockHass([mockEntity('sensor.a', '1'), mockEntity('sensor.b', '2')], ws.callWS);
    await flushSparklines(card);

    const statsCalls = ws.calls.filter(c => c['type'] === 'recorder/statistics_during_period');
    const periods = statsCalls.map(c => c['period']);
    expect(periods).toEqual(expect.arrayContaining(['hour', 'day']));
  });
});

describe('sparkline.show', () => {
  it('issues no history request at all when sparklines are disabled', async () => {
    const ws = mockCallWS({ statistics: { 'sensor.a': RISING } });
    card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.a'],
      sparkline: { show: false },
    });
    card.hass = mockHass([mockEntity('sensor.a', '1')], ws.callWS);
    await flushSparklines(card);

    expect(ws.calls).toHaveLength(0);
    expect(getSparklines(card)[0]).toBeNull();
  });

  it('skips fetching for a single entity that opts out', async () => {
    const ws = mockCallWS({ statistics: { 'sensor.a': RISING, 'sensor.b': RISING } });
    card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.a', { entity: 'sensor.b', sparkline: { show: false } }],
    });
    card.hass = mockHass([mockEntity('sensor.a', '1'), mockEntity('sensor.b', '2')], ws.callWS);
    await flushSparklines(card);

    const statsCall = ws.calls.find(c => c['type'] === 'recorder/statistics_during_period');
    expect(statsCall?.['statistic_ids']).toEqual(['sensor.a']);
  });
});

describe('JSON mode', () => {
  it('keeps using inline sparkline data rather than fetching history', async () => {
    const ws = mockCallWS({ statistics: {} });
    card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entity: 'sensor.json_data',
      sparkline: { attribute: 'trend' },
    });
    card.hass = mockHass(
      [
        mockEntity('sensor.json_data', 'ok', {
          items: [{ label: 'Alpha', value: 10, trend: RISING }],
        }),
      ],
      ws.callWS
    );
    await flushSparklines(card);

    expect(isRising(getSparklines(card)[0])).toBe(true);
  });
});
