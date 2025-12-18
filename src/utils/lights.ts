/**
 * Light entity extraction
 */

import type { LightColorInfo, HassEntity } from '../types';
import { getNumber, getStringArray, getRgbColor, getHsColor } from './predicates';

/**
 * Check if entity is a light
 */
export function isLightEntity(entityId: string): boolean {
  return entityId.startsWith('light.');
}

/**
 * Extract light color information from entity attributes
 */
export function extractLightInfo(entity: HassEntity): LightColorInfo {
  const attributes = entity.attributes;
  const isOn = entity.state === 'on';
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
