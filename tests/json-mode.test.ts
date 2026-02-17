/**
 * Integration tests for JSON entity mode
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createCard, mockEntity, mockHass, getRenderedItems } from './helpers';
import type { TreemapCard } from '../src/treemap-card';

describe('JSON Entity Mode', () => {
  let card: TreemapCard;

  beforeEach(() => {
    card = createCard();
  });

  it('renders from JSON attribute with different size/value params', async () => {
    const holdings = [
      { ticker: 'AAPL', todayPct: -2.5, value: 5000 },
      { ticker: 'MSFT', todayPct: 1.2, value: 3000 },
      { ticker: 'NVDA', todayPct: -5.7, value: 700 },
    ];

    const hass = mockHass([
      mockEntity('sensor.portfolio', '3', { holdings, friendly_name: 'Portfolio' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entity: 'sensor.portfolio',
      data_attribute: 'holdings',
      label: { param: 'ticker' },
      value: { param: 'todayPct', suffix: ' %' },
      size: { param: 'value' },
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(3);

    expect(items.find(i => i.label === 'AAPL')?.value).toBeCloseTo(-2.5, 1);
    expect(items.find(i => i.label === 'MSFT')?.value).toBeCloseTo(1.2, 1);
    expect(items.find(i => i.label === 'NVDA')?.value).toBeCloseTo(-5.7, 1);
  });

  it('renders with order asc', async () => {
    const holdings = [
      { ticker: 'AAPL', todayPct: -2.5, value: 5000 },
      { ticker: 'MSFT', todayPct: 1.2, value: 3000 },
      { ticker: 'NVDA', todayPct: -5.7, value: 700 },
      { ticker: 'GOOG', todayPct: 0.5, value: 2000 },
    ];

    const hass = mockHass([
      mockEntity('sensor.portfolio', '4', { holdings, friendly_name: 'Portfolio' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entity: 'sensor.portfolio',
      data_attribute: 'holdings',
      label: { param: 'ticker' },
      value: { param: 'todayPct' },
      size: { param: 'value' },
      order: 'asc',
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(4);

    expect(items.find(i => i.label === 'AAPL')?.value).toBeCloseTo(-2.5, 1);
    expect(items.find(i => i.label === 'MSFT')?.value).toBeCloseTo(1.2, 1);
    expect(items.find(i => i.label === 'NVDA')?.value).toBeCloseTo(-5.7, 1);
    expect(items.find(i => i.label === 'GOOG')?.value).toBeCloseTo(0.5, 1);
  });

  it('sizes rectangles by size.param, not value.param', async () => {
    // Regression: when sortValue (todayPct) differs from sizeValue (portfolio value),
    // squarify was sorting by sortValue and producing bad single-row layouts.
    // MU(£8155) must be largest rectangle regardless of todayPct=-2.9 (worst performer).
    const holdings = [
      { ticker: 'VRT', todayPct: 3.8, value: 1467 },
      { ticker: 'MU', todayPct: -2.9, value: 8155 },
      { ticker: 'TEL', todayPct: -0.1, value: 1062 },
      { ticker: 'NVDA', todayPct: 1.2, value: 933 },
      { ticker: 'AVGO', todayPct: 2.3, value: 1644 },
      { ticker: 'GOOGL', todayPct: -1.2, value: 2408 },
    ];

    const hass = mockHass([
      mockEntity('sensor.portfolio', '6', { holdings, friendly_name: 'Portfolio' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entity: 'sensor.portfolio',
      data_attribute: 'holdings',
      label: { param: 'ticker' },
      value: { param: 'todayPct' },
      size: { param: 'value' },
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    const mu = items.find(i => i.label === 'MU');
    const googl = items.find(i => i.label === 'GOOGL');
    const nvda = items.find(i => i.label === 'NVDA');

    expect(mu).toBeDefined();
    expect(googl).toBeDefined();
    expect(nvda).toBeDefined();

    const muArea = mu!.width * mu!.height;
    const googlArea = googl!.width * googl!.height;
    const nvdaArea = nvda!.width * nvda!.height;

    // MU (£8155) > GOOGL (£2408) > NVDA (£933) regardless of todayPct
    expect(muArea).toBeGreaterThan(googlArea);
    expect(googlArea).toBeGreaterThan(nvdaArea);

    // Squarify must produce multiple rows (not collapse to a single row).
    // Single-row collapse was the visible symptom of sorting by sortValue instead of area.
    const uniqueRows = new Set(items.map(i => Math.round(i.y)));
    expect(uniqueRows.size).toBeGreaterThan(1);
  });

  it('respects limit with order asc', async () => {
    const holdings = [
      { ticker: 'AAPL', todayPct: -2.5, value: 5000 },
      { ticker: 'MSFT', todayPct: 1.2, value: 3000 },
      { ticker: 'NVDA', todayPct: -5.7, value: 700 },
      { ticker: 'GOOG', todayPct: 0.5, value: 2000 },
    ];

    const hass = mockHass([
      mockEntity('sensor.portfolio', '4', { holdings, friendly_name: 'Portfolio' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entity: 'sensor.portfolio',
      data_attribute: 'holdings',
      label: { param: 'ticker' },
      value: { param: 'todayPct' },
      size: { param: 'value' },
      order: 'asc',
      limit: 2,
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(2);

    expect(items.find(i => i.label === 'AAPL')).toBeUndefined();
    expect(items.find(i => i.label === 'MSFT')).toBeUndefined();
    expect(items.find(i => i.label === 'NVDA')?.value).toBeCloseTo(-5.7, 1);
    expect(items.find(i => i.label === 'GOOG')?.value).toBeCloseTo(0.5, 1);
  });
});
