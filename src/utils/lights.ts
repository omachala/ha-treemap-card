/**
 * Light entity extraction and color utilities
 */

import type { LightColorInfo, HassEntity } from '../types';
import { getNumber, getStringArray, getRgbColor, getHsColor } from './predicates';
import { hsToRgb, parseColor } from './colors';

/**
 * Check if entity is a light
 */
export function isLightEntity(entityId: string): boolean {
  return entityId.startsWith('light.');
}

/**
 * Extract light color information from entity attributes
 */
export function extractLightInfo({ attributes, state }: HassEntity): LightColorInfo {
  const isOn = state === 'on';
  const brightnessRaw = getNumber(attributes['brightness']);
  const brightness = isOn ? Math.round(((brightnessRaw ?? 255) / 255) * 100) : 0;

  // Check supported color modes
  const supportedModes = getStringArray(attributes['supported_color_modes']);
  const supportsColor = supportedModes.some(mode =>
    ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(mode)
  );

  const result: LightColorInfo = {
    brightness,
    isOn,
    supportsColor,
  };

  // Extract color if available
  if (isOn && supportsColor) {
    const rgbColor = getRgbColor(attributes['rgb_color']);
    const hsColor = getHsColor(attributes['hs_color']);

    if (rgbColor) {
      result.rgb = rgbColor;
    } else if (hsColor) {
      result.hs = hsColor;
    }
  }

  return result;
}

/**
 * Get background color for a light entity
 * - Color lights: use actual RGB/HS color with brightness as opacity
 * - Dimmable lights: use configured on color with brightness as opacity
 * - Off lights: use configured off color
 */
export function getLightBackgroundColor(
  light: LightColorInfo | undefined,
  offColor: string,
  onColor: string
): string {
  if (!light) return offColor;

  // Off light: dark color
  if (!light.isOn) {
    return offColor;
  }

  // Brightness as opacity (min 0.3 so it's always visible when on)
  const opacity = 0.3 + (light.brightness / 100) * 0.7;

  // Color light with RGB - use the actual light color
  if (light.supportsColor && light.rgb) {
    const [r, g, b] = light.rgb;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // Color light with HS - convert to RGB
  if (light.supportsColor && light.hs) {
    const [h, s] = light.hs;
    const [r, g, b] = hsToRgb(h, s);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // Dimmable-only light: use on color with brightness as opacity
  const rgb = parseColor(onColor);
  if (rgb) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
  }
  return onColor;
}
