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
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ];
  }

  // Handle rgb/rgba colors
  const rgbMatch = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  if (rgbMatch) {
    return [
      Number.parseInt(rgbMatch[1] ?? '0', 10),
      Number.parseInt(rgbMatch[2] ?? '0', 10),
      Number.parseInt(rgbMatch[3] ?? '0', 10),
    ];
  }

  return null;
}

/**
 * Convert sRGB channel value to linear RGB for luminance calculation
 */
function toLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.039_28 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Calculate relative luminance of a color (0 = dark, 1 = light)
 * Based on WCAG formula - note: non-linear, mid gray ~= 0.21
 */
export function getLuminance(r: number, g: number, b: number): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculate perceived brightness of a color (0 = dark, 1 = light)
 * Uses simple weighted average - linear scale where 0.5 = mid gray
 */
export function getBrightness(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
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
 * All colors (icon, label, value) adapt to background brightness
 */
export function getContrastColors(backgroundColor: string): ContrastColors {
  const rgb = parseColor(backgroundColor);
  const useDark = rgb ? getBrightness(rgb[0], rgb[1], rgb[2]) > 0.5 : false;

  if (useDark) {
    return {
      icon: 'rgba(0, 0, 0, 0.7)',
      label: 'rgba(0, 0, 0, 0.9)',
      value: 'rgba(0, 0, 0, 0.7)',
    };
  } else {
    return {
      icon: 'rgba(255, 255, 255, 0.85)',
      label: 'rgba(255, 255, 255, 0.95)',
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

  const r1 = Number.parseInt(hex1.slice(0, 2), 16);
  const g1 = Number.parseInt(hex1.slice(2, 4), 16);
  const b1 = Number.parseInt(hex1.slice(4, 6), 16);

  const r2 = Number.parseInt(hex2.slice(0, 2), 16);
  const g2 = Number.parseInt(hex2.slice(2, 4), 16);
  const b2 = Number.parseInt(hex2.slice(4, 6), 16);

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  if (opacity !== undefined) {
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}
