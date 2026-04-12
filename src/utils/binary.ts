/**
 * Binary entity extraction (switch, input_boolean, binary_sensor)
 */

import type { HassEntity } from '../types';

const BINARY_DOMAINS = ['switch', 'input_boolean', 'binary_sensor'];

/**
 * Check if entity is a binary (on/off) entity
 */
export function isBinaryEntity(entityId: string): boolean {
  const domain = entityId.split('.')[0];
  return BINARY_DOMAINS.includes(domain ?? '');
}

/**
 * Extract binary state info from entity
 */
export function extractBinaryInfo({ state }: HassEntity): { isOn: boolean } {
  return { isOn: state === 'on' };
}

/**
 * Get background color for a binary entity
 */
export function getBinaryBackgroundColor(isOn: boolean, offColor: string, onColor: string): string {
  return isOn ? onColor : offColor;
}
