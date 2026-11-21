/**
 * Cover entity extraction for treemap tiles.
 */

import type { CoverInfo, HassEntity } from '../types';
import { getNumber } from './predicates';

/**
 * Check if an entity is a cover.
 */
export function isCoverEntity(entityId: string): boolean {
  return entityId.startsWith('cover.');
}

/**
 * Extract a display position for a cover.
 *
 * Home Assistant's `current_position` is 100 when open and 0 when closed.
 * Treemaps use the inverse so a fully open cover is 0% and a fully closed
 * cover is 100%, matching the amount of cover present in the opening.
 */
export function extractCoverInfo({ attributes, state }: HassEntity): CoverInfo {
  const currentPosition = getNumber(attributes['current_position']);
  const openPosition =
    currentPosition === undefined
      ? state === 'open'
        ? 100
        : 0
      : Math.max(0, Math.min(100, currentPosition));

  return {
    position: 100 - openPosition,
    isOpen: state === 'open' || openPosition > 0,
  };
}
