import { describe, expect, it } from 'vitest';
import { formatNumber, resolvePrecision } from './format';

describe('formatNumber', () => {
  describe('precision', () => {
    it('formats whole number with precision 0', () => {
      expect(formatNumber(1234.567, 0)).toBe('1235');
      expect(formatNumber(42.4, 0)).toBe('42');
      expect(formatNumber(42.5, 0)).toBe('43');
    });

    it('formats 1 decimal place with precision 1', () => {
      expect(formatNumber(1234.567, 1)).toBe('1234.6');
      expect(formatNumber(42, 1)).toBe('42.0');
      expect(formatNumber(3.14159, 1)).toBe('3.1');
    });

    it('formats 2 decimal places with precision 2', () => {
      expect(formatNumber(1234.567, 2)).toBe('1234.57');
      expect(formatNumber(42, 2)).toBe('42.00');
      expect(formatNumber(3.14159, 2)).toBe('3.14');
    });

    it('formats 3 decimal places with precision 3', () => {
      expect(formatNumber(3.14159, 3)).toBe('3.142');
      expect(formatNumber(1, 3)).toBe('1.000');
    });

    it('defaults to precision 1', () => {
      expect(formatNumber(42)).toBe('42.0');
      expect(formatNumber(3.14159)).toBe('3.1');
    });
  });

  describe('abbreviations', () => {
    it('formats thousands with "k"', () => {
      expect(formatNumber(1000, 0, true)).toBe('1k');
      expect(formatNumber(1500, 0, true)).toBe('2k');
      expect(formatNumber(2345, 1, true)).toBe('2.3k');
      expect(formatNumber(2345, 2, true)).toBe('2.35k');
    });

    it('formats millions with "M"', () => {
      expect(formatNumber(1000000, 0, true)).toBe('1M');
      expect(formatNumber(1234567, 1, true)).toBe('1.2M');
      expect(formatNumber(1234567, 2, true)).toBe('1.23M');
    });

    it('formats billions with "B"', () => {
      expect(formatNumber(1000000000, 0, true)).toBe('1B');
      expect(formatNumber(1234567890, 1, true)).toBe('1.2B');
      expect(formatNumber(1234567890, 2, true)).toBe('1.23B');
    });

    it('formats trillions with "T"', () => {
      expect(formatNumber(1000000000000, 0, true)).toBe('1T');
      expect(formatNumber(1234567890123, 1, true)).toBe('1.2T');
    });

    it('does not abbreviate small numbers', () => {
      expect(formatNumber(999, 0, true)).toBe('999');
      expect(formatNumber(500, 1, true)).toBe('500.0');
      expect(formatNumber(42, 2, true)).toBe('42.00');
    });
  });

  describe('negative numbers', () => {
    it('handles negative values', () => {
      expect(formatNumber(-1234.5, 1)).toBe('-1234.5');
      expect(formatNumber(-2345, 1, true)).toBe('-2.3k');
      expect(formatNumber(-1000000, 0, true)).toBe('-1M');
    });
  });

  describe('edge cases', () => {
    it('handles zero', () => {
      expect(formatNumber(0, 0)).toBe('0');
      expect(formatNumber(0, 1)).toBe('0.0');
      expect(formatNumber(0, 0, true)).toBe('0');
    });

    it('handles very small numbers', () => {
      expect(formatNumber(0.001, 2)).toBe('0.00');
      expect(formatNumber(0.005, 2)).toBe('0.01');
      expect(formatNumber(0.123, 1)).toBe('0.1');
    });
  });
});

describe('resolvePrecision', () => {
  it('uses config precision when provided', () => {
    expect(resolvePrecision(2, undefined)).toBe(2);
    expect(resolvePrecision(0, 3)).toBe(0); // config wins over entity
  });

  it('uses entity precision when no config precision', () => {
    expect(resolvePrecision(undefined, 0)).toBe(0);
    expect(resolvePrecision(undefined, 2)).toBe(2);
  });

  it('defaults to 1 when neither provided', () => {
    expect(resolvePrecision(undefined, undefined)).toBe(1);
  });
});
