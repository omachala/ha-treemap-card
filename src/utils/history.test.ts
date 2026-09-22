import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearHistoryCache, getHistoryData, type SparklineSpec } from './history';
import type { HomeAssistant } from '../types';

type WsMessage = Record<string, unknown>;

interface MockHass {
  hass: HomeAssistant;
  calls: WsMessage[];
  statsCalls: WsMessage[];
}

/**
 * Build a hass whose callWS answers statistics and history commands from fixtures.
 * `statistics` values are emitted under whichever field `types` asked for.
 */
function mockHass(
  options: {
    statistics?: Record<string, number[]>;
    history?: Record<string, unknown[]>;
    fail?: boolean;
  } = {}
): MockHass {
  const calls: WsMessage[] = [];

  const callWS = async <T>(message: WsMessage): Promise<T> => {
    calls.push(message);
    if (options.fail) throw new Error('websocket exploded');

    if (message['type'] === 'recorder/statistics_during_period') {
      const ids = (message['statistic_ids'] as string[]) ?? [];
      const field = ((message['types'] as string[]) ?? ['mean'])[0] ?? 'mean';
      const result: Record<string, Record<string, number | null>[]> = {};
      for (const id of ids) {
        const series = options.statistics?.[id];
        if (series) {
          result[id] = series.map((value, index) => ({
            start: index,
            end: index + 1,
            [field]: value,
          }));
        }
      }
      return result as T;
    }

    if (message['type'] === 'history/history_during_period') {
      const ids = (message['entity_ids'] as string[]) ?? [];
      const result: Record<string, unknown[]> = {};
      for (const id of ids) {
        const states = options.history?.[id];
        if (states) result[id] = states;
      }
      return result as T;
    }

    return {} as T;
  };

  const hass = {
    states: {},
    entities: {},
    callService: async () => {},
    callWS,
  } as unknown as HomeAssistant;

  return {
    hass,
    calls,
    get statsCalls() {
      return calls.filter(c => c['type'] === 'recorder/statistics_during_period');
    },
  };
}

function spec(
  entityId: string,
  statistic: SparklineSpec['statistic'] = 'mean',
  period: SparklineSpec['period'] = '24h'
): SparklineSpec {
  return { entityId, period, statistic };
}

beforeEach(() => {
  clearHistoryCache();
});

