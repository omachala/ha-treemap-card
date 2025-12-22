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

/**
 * Options for gradient color calculation
 */
export interface GradientColorOptions {
  colorHigh: string;
  colorLow: string;
  colorMid?: string;
  scaleMin?: number;
  scaleMax?: number;
  neutral?: number;
  opacity?: number;
}

/**
 * Calculate gradient color for a value within a range
 * Supports two-color and three-color gradients with optional neutral point
 */
export function getGradientColor(
  value: number,
  min: number,
  max: number,
  options: GradientColorOptions
): string {
  const { colorHigh, colorLow, colorMid, opacity } = options;
  const minValue = options.scaleMin ?? min;
  const maxValue = options.scaleMax ?? max;
  const neutral = options.neutral;

  // Clamp value to min/max range
  const clampedValue = Math.max(minValue, Math.min(maxValue, value));

  // Calculate the midpoint (neutral if set, otherwise center of range)
  const midPoint = neutral ?? (minValue + maxValue) / 2;

  // If mid color is defined, use three-color gradient: low -> mid -> high
  if (colorMid) {
    if (clampedValue <= midPoint) {
      // Below midpoint: interpolate low -> mid
      if (minValue >= midPoint) {
        return interpolateColor(colorMid, colorMid, 1, opacity);
      }
      const factor = (clampedValue - minValue) / (midPoint - minValue);
      return interpolateColor(colorLow, colorMid, factor, opacity);
    } else {
      // Above midpoint: interpolate mid -> high
      if (maxValue <= midPoint) {
        return interpolateColor(colorMid, colorMid, 1, opacity);
      }
      const factor = (clampedValue - midPoint) / (maxValue - midPoint);
      return interpolateColor(colorMid, colorHigh, factor, opacity);
    }
  }

  // No mid color - use two-color gradient
  // If neutral is set, use it as the center point for blending
  if (neutral !== undefined) {
    if (clampedValue <= neutral) {
      // Below neutral: interpolate from low to 50% blend
      if (minValue >= neutral) return interpolateColor(colorLow, colorHigh, 0.5, opacity);
      const factor = (clampedValue - minValue) / (neutral - minValue);
      return interpolateColor(colorLow, colorHigh, factor * 0.5, opacity);
    } else {
      // Above neutral: interpolate from 50% blend to high
      if (maxValue <= neutral) return interpolateColor(colorLow, colorHigh, 0.5, opacity);
      const factor = (clampedValue - neutral) / (maxValue - neutral);
      return interpolateColor(colorLow, colorHigh, 0.5 + factor * 0.5, opacity);
    }
  }

  // Default: simple linear gradient from low to high
  if (maxValue === minValue) {
    return interpolateColor(colorHigh, colorHigh, 1, opacity);
  }
  const factor = (clampedValue - minValue) / (maxValue - minValue);
  return interpolateColor(colorLow, colorHigh, factor, opacity);
}

/**
 * HVAC color configuration
 */
export interface HvacColorConfig {
  heating?: string;
  cooling?: string;
  idle?: string;
  off?: string;
}

/**
 * Default HVAC colors
 */
const DEFAULT_HVAC_COLORS: Required<HvacColorConfig> = {
  heating: '#ff6b35', // orange
  cooling: '#4dabf7', // blue
  idle: '#69db7c', // green
  off: '#868e96', // gray
};

/**
 * Get color for HVAC action (categorical coloring)
 * Also considers hvac_mode since HA reports hvac_action as 'idle' when mode is 'off'
 */
export function getHvacColor(
  hvacAction: string | null,
  hvacMode: string | null,
  hvacConfig?: HvacColorConfig,
  opacity?: number
): string {
  const config = hvacConfig ?? {};

  // If hvac_mode is 'off', use off color regardless of hvac_action
  // HA reports hvac_action as 'idle' even when thermostat is off
  if (hvacMode === 'off') {
    const color = config.off ?? DEFAULT_HVAC_COLORS.off;
    if (opacity !== undefined) {
      const rgb = parseColor(color);
      if (rgb) {
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
      }
    }
    return color;
  }

  let color: string;
  switch (hvacAction) {
    case 'heating': {
      color = config.heating ?? DEFAULT_HVAC_COLORS.heating;
      break;
    }
    case 'cooling': {
      color = config.cooling ?? DEFAULT_HVAC_COLORS.cooling;
      break;
    }
    case 'idle': {
      color = config.idle ?? DEFAULT_HVAC_COLORS.idle;
      break;
    }
    case 'off':
    case null: {
      // HA often reports null hvac_action when thermostat is off
      color = config.off ?? DEFAULT_HVAC_COLORS.off;
      break;
    }
    default: {
      color = DEFAULT_HVAC_COLORS.idle;
    }
  }

  if (opacity !== undefined) {
    const rgb = parseColor(color);
    if (rgb) {
      return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
    }
  }

  return color;
}

/**
 * Apply opacity to a color string
 */
export function applyOpacity(color: string, opacity: number): string {
  const rgb = parseColor(color);
  if (rgb) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
  }
  return color;
}
