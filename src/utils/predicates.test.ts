import { describe, it, expect } from 'vitest';
import {
  isNumber,
  isString,
  isOptionalString,
  isOptionalNumber,
  isStringArray,
  isRgbColor,
  isHsColor,
  isHvacAction,
  getHvacAction,
  getNumber,
  getString,
  getStringArray,
  getRgbColor,
  getHsColor,
} from './predicates';

describe('isNumber', () => {
  it('returns true for numbers', () => {
    expect(isNumber(0)).toBe(true);
    expect(isNumber(42)).toBe(true);
    expect(isNumber(-1)).toBe(true);
    expect(isNumber(3.14)).toBe(true);
  });

  it('returns false for NaN', () => {
    expect(isNumber(Number.NaN)).toBe(false);
  });

  it('returns false for non-numbers', () => {
    expect(isNumber('42')).toBe(false);
    expect(isNumber(null)).toBe(false);
    expect(isNumber(undefined)).toBe(false);
    expect(isNumber({})).toBe(false);
  });
});

describe('isString', () => {
  it('returns true for strings', () => {
    expect(isString('')).toBe(true);
    expect(isString('hello')).toBe(true);
  });

  it('returns false for non-strings', () => {
    expect(isString(42)).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
  });
});

describe('isOptionalString', () => {
  it('returns true for strings', () => {
    expect(isOptionalString('hello')).toBe(true);
    expect(isOptionalString('')).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isOptionalString(undefined)).toBe(true);
  });

  it('returns false for other types', () => {
    expect(isOptionalString(null)).toBe(false);
    expect(isOptionalString(42)).toBe(false);
  });
});

describe('isOptionalNumber', () => {
  it('returns true for numbers', () => {
    expect(isOptionalNumber(42)).toBe(true);
    expect(isOptionalNumber(0)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isOptionalNumber(undefined)).toBe(true);
  });

  it('returns false for NaN', () => {
    expect(isOptionalNumber(Number.NaN)).toBe(false);
  });

  it('returns false for other types', () => {
    expect(isOptionalNumber(null)).toBe(false);
    expect(isOptionalNumber('42')).toBe(false);
  });
});

describe('isStringArray', () => {
  it('returns true for string arrays', () => {
    expect(isStringArray([])).toBe(true);
    expect(isStringArray(['a', 'b', 'c'])).toBe(true);
  });

  it('returns false for mixed arrays', () => {
    expect(isStringArray(['a', 1])).toBe(false);
    expect(isStringArray([1, 2, 3])).toBe(false);
  });

  it('returns false for non-arrays', () => {
    expect(isStringArray('hello')).toBe(false);
    expect(isStringArray(null)).toBe(false);
  });
});

describe('isRgbColor', () => {
  it('returns true for valid RGB tuples', () => {
    expect(isRgbColor([255, 0, 0])).toBe(true);
    expect(isRgbColor([0, 128, 255])).toBe(true);
  });

  it('returns false for wrong length arrays', () => {
    expect(isRgbColor([255, 0])).toBe(false);
    expect(isRgbColor([255, 0, 0, 1])).toBe(false);
  });

  it('returns false for non-number elements', () => {
    expect(isRgbColor(['255', '0', '0'])).toBe(false);
  });

  it('returns false for non-arrays', () => {
    expect(isRgbColor(null)).toBe(false);
    expect(isRgbColor('rgb')).toBe(false);
  });
});

describe('isHsColor', () => {
  it('returns true for valid HS tuples', () => {
    expect(isHsColor([180, 50])).toBe(true);
    expect(isHsColor([0, 100])).toBe(true);
  });

  it('returns false for wrong length arrays', () => {
    expect(isHsColor([180])).toBe(false);
    expect(isHsColor([180, 50, 50])).toBe(false);
  });

  it('returns false for non-number elements', () => {
    expect(isHsColor(['180', '50'])).toBe(false);
  });
});

describe('isHvacAction', () => {
  it('returns true for valid HVAC actions', () => {
    expect(isHvacAction('heating')).toBe(true);
    expect(isHvacAction('cooling')).toBe(true);
    expect(isHvacAction('idle')).toBe(true);
    expect(isHvacAction('off')).toBe(true);
  });

  it('returns false for invalid actions', () => {
    expect(isHvacAction('invalid')).toBe(false);
    expect(isHvacAction('')).toBe(false);
    expect(isHvacAction(null)).toBe(false);
  });
});

describe('getHvacAction', () => {
  it('returns action for valid values', () => {
    expect(getHvacAction('heating')).toBe('heating');
    expect(getHvacAction('cooling')).toBe('cooling');
  });

  it('returns undefined for invalid values', () => {
    expect(getHvacAction('invalid')).toBeUndefined();
    expect(getHvacAction(null)).toBeUndefined();
  });
});

describe('getNumber', () => {
  it('returns number for valid values', () => {
    expect(getNumber(42)).toBe(42);
    expect(getNumber(0)).toBe(0);
    expect(getNumber(-1)).toBe(-1);
  });

  it('returns undefined for invalid values', () => {
    expect(getNumber('42')).toBeUndefined();
    expect(getNumber(Number.NaN)).toBeUndefined();
    expect(getNumber(null)).toBeUndefined();
  });
});

describe('getString', () => {
  it('returns string for valid values', () => {
    expect(getString('hello')).toBe('hello');
    expect(getString('')).toBe('');
  });

  it('returns undefined for invalid values', () => {
    expect(getString(42)).toBeUndefined();
    expect(getString(null)).toBeUndefined();
  });
});

describe('getStringArray', () => {
  it('returns array for valid values', () => {
    expect(getStringArray(['a', 'b'])).toEqual(['a', 'b']);
    expect(getStringArray([])).toEqual([]);
  });

  it('returns empty array for invalid values', () => {
    expect(getStringArray('hello')).toEqual([]);
    expect(getStringArray(null)).toEqual([]);
    expect(getStringArray([1, 2])).toEqual([]);
  });
});

describe('getRgbColor', () => {
  it('returns tuple for valid values', () => {
    expect(getRgbColor([255, 0, 0])).toEqual([255, 0, 0]);
  });

  it('returns undefined for invalid values', () => {
    expect(getRgbColor([255, 0])).toBeUndefined();
    expect(getRgbColor(null)).toBeUndefined();
  });
});

describe('getHsColor', () => {
  it('returns tuple for valid values', () => {
    expect(getHsColor([180, 50])).toEqual([180, 50]);
  });

  it('returns undefined for invalid values', () => {
    expect(getHsColor([180])).toBeUndefined();
    expect(getHsColor(null)).toBeUndefined();
  });
});
