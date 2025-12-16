/**
 * Color utility functions
 */

/**
 * Convert HS color to RGB
 */
export function hsToRgb(h: number, s: number): [number, number, number] {
  // h: 0-360, s: 0-100
  const hNorm = h / 360;
  const sNorm = s / 100;
  const l = 0.5; // Fixed lightness for vivid colors

  let r: number, g: number, b: number;

  if (sNorm === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + sNorm) : l + sNorm - l * sNorm;
    const p = 2 * l - q;
    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Parse a color string (hex, rgb, rgba) and return RGB values
 */
export function parseColor(color: string): [number, number, number] | null {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    return [
      parseInt(hex.substring(0, 2), 16),
      parseInt(hex.substring(2, 4), 16),
      parseInt(hex.substring(4, 6), 16),
    ];
  }

  // Handle rgb/rgba colors
  const rgbMatch = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1] ?? '0', 10),
      parseInt(rgbMatch[2] ?? '0', 10),
      parseInt(rgbMatch[3] ?? '0', 10),
    ];
  }

  return null;
}

/**
 * Calculate relative luminance of a color (0 = dark, 1 = light)
 * Based on WCAG formula
 */
export function getLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Contrast colors for text on a background
 */
export interface ContrastColors {
  icon: string;
  label: string;
  value: string;
}

/**
 * Get contrasting text colors based on background
 * Icon is always white with opacity, label/value adapt to background
 */
export function getContrastColors(backgroundColor: string): ContrastColors {
  const rgb = parseColor(backgroundColor);
  const useDark = rgb ? getLuminance(rgb[0], rgb[1], rgb[2]) > 0.5 : false;

  // Icon is always white with slight opacity
  const icon = 'rgba(255, 255, 255, 0.85)';

  if (useDark) {
    return {
      icon,
      label: 'rgba(0, 0, 0, 0.9)',
      value: 'rgba(0, 0, 0, 0.7)',
    };
  } else {
    return {
      icon,
      label: 'white',
      value: 'rgba(255, 255, 255, 0.85)',
    };
  }
}

/**
 * Interpolate between two colors based on value 0-1
 */
export function interpolateColor(
  color1: string,
  color2: string,
  factor: number,
  opacity?: number
): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');

  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);

  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  if (opacity !== undefined) {
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}
