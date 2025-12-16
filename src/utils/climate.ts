/**
 * Climate entity extraction and computed values
 */

import type { ClimateInfo, HassEntity } from '../types';
import { getNumber, getHvacAction } from './predicates';

/**
 * Check if entity is a climate/thermostat
 */
export function isClimateEntity(entityId: string): boolean {
  return entityId.startsWith('climate.');
}

/**
 * Extract climate information from entity attributes
 * Computes temp_difference and temp_offset values
 *
 * temp_offset is HVAC-mode aware:
 * - Heat mode: Only negative values matter (room colder than target). If current >= target, offset = 0
 * - Cool mode: Only positive values matter (room warmer than target). If current <= target, offset = 0
 * - Other modes (heat_cool, auto, off): Raw difference (current - target)
 */
export function extractClimateInfo(entity: HassEntity): ClimateInfo {
  const attrs = entity.attributes;
  const currentTemp = getNumber(attrs['current_temperature']);
  const targetTemp = getNumber(attrs['temperature']);
  const hvacAction = getHvacAction(attrs['hvac_action']);
  const hvacMode = entity.state;

  const currentTemperature = currentTemp ?? null;
  const targetTemperature = targetTemp ?? null;

  // Compute temp_difference and temp_offset
  let tempDifference = 0;
  let tempOffset = 0;

  if (currentTemperature !== null && targetTemperature !== null) {
    const rawOffset = currentTemperature - targetTemperature;

    // Smart offset based on HVAC mode
    // In heat mode: positive offset means "mission accomplished" - treat as 0
    // In cool mode: negative offset means "mission accomplished" - treat as 0
    if (hvacMode === 'heat') {
      // Heating: only care if room is colder than target
      tempOffset = rawOffset < 0 ? rawOffset : 0;
    } else if (hvacMode === 'cool') {
      // Cooling: only care if room is warmer than target
      tempOffset = rawOffset > 0 ? rawOffset : 0;
    } else {
      // heat_cool, auto, off, or other: use raw offset
      tempOffset = rawOffset;
    }

    tempDifference = Math.abs(tempOffset);
  }

  return {
    currentTemperature,
    targetTemperature,
    tempDifference,
    tempOffset,
    hvacAction: hvacAction ?? null,
    hvacMode: hvacMode ?? null,
  };
}

/**
 * Get computed climate value by attribute name
 */
export function getClimateValue(climate: ClimateInfo, attribute: string): number | string | null {
  if (attribute === 'temp_difference') {
    return climate.tempDifference;
  }
  if (attribute === 'temp_offset') {
    return climate.tempOffset;
  }
  if (attribute === 'current_temperature') {
    return climate.currentTemperature;
  }
  if (attribute === 'temperature') {
    return climate.targetTemperature;
  }
  if (attribute === 'hvac_action') {
    return climate.hvacAction;
  }
  if (attribute === 'hvac_mode') {
    return climate.hvacMode;
  }
  return null;
}
