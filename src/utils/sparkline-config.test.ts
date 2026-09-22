import { describe, it, expect } from 'vitest';
import {
  SPARKLINE_FUNCTIONS,
  isStatisticFunction,
  resolveSparklineConfig,
  resolveSparklineSource,
} from './sparkline-config';

describe('resolveSparklineConfig', () => {
  describe('defaults', () => {
    it('returns documented defaults when nothing is configured', () => {
      const cfg = resolveSparklineConfig();

      expect(cfg.show).toBe(true);
      expect(cfg.period).toBe('24h');
      expect(cfg.function).toBe('mean');
      expect(cfg.mode).toBe('dark');
      expect(cfg.entity).toBeUndefined();
    });

    it('keeps an explicit show:false from card level', () => {
      expect(resolveSparklineConfig({ show: false }).show).toBe(false);
    });

    it('lets an entity re-enable a card-level show:false', () => {
      expect(resolveSparklineConfig({ show: false }, { show: true }).show).toBe(true);
    });
  });

  describe('card level', () => {
    it('applies card-level values when the entity has no override', () => {
      const cfg = resolveSparklineConfig({ period: '7d', function: 'change', mode: 'light' });

      expect(cfg.period).toBe('7d');
      expect(cfg.function).toBe('change');
      expect(cfg.mode).toBe('light');
    });

    it('allows a card-level source entity shared by every tile', () => {
      expect(resolveSparklineConfig({ entity: 'sensor.grid_price' }).entity).toBe(
        'sensor.grid_price'
      );
    });
  });

  describe('entity level overrides', () => {
    it('lets the entity override the card key by key', () => {
      const cfg = resolveSparklineConfig(
        { period: '24h', function: 'mean', mode: 'dark' },
        { function: 'change' }
      );

      expect(cfg.function).toBe('change');
      // untouched keys still come from the card
      expect(cfg.period).toBe('24h');
      expect(cfg.mode).toBe('dark');
    });

    it('fills gaps the entity omits from the card config', () => {
      const cfg = resolveSparklineConfig(
        { period: '30d', min: 0, max: 100 },
        { entity: 'sensor.outdoor_humidity' }
      );

      expect(cfg.entity).toBe('sensor.outdoor_humidity');
      expect(cfg.period).toBe('30d');
      expect(cfg.min).toBe(0);
      expect(cfg.max).toBe(100);
    });

    it('lets the entity override the card-level source entity', () => {
      const cfg = resolveSparklineConfig(
        { entity: 'sensor.grid_price' },
        { entity: 'sensor.outdoor_humidity' }
      );

      expect(cfg.entity).toBe('sensor.outdoor_humidity');
    });

    it('overrides axis bounds per entity', () => {
      const cfg = resolveSparklineConfig({ min: 0, max: 100 }, { min: 10, max: 30 });

      expect(cfg.min).toBe(10);
      expect(cfg.max).toBe(30);
    });
  });

  describe('nested blocks merge one level deep', () => {
    it('keeps card-level line keys the entity did not mention', () => {
      const cfg = resolveSparklineConfig(
        { line: { show: false, style: 'stroke: red' } },
        { line: { style: 'stroke: blue' } }
      );

      expect(cfg.line).toEqual({ show: false, style: 'stroke: blue' });
    });

    it('merges fill the same way', () => {
      const cfg = resolveSparklineConfig(
        { fill: { show: true, style: 'fill: red' } },
        { fill: { show: false } }
      );

      expect(cfg.fill).toEqual({ show: false, style: 'fill: red' });
    });

    it('merges hvac the same way', () => {
      const cfg = resolveSparklineConfig({ hvac: { show: true } }, { hvac: { show: false } });

      expect(cfg.hvac).toEqual({ show: false });
    });

    it('passes a card-level nested block through untouched', () => {
      const cfg = resolveSparklineConfig({ line: { show: false } });

      expect(cfg.line).toEqual({ show: false });
    });

    it('uses the entity nested block when the card has none', () => {
      const cfg = resolveSparklineConfig(undefined, { fill: { show: false } });

      expect(cfg.fill).toEqual({ show: false });
    });

    it('leaves nested blocks undefined when neither side sets them', () => {
      const cfg = resolveSparklineConfig();

      expect(cfg.line).toBeUndefined();
      expect(cfg.fill).toBeUndefined();
      expect(cfg.hvac).toBeUndefined();
    });
  });

  describe('immutability', () => {
    it('does not mutate the card config it was given', () => {
      const card = { period: '24h' as const, line: { show: true } };
      resolveSparklineConfig(card, { period: '7d', line: { show: false } });

      expect(card.period).toBe('24h');
      expect(card.line).toEqual({ show: true });
    });
  });

  describe('explicit undefined', () => {
    it('treats an undefined entity key as "not set" rather than a reset', () => {
      const cfg = resolveSparklineConfig({ function: 'change' }, { function: undefined });

      expect(cfg.function).toBe('change');
    });
  });
});

describe('resolveSparklineSource', () => {
  it('falls back to the tile entity when no source is configured', () => {
    const cfg = resolveSparklineConfig();

    expect(resolveSparklineSource(cfg, 'sensor.living_room')).toBe('sensor.living_room');
  });

  it('uses the configured source entity when set', () => {
    const cfg = resolveSparklineConfig(undefined, { entity: 'sensor.outdoor_humidity' });

    expect(resolveSparklineSource(cfg, 'sensor.living_room')).toBe('sensor.outdoor_humidity');
  });
});

describe('isStatisticFunction', () => {
  it('accepts every documented function', () => {
    expect(SPARKLINE_FUNCTIONS).toEqual(['mean', 'min', 'max', 'sum', 'state', 'change']);
    for (const fn of SPARKLINE_FUNCTIONS) {
      expect(isStatisticFunction(fn)).toBe(true);
    }
  });

  it('rejects last_reset, which is a timestamp rather than a series', () => {
    expect(isStatisticFunction('last_reset')).toBe(false);
  });

  it('rejects unknown values and non-strings', () => {
    expect(isStatisticFunction('average')).toBe(false);
    expect(isStatisticFunction('')).toBe(false);
    expect(isStatisticFunction(undefined)).toBe(false);
    expect(isStatisticFunction(42)).toBe(false);
  });
});
