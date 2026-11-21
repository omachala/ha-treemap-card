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
 *
 * Covers without a position fall back to their open/closed state. Anything else
 * (unavailable, unknown, moving without a position) has no usable position and
 * returns undefined so it is handled like any other unavailable entity.
 */
export function extractCoverInfo({ attributes, state }: HassEntity): CoverInfo | undefined {
  const currentPosition = getNumber(attributes['current_position']);

  let openPosition: number;
  if (currentPosition !== undefined) {
    openPosition = Math.max(0, Math.min(100, currentPosition));
  } else if (state === 'open') {
    openPosition = 100;
  } else if (state === 'closed') {
    openPosition = 0;
  } else {
    return undefined;
  }

  return {
    position: 100 - openPosition,
    isOpen: state === 'open' || openPosition > 0,
  };
}
