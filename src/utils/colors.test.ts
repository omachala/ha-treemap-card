import { describe, it, expect } from 'vitest';
import {
  hsToRgb,
  parseColor,
  getLuminance,
  getContrastColors,
  interpolateColor,
  getGradientColor,
  getHvacColor,
  applyOpacity,
  getBrightness,
} from './colors';

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

describe('getBrightness', () => {
  it('returns 0 for black', () => {
    expect(getBrightness(0, 0, 0)).toBe(0);
  });

  it('returns 1 for white', () => {
    expect(getBrightness(255, 255, 255)).toBe(1);
  });

  it('returns ~0.5 for mid gray', () => {
    const brightness = getBrightness(128, 128, 128);
    expect(brightness).toBeCloseTo(0.5, 1);
  });

  it('weights green higher than red or blue', () => {
    const redBrightness = getBrightness(255, 0, 0);
    const greenBrightness = getBrightness(0, 255, 0);
    const blueBrightness = getBrightness(0, 0, 255);
    expect(greenBrightness).toBeGreaterThan(redBrightness);
    expect(redBrightness).toBeGreaterThan(blueBrightness);
  });
});

describe('getGradientColor', () => {
  const defaultOptions = {
    colorLow: '#0000ff', // blue
    colorHigh: '#ff0000', // red
  };

  describe('two-color gradient', () => {
    it('returns low color at minimum value', () => {
      const result = getGradientColor(0, 0, 100, defaultOptions);
      expect(result).toBe('rgb(0, 0, 255)');
    });

    it('returns high color at maximum value', () => {
      const result = getGradientColor(100, 0, 100, defaultOptions);
      expect(result).toBe('rgb(255, 0, 0)');
    });

    it('returns midpoint color at middle value', () => {
      const result = getGradientColor(50, 0, 100, defaultOptions);
      expect(result).toBe('rgb(128, 0, 128)');
    });

    it('clamps values below minimum', () => {
      const result = getGradientColor(-10, 0, 100, defaultOptions);
      expect(result).toBe('rgb(0, 0, 255)');
    });

    it('clamps values above maximum', () => {
      const result = getGradientColor(150, 0, 100, defaultOptions);
      expect(result).toBe('rgb(255, 0, 0)');
    });

    it('handles equal min and max (edge case)', () => {
      const result = getGradientColor(50, 50, 50, defaultOptions);
      expect(result).toBe('rgb(255, 0, 0)');
    });
  });

  describe('with custom scale', () => {
    it('uses scaleMin and scaleMax to override data range', () => {
      const options = { ...defaultOptions, scaleMin: 0, scaleMax: 200 };
      // Value 100 is now at midpoint of 0-200 scale
      const result = getGradientColor(100, 0, 100, options);
      expect(result).toBe('rgb(128, 0, 128)');
    });
  });

  describe('with neutral point', () => {
    it('uses neutral as center point for two-color gradient', () => {
      const options = { ...defaultOptions, neutral: 50 };
      // At neutral point, should be 50% blend
      const result = getGradientColor(50, 0, 100, options);
      expect(result).toBe('rgb(128, 0, 128)');
    });

    it('interpolates below neutral towards low color', () => {
      const options = { ...defaultOptions, neutral: 50 };
      const result = getGradientColor(0, 0, 100, options);
      expect(result).toBe('rgb(0, 0, 255)');
    });

    it('interpolates above neutral towards high color', () => {
      const options = { ...defaultOptions, neutral: 50 };
      const result = getGradientColor(100, 0, 100, options);
      expect(result).toBe('rgb(255, 0, 0)');
    });

    it('handles neutral at min edge', () => {
      const options = { ...defaultOptions, neutral: 0 };
      const result = getGradientColor(0, 0, 100, options);
      expect(result).toBe('rgb(128, 0, 128)');
    });

    it('handles neutral at max edge', () => {
      const options = { ...defaultOptions, neutral: 100 };
      const result = getGradientColor(100, 0, 100, options);
      expect(result).toBe('rgb(128, 0, 128)');
    });
  });

  describe('three-color gradient with mid color', () => {
    const threeColorOptions = {
      colorLow: '#0000ff', // blue
      colorMid: '#00ff00', // green
      colorHigh: '#ff0000', // red
    };

    it('returns low color at minimum', () => {
      const result = getGradientColor(0, 0, 100, threeColorOptions);
      expect(result).toBe('rgb(0, 0, 255)');
    });

    it('returns mid color at midpoint', () => {
      const result = getGradientColor(50, 0, 100, threeColorOptions);
      expect(result).toBe('rgb(0, 255, 0)');
    });

    it('returns high color at maximum', () => {
      const result = getGradientColor(100, 0, 100, threeColorOptions);
      expect(result).toBe('rgb(255, 0, 0)');
    });

    it('interpolates between low and mid below midpoint', () => {
      const result = getGradientColor(25, 0, 100, threeColorOptions);
      // 50% between blue and green
      expect(result).toBe('rgb(0, 128, 128)');
    });

    it('interpolates between mid and high above midpoint', () => {
      const result = getGradientColor(75, 0, 100, threeColorOptions);
      // 50% between green and red
      expect(result).toBe('rgb(128, 128, 0)');
    });

    it('uses custom neutral for midpoint', () => {
      const options = { ...threeColorOptions, neutral: 25 };
      // At neutral=25, should be exactly mid color
      const result = getGradientColor(25, 0, 100, options);
      expect(result).toBe('rgb(0, 255, 0)');
    });

    it('handles minValue >= midPoint edge case (below midpoint returns low color)', () => {
      // When scaleMin=60 and midPoint=50 (default center of 0-100), value 60 is below midPoint
      // Since minValue > midPoint, it returns mid color for below-midpoint values
      const options = { ...threeColorOptions, scaleMin: 60 };
      const result = getGradientColor(60, 0, 100, options);
      // Value is clamped to 60 (scaleMin), which is below midPoint=80 (center of 60-100)
      // So it's actually in the low->mid range: 60 is at 0% of the 60-80 range = low color
      expect(result).toBe('rgb(0, 0, 255)');
    });

    it('handles maxValue <= midPoint edge case (above midpoint returns high color)', () => {
      // When scaleMax=40 and midPoint=20 (center of 0-40), value 40 is above midPoint
      // Returns color interpolated from mid->high
      const options = { ...threeColorOptions, scaleMax: 40 };
      const result = getGradientColor(40, 0, 100, options);
      // Value 40 is at 100% of 20-40 range = high color
      expect(result).toBe('rgb(255, 0, 0)');
    });
  });

  describe('with opacity', () => {
    it('applies opacity to the result', () => {
      const options = { ...defaultOptions, opacity: 0.5 };
      const result = getGradientColor(50, 0, 100, options);
      expect(result).toBe('rgba(128, 0, 128, 0.5)');
    });
  });
});

