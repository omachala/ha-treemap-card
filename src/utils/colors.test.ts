import { describe, it, expect } from 'vitest';
import { hsToRgb, parseColor, getLuminance, getContrastColors, interpolateColor } from './colors';

describe('hsToRgb', () => {
  it('converts red (0, 100) correctly', () => {
    const [r, g, b] = hsToRgb(0, 100);
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('converts green (120, 100) correctly', () => {
    const [r, g, b] = hsToRgb(120, 100);
    expect(r).toBe(0);
    expect(g).toBe(255);
    expect(b).toBe(0);
  });

  it('converts blue (240, 100) correctly', () => {
    const [r, g, b] = hsToRgb(240, 100);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(255);
  });

  it('converts yellow (60, 100) correctly', () => {
    const [r, g, b] = hsToRgb(60, 100);
    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(0);
  });

  it('converts gray when saturation is 0', () => {
    const [r, g, b] = hsToRgb(180, 0);
    expect(r).toBe(128);
    expect(g).toBe(128);
    expect(b).toBe(128);
  });

  it('handles hue values at boundaries', () => {
    // Cyan at 180
    const [r, g, b] = hsToRgb(180, 100);
    expect(r).toBe(0);
    expect(g).toBe(255);
    expect(b).toBe(255);
  });
});

describe('parseColor', () => {
  it('parses hex colors', () => {
    expect(parseColor('#ff0000')).toEqual([255, 0, 0]);
    expect(parseColor('#00ff00')).toEqual([0, 255, 0]);
    expect(parseColor('#0000ff')).toEqual([0, 0, 255]);
    expect(parseColor('#ffffff')).toEqual([255, 255, 255]);
    expect(parseColor('#000000')).toEqual([0, 0, 0]);
  });

  it('parses rgb colors', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual([255, 0, 0]);
    expect(parseColor('rgb(0, 255, 0)')).toEqual([0, 255, 0]);
    expect(parseColor('rgb(128, 128, 128)')).toEqual([128, 128, 128]);
  });

  it('parses rgba colors', () => {
    expect(parseColor('rgba(255, 0, 0, 0.5)')).toEqual([255, 0, 0]);
    expect(parseColor('rgba(0, 128, 255, 1)')).toEqual([0, 128, 255]);
  });

  it('returns null for invalid colors', () => {
    expect(parseColor('invalid')).toBeNull();
    expect(parseColor('red')).toBeNull();
    expect(parseColor('')).toBeNull();
  });
});

describe('getLuminance', () => {
  it('returns 0 for black', () => {
    expect(getLuminance(0, 0, 0)).toBe(0);
  });

  it('returns 1 for white', () => {
    expect(getLuminance(255, 255, 255)).toBe(1);
  });

  it('returns correct luminance for red', () => {
    const lum = getLuminance(255, 0, 0);
    expect(lum).toBeCloseTo(0.2126, 3);
  });

  it('returns correct luminance for green', () => {
    const lum = getLuminance(0, 255, 0);
    expect(lum).toBeCloseTo(0.7152, 3);
  });

  it('returns correct luminance for blue', () => {
    const lum = getLuminance(0, 0, 255);
    expect(lum).toBeCloseTo(0.0722, 3);
  });

  it('returns higher luminance for light gray than dark gray', () => {
    const lightGray = getLuminance(200, 200, 200);
    const darkGray = getLuminance(50, 50, 50);
    expect(lightGray).toBeGreaterThan(darkGray);
  });
});

describe('getContrastColors', () => {
  it('returns dark text for light backgrounds', () => {
    const colors = getContrastColors('#ffffff');
    expect(colors.label).toBe('rgba(0, 0, 0, 0.9)');
    expect(colors.value).toBe('rgba(0, 0, 0, 0.7)');
  });

  it('returns light text for dark backgrounds', () => {
    const colors = getContrastColors('#000000');
    expect(colors.label).toBe('rgba(255, 255, 255, 0.95)');
    expect(colors.value).toBe('rgba(255, 255, 255, 0.85)');
  });

  it('returns dark icon on light backgrounds and light icon on dark backgrounds', () => {
    const lightBg = getContrastColors('#ffffff');
    const darkBg = getContrastColors('#000000');
    expect(lightBg.icon).toBe('rgba(0, 0, 0, 0.7)');
    expect(darkBg.icon).toBe('rgba(255, 255, 255, 0.85)');
  });

  it('handles invalid color strings gracefully', () => {
    const colors = getContrastColors('invalid');
    expect(colors.label).toBe('rgba(255, 255, 255, 0.95)');
    expect(colors.value).toBe('rgba(255, 255, 255, 0.85)');
  });
});

describe('interpolateColor', () => {
  it('returns first color when factor is 0', () => {
    const result = interpolateColor('#000000', '#ffffff', 0);
    expect(result).toBe('rgb(0, 0, 0)');
  });

  it('returns second color when factor is 1', () => {
    const result = interpolateColor('#000000', '#ffffff', 1);
    expect(result).toBe('rgb(255, 255, 255)');
  });

  it('returns midpoint when factor is 0.5', () => {
    const result = interpolateColor('#000000', '#ffffff', 0.5);
    expect(result).toBe('rgb(128, 128, 128)');
  });

  it('interpolates colors correctly', () => {
    const result = interpolateColor('#ff0000', '#0000ff', 0.5);
    expect(result).toBe('rgb(128, 0, 128)');
  });

  it('returns rgba when opacity is provided', () => {
    const result = interpolateColor('#ff0000', '#0000ff', 0.5, 0.5);
    expect(result).toBe('rgba(128, 0, 128, 0.5)');
  });

  it('handles opacity of 0', () => {
    const result = interpolateColor('#ffffff', '#000000', 0.5, 0);
    expect(result).toBe('rgba(128, 128, 128, 0)');
  });
});
