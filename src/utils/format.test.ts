import { describe, expect, it } from 'vitest';
import { formatNumber } from './format';

describe('formatNumber', () => {
  describe('decimal places', () => {
    it('formats whole number with "0"', () => {
      expect(formatNumber(1234.567, '0')).toBe('1235');
      expect(formatNumber(42.4, '0')).toBe('42');
      expect(formatNumber(42.5, '0')).toBe('43');
    });

    it('formats 1 decimal place with "0.0"', () => {
      expect(formatNumber(1234.567, '0.0')).toBe('1234.6');
      expect(formatNumber(42, '0.0')).toBe('42.0');
      expect(formatNumber(3.14159, '0.0')).toBe('3.1');
    });

    it('formats 2 decimal places with "0.00"', () => {
      expect(formatNumber(1234.567, '0.00')).toBe('1234.57');
      expect(formatNumber(42, '0.00')).toBe('42.00');
      expect(formatNumber(3.14159, '0.00')).toBe('3.14');
    });

    it('formats 3 decimal places with "0.000"', () => {
      expect(formatNumber(3.14159, '0.000')).toBe('3.142');
      expect(formatNumber(1, '0.000')).toBe('1.000');
    });
  });

  describe('abbreviations', () => {
    it('formats thousands with "k"', () => {
      expect(formatNumber(1000, '0a')).toBe('1k');
      expect(formatNumber(1500, '0a')).toBe('2k');
      expect(formatNumber(2345, '0.0a')).toBe('2.3k');
      expect(formatNumber(2345, '0.00a')).toBe('2.35k');
    });

    it('formats millions with "M"', () => {
      expect(formatNumber(1000000, '0a')).toBe('1M');
      expect(formatNumber(1234567, '0.0a')).toBe('1.2M');
      expect(formatNumber(1234567, '0.00a')).toBe('1.23M');
    });

    it('formats billions with "B"', () => {
      expect(formatNumber(1000000000, '0a')).toBe('1B');
      expect(formatNumber(1234567890, '0.0a')).toBe('1.2B');
      expect(formatNumber(1234567890, '0.00a')).toBe('1.23B');
    });

    it('formats trillions with "T"', () => {
      expect(formatNumber(1000000000000, '0a')).toBe('1T');
      expect(formatNumber(1234567890123, '0.0a')).toBe('1.2T');
    });

    it('does not abbreviate small numbers', () => {
      expect(formatNumber(999, '0a')).toBe('999');
      expect(formatNumber(500, '0.0a')).toBe('500.0');
      expect(formatNumber(42, '0.00a')).toBe('42.00');
    });
  });

  describe('negative numbers', () => {
    it('handles negative values', () => {
      expect(formatNumber(-1234.5, '0.0')).toBe('-1234.5');
      expect(formatNumber(-2345, '0.0a')).toBe('-2.3k');
      expect(formatNumber(-1000000, '0a')).toBe('-1M');
    });
  });

  describe('edge cases', () => {
    it('handles zero', () => {
      expect(formatNumber(0, '0')).toBe('0');
      expect(formatNumber(0, '0.0')).toBe('0.0');
      expect(formatNumber(0, '0a')).toBe('0');
    });

    it('handles very small numbers', () => {
      expect(formatNumber(0.001, '0.00')).toBe('0.00');
      expect(formatNumber(0.005, '0.00')).toBe('0.01');
      expect(formatNumber(0.123, '0.0')).toBe('0.1');
    });
  });
});