describe('getHvacColor', () => {
  describe('default colors', () => {
    it('returns orange for heating action', () => {
      const result = getHvacColor('heating', 'heat');
      expect(result).toBe('#ff6b35');
    });

    it('returns blue for cooling action', () => {
      const result = getHvacColor('cooling', 'cool');
      expect(result).toBe('#4dabf7');
    });

    it('returns green for idle action', () => {
      const result = getHvacColor('idle', 'heat');
      expect(result).toBe('#69db7c');
    });

    it('returns gray for off action', () => {
      const result = getHvacColor('off', 'off');
      expect(result).toBe('#868e96');
    });

    it('returns gray for null action', () => {
      const result = getHvacColor(null, null);
      expect(result).toBe('#868e96');
    });

    it('returns idle color for unknown action', () => {
      const result = getHvacColor('unknown_action', 'heat');
      expect(result).toBe('#69db7c');
    });
  });

  describe('hvac_mode override', () => {
    it('uses off color when hvac_mode is off, even if action is idle', () => {
      // HA reports hvac_action as 'idle' even when thermostat is off
      const result = getHvacColor('idle', 'off');
      expect(result).toBe('#868e96');
    });
  });

  describe('custom colors', () => {
    const customColors = {
      heating: '#ff0000',
      cooling: '#0000ff',
      idle: '#00ff00',
      off: '#808080',
    };

    it('uses custom heating color', () => {
      const result = getHvacColor('heating', 'heat', customColors);
      expect(result).toBe('#ff0000');
    });

    it('uses custom cooling color', () => {
      const result = getHvacColor('cooling', 'cool', customColors);
      expect(result).toBe('#0000ff');
    });

    it('uses custom off color when mode is off', () => {
      const result = getHvacColor('idle', 'off', customColors);
      expect(result).toBe('#808080');
    });
  });

  describe('with opacity', () => {
    it('applies opacity to heating color', () => {
      const result = getHvacColor('heating', 'heat', undefined, 0.5);
      expect(result).toBe('rgba(255, 107, 53, 0.5)');
    });

    it('applies opacity when hvac_mode is off', () => {
      const result = getHvacColor('idle', 'off', undefined, 0.5);
      expect(result).toBe('rgba(134, 142, 150, 0.5)');
    });

    it('applies opacity with custom colors', () => {
      const customColors = { heating: '#ff0000' };
      const result = getHvacColor('heating', 'heat', customColors, 0.5);
      expect(result).toBe('rgba(255, 0, 0, 0.5)');
    });
  });
});

describe('applyOpacity', () => {
  it('applies opacity to hex color', () => {
    const result = applyOpacity('#ff0000', 0.5);
    expect(result).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('applies opacity to rgb color', () => {
    const result = applyOpacity('rgb(0, 255, 0)', 0.75);
    expect(result).toBe('rgba(0, 255, 0, 0.75)');
  });

  it('returns original color if parsing fails', () => {
    const result = applyOpacity('invalid-color', 0.5);
    expect(result).toBe('invalid-color');
  });

  it('handles opacity of 0', () => {
    const result = applyOpacity('#ffffff', 0);
    expect(result).toBe('rgba(255, 255, 255, 0)');
  });

  it('handles opacity of 1', () => {
    const result = applyOpacity('#000000', 1);
    expect(result).toBe('rgba(0, 0, 0, 1)');
  });
});
