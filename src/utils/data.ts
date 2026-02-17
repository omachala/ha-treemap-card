/**
 * Data preparation utilities for treemap layout
 * Optimized for performance with single-pass algorithms where possible
 */

import type { TreemapItem } from '../types';

export interface PrepareDataOptions {
  inverse?: boolean;
  ascending?: boolean;
  limit?: number;
  sizeMin?: number;
  sizeMax?: number;
}

export interface PreparedData {
  items: TreemapItem[];
  colorMin: number;
  colorMax: number;
}

interface DataStats {
  colorMin: number;
  colorMax: number;
  sizeMin: number;
  sizeMax: number;
}

/**
 * Calculate min/max statistics for color and size values in a single pass
 */
function calculateStats(data: TreemapItem[]): DataStats {
  let colorMin = Number.POSITIVE_INFINITY;
  let colorMax = Number.NEGATIVE_INFINITY;
  let sizeMin = Number.POSITIVE_INFINITY;
  let sizeMax = Number.NEGATIVE_INFINITY;

  for (const item of data) {
    if (item.colorValue < colorMin) colorMin = item.colorValue;
    if (item.colorValue > colorMax) colorMax = item.colorValue;
    if (item.sizeValue < sizeMin) sizeMin = item.sizeValue;
    if (item.sizeValue > sizeMax) sizeMax = item.sizeValue;
  }

  return { colorMin, colorMax, sizeMin, sizeMax };
}

/**
 * Apply inverse sizing: low values get bigger rectangles.
 * Inverts both sizeValue (for layout area) and sortValue (so sort order reflects inverted sizing).
 * Returns the new max value after inversion.
 */
function applyInverseSizing(data: TreemapItem[], sizeMin: number, sizeMax: number): number {
  const sizeSum = sizeMax + sizeMin;

  // Invert sizeValue and sortValue together so sort order matches the new sizing
  for (const item of data) {
    item.sizeValue = sizeSum - item.sizeValue;
    item.sortValue = -item.sortValue; // negate so largest inverted item sorts first
  }

  // Calculate new max and apply floor (10% of max)
  const invertedMax = sizeSum - sizeMin;
  const minFloor = invertedMax * 0.1;

  for (const item of data) {
    if (item.sizeValue < minFloor) {
      item.sizeValue = minFloor;
    }
  }

  return invertedMax;
}

/**
 * Sort data by sizeValue for limit slicing (largest area items first or last).
 * Uses sizeValue (always positive, inverted when size.inverse) so "limit" always
 * means "keep the N items with the biggest rectangles".
 */
function sortBySize(data: TreemapItem[], inverse: boolean, ascending: boolean): TreemapItem[] {
  const effectiveAsc = inverse ? !ascending : ascending;
  return [...data].sort((a, b) =>
    effectiveAsc ? a.sizeValue - b.sizeValue : b.sizeValue - a.sizeValue
  );
}

/**
 * Apply size maximum constraint and return the actual max value
 */
function applySizeMax(data: TreemapItem[], sizeMax: number | undefined): number {
  let currentMax = 1;

  for (const item of data) {
    if (sizeMax !== undefined && item.sizeValue > sizeMax) {
      item.sizeValue = sizeMax;
    }
    if (item.sizeValue > currentMax) {
      currentMax = item.sizeValue;
    }
  }

  return currentMax;
}

/**
 * Apply size minimum constraint (default: 15% of max)
 */
function applySizeMin(data: TreemapItem[], sizeMin: number | undefined, currentMax: number): void {
  const effectiveMin = sizeMin ?? currentMax * 0.15;

  for (const item of data) {
    if (item.sizeValue < effectiveMin) {
      item.sizeValue = effectiveMin;
    }
  }
}

/**
 * Prepare treemap data for layout: calculate stats, apply sizing options, sort
 * Uses single-pass algorithms to minimize iterations over data
 */
export function prepareTreemapData(
  data: TreemapItem[],
  options: PrepareDataOptions = {}
): PreparedData {
  const { inverse = false, ascending = false, limit, sizeMin, sizeMax } = options;

  if (data.length === 0) {
    return { items: [], colorMin: 0, colorMax: 0 };
  }

  // Calculate all stats in single pass
  const stats = calculateStats(data);

  // Apply inverse sizing if requested
  if (inverse) {
    applyInverseSizing(data, stats.sizeMin, stats.sizeMax);
  }

  // Sort and limit
  const sortedData = sortBySize(data, inverse, ascending);
  const limitedData = limit !== undefined && limit > 0 ? sortedData.slice(0, limit) : sortedData;

  // Apply size constraints
  const currentMax = applySizeMax(limitedData, sizeMax);
  applySizeMin(limitedData, sizeMin, currentMax);

  return { items: limitedData, colorMin: stats.colorMin, colorMax: stats.colorMax };
}