describe('getHistoryData', () => {
  describe('request shape', () => {
    it('asks for the source entity, period and requested statistic', async () => {
      const m = mockHass({ statistics: { 'sensor.power': [1, 2, 3] } });

      await getHistoryData(m.hass, new Map([['sensor.energy', spec('sensor.power', 'change')]]));

      expect(m.statsCalls).toHaveLength(1);
      const call = m.statsCalls[0]!;
      expect(call['statistic_ids']).toEqual(['sensor.power']);
      expect(call['types']).toEqual(['change']);
      expect(call['period']).toBe('hour');
      expect(typeof call['start_time']).toBe('string');
    });

    it('maps each sparkline period onto the right statistics resolution', async () => {
      const cases: [SparklineSpec['period'], string][] = [
        ['12h', '5minute'],
        ['24h', 'hour'],
        ['7d', 'hour'],
        ['30d', 'day'],
      ];

      for (const [period, expected] of cases) {
        clearHistoryCache();
        const m = mockHass({ statistics: { 'sensor.a': [1, 2] } });
        await getHistoryData(m.hass, new Map([['sensor.a', spec('sensor.a', 'mean', period)]]));
        expect(m.statsCalls[0]!['period']).toBe(expected);
      }
    });

    it('issues no websocket call for an empty spec map', async () => {
      const m = mockHass();

      const result = await getHistoryData(m.hass, new Map());

      expect(m.calls).toHaveLength(0);
      expect(result.size).toBe(0);
    });
  });

  describe('keying', () => {
    it('keys the result by the tile entity, not the source entity', async () => {
      const m = mockHass({ statistics: { 'sensor.outdoor_humidity': [40, 45, 50] } });

      const result = await getHistoryData(
        m.hass,
        new Map([['sensor.living_room_temperature', spec('sensor.outdoor_humidity')]])
      );

      expect([...result.keys()]).toEqual(['sensor.living_room_temperature']);
      expect(result.get('sensor.living_room_temperature')?.temperature).toEqual([40, 45, 50]);
      expect(result.has('sensor.outdoor_humidity')).toBe(false);
    });

    it('serves two tiles pointed at the same source from one fetch', async () => {
      const m = mockHass({ statistics: { 'sensor.shared': [1, 2] } });

      const result = await getHistoryData(
        m.hass,
        new Map([
          ['sensor.a', spec('sensor.shared')],
          ['sensor.b', spec('sensor.shared')],
        ])
      );

      expect(m.statsCalls).toHaveLength(1);
      expect(result.get('sensor.a')?.temperature).toEqual([1, 2]);
      expect(result.get('sensor.b')?.temperature).toEqual([1, 2]);
    });
  });

  describe('batching', () => {
    it('batches specs that share a period and statistic into one call', async () => {
      const m = mockHass({ statistics: { 'sensor.a': [1], 'sensor.b': [2] } });

      await getHistoryData(
        m.hass,
        new Map([
          ['sensor.a', spec('sensor.a', 'mean', '24h')],
          ['sensor.b', spec('sensor.b', 'mean', '24h')],
        ])
      );

      expect(m.statsCalls).toHaveLength(1);
      expect(m.statsCalls[0]!['statistic_ids']).toEqual(
        expect.arrayContaining(['sensor.a', 'sensor.b'])
      );
    });

    it('splits calls when the period differs', async () => {
      const m = mockHass({ statistics: { 'sensor.a': [1], 'sensor.b': [2] } });

      await getHistoryData(
        m.hass,
        new Map([
          ['sensor.a', spec('sensor.a', 'mean', '24h')],
          ['sensor.b', spec('sensor.b', 'mean', '7d')],
        ])
      );

      expect(m.statsCalls).toHaveLength(2);
    });

    it('splits calls when the statistic differs', async () => {
      const m = mockHass({ statistics: { 'sensor.a': [1], 'sensor.b': [2] } });

      await getHistoryData(
        m.hass,
        new Map([
          ['sensor.a', spec('sensor.a', 'mean')],
          ['sensor.b', spec('sensor.b', 'change')],
        ])
      );

      expect(m.statsCalls).toHaveLength(2);
      const types = m.statsCalls.map(c => c['types']);
      expect(types).toEqual(expect.arrayContaining([['mean'], ['change']]));
    });
  });

  describe('statistic selection', () => {
    it('reads the field it asked for', async () => {
      for (const statistic of ['mean', 'min', 'max', 'sum', 'state', 'change'] as const) {
        clearHistoryCache();
        const m = mockHass({ statistics: { 'sensor.a': [7, 8] } });

        const result = await getHistoryData(
          m.hass,
          new Map([['sensor.a', spec('sensor.a', statistic)]])
        );

        expect(m.statsCalls[0]!['types']).toEqual([statistic]);
        expect(result.get('sensor.a')?.temperature).toEqual([7, 8]);
      }
    });

    it('yields an empty series when the requested field is absent, without falling back to mean', async () => {
      const calls: WsMessage[] = [];
      const hass = {
        states: {},
        entities: {},
        callService: async () => {},
        // Row carries mean but not change - a fallback would plot the wrong series
        callWS: async <T>(message: WsMessage): Promise<T> => {
          calls.push(message);
          return { 'sensor.a': [{ start: 0, end: 1, mean: 99 }] } as T;
        },
      } as unknown as HomeAssistant;

      const result = await getHistoryData(
        hass,
        new Map([['sensor.a', spec('sensor.a', 'change')]])
      );

      expect(result.get('sensor.a')?.temperature).toEqual([]);
    });

    it('filters null and undefined points out of the series', async () => {
      const hass = {
        states: {},
        entities: {},
        callService: async () => {},
        callWS: async <T>(): Promise<T> =>
          ({
            'sensor.a': [
              { start: 0, end: 1, mean: 1 },
              { start: 1, end: 2, mean: null },
              { start: 2, end: 3 },
              { start: 3, end: 4, mean: 4 },
            ],
          }) as T,
      } as unknown as HomeAssistant;

      const result = await getHistoryData(hass, new Map([['sensor.a', spec('sensor.a')]]));

      expect(result.get('sensor.a')?.temperature).toEqual([1, 4]);
    });
  });

  describe('caching', () => {
    it('serves a repeat request from cache without refetching', async () => {
      const m = mockHass({ statistics: { 'sensor.a': [1, 2] } });
      const specs = new Map([['sensor.a', spec('sensor.a')]]);

      await getHistoryData(m.hass, specs);
      const second = await getHistoryData(m.hass, specs);

      expect(m.statsCalls).toHaveLength(1);
      expect(second.get('sensor.a')?.temperature).toEqual([1, 2]);
    });

    it('treats a different statistic on the same entity as a separate cache entry', async () => {
      const m = mockHass({ statistics: { 'sensor.a': [1, 2] } });

      await getHistoryData(m.hass, new Map([['sensor.a', spec('sensor.a', 'mean')]]));
      await getHistoryData(m.hass, new Map([['sensor.a', spec('sensor.a', 'change')]]));

      expect(m.statsCalls).toHaveLength(2);
    });

    it('treats a different period on the same entity as a separate cache entry', async () => {
      const m = mockHass({ statistics: { 'sensor.a': [1, 2] } });

      await getHistoryData(m.hass, new Map([['sensor.a', spec('sensor.a', 'mean', '24h')]]));
      await getHistoryData(m.hass, new Map([['sensor.a', spec('sensor.a', 'mean', '7d')]]));

      expect(m.statsCalls).toHaveLength(2);
    });

    it('refetches once the entry has gone stale', async () => {
      vi.useFakeTimers();
      try {
        const m = mockHass({ statistics: { 'sensor.a': [1, 2] } });
        const specs = new Map([['sensor.a', spec('sensor.a')]]);

        await getHistoryData(m.hass, specs);
        vi.advanceTimersByTime(6 * 60 * 1000);
        await getHistoryData(m.hass, specs);

        expect(m.statsCalls).toHaveLength(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('is cleared by clearHistoryCache', async () => {
      const m = mockHass({ statistics: { 'sensor.a': [1, 2] } });
      const specs = new Map([['sensor.a', spec('sensor.a')]]);

      await getHistoryData(m.hass, specs);
      clearHistoryCache();
      await getHistoryData(m.hass, specs);

      expect(m.statsCalls).toHaveLength(2);
    });
  });

  describe('failure handling', () => {
    it('resolves with an empty series when the websocket call throws', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const m = mockHass({ fail: true });

        const result = await getHistoryData(m.hass, new Map([['sensor.a', spec('sensor.a')]]));

        expect(result.get('sensor.a')?.temperature).toEqual([]);
      } finally {
        warn.mockRestore();
      }
    });

    it('yields an empty series for an entity the backend returned nothing for', async () => {
      const m = mockHass({ statistics: {} });

      const result = await getHistoryData(
        m.hass,
        new Map([['sensor.missing', spec('sensor.missing')]])
      );

      expect(result.get('sensor.missing')?.temperature).toEqual([]);
    });
  });

  describe('climate entities', () => {
    const climateHistory = (temps: number[], action: string): Record<string, unknown[]> => ({
      'climate.lounge': temps.map((temp, index) => ({
        last_updated: new Date(Date.now() - (temps.length - index) * 60_000).toISOString(),
        state: 'heat',
        attributes: { current_temperature: temp, hvac_action: action },
      })),
    });

    it('falls back to current_temperature from history when a climate entity has no statistics', async () => {
      const m = mockHass({ statistics: {}, history: climateHistory([20, 21, 22], 'heating') });

      const result = await getHistoryData(
        m.hass,
        new Map([['climate.lounge', spec('climate.lounge')]])
      );

      expect(result.get('climate.lounge')?.temperature).toEqual([20, 21, 22]);
    });

    it('prefers statistics over the attribute fallback when both exist', async () => {
      const m = mockHass({
        statistics: { 'climate.lounge': [30, 31] },
        history: climateHistory([20, 21, 22], 'heating'),
      });

      const result = await getHistoryData(
        m.hass,
        new Map([['climate.lounge', spec('climate.lounge')]])
      );

      expect(result.get('climate.lounge')?.temperature).toEqual([30, 31]);
    });

    it('returns hvac action segments for a climate tile', async () => {
      const m = mockHass({ statistics: {}, history: climateHistory([20, 21], 'heating') });

      const result = await getHistoryData(
        m.hass,
        new Map([['climate.lounge', spec('climate.lounge')]])
      );

      const segments = result.get('climate.lounge')?.hvacActions ?? [];
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0]?.action).toBe('heating');
    });

    it('keeps hvac bars from the climate tile while plotting an overridden source', async () => {
      const m = mockHass({
        statistics: { 'sensor.outdoor_humidity': [40, 45, 50] },
        history: climateHistory([20, 21], 'heating'),
      });

      const result = await getHistoryData(
        m.hass,
        new Map([['climate.lounge', spec('sensor.outdoor_humidity')]])
      );

      const data = result.get('climate.lounge');
      // Line comes from the source entity...
      expect(data?.temperature).toEqual([40, 45, 50]);
      // ...while the bars still describe the tile's own thermostat
      expect(data?.hvacActions?.[0]?.action).toBe('heating');
    });

    it('does not fetch climate history for a non-climate tile', async () => {
      const m = mockHass({ statistics: { 'sensor.a': [1, 2] } });

      await getHistoryData(m.hass, new Map([['sensor.a', spec('sensor.a')]]));

      expect(m.calls.some(c => c['type'] === 'history/history_during_period')).toBe(false);
    });
  });
});
