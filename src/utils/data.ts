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

  // Single pass: calculate all stats at once
  let colorMin = Number.POSITIVE_INFINITY;
  let colorMax = Number.NEGATIVE_INFINITY;
  let sizeMinVal = Number.POSITIVE_INFINITY;
  let sizeMaxVal = Number.NEGATIVE_INFINITY;

  for (const item of data) {
    if (item.colorValue < colorMin) colorMin = item.colorValue;
    if (item.colorValue > colorMax) colorMax = item.colorValue;
    if (item.sizeValue < sizeMinVal) sizeMinVal = item.sizeValue;
    if (item.sizeValue > sizeMaxVal) sizeMaxVal = item.sizeValue;
  }

  // Apply inverse sizing (low values get bigger rectangles)
  if (inverse) {
    const sizeSum = sizeMaxVal + sizeMinVal;
    for (const d of data) {
      d.sizeValue = sizeSum - d.sizeValue;
    }
    // Recalculate max after inversion for min floor calculation
    sizeMaxVal = sizeSum - sizeMinVal;
    const minFloor = sizeMaxVal * 0.1;
    for (const d of data) {
      if (d.sizeValue < minFloor) {
        d.sizeValue = minFloor;
      }
    }
  }

  // Sort by sizeValue
  // When inverse is true, we flip ascending because values are already inverted
  const effectiveAsc = inverse ? !ascending : ascending;
  const sortedData = [...data].sort((a, b) =>
    effectiveAsc ? a.sizeValue - b.sizeValue : b.sizeValue - a.sizeValue
  );

  // Apply limit
  const limitedData = limit !== undefined && limit > 0 ? sortedData.slice(0, limit) : sortedData;

  // Apply size constraints in single pass, also find currentMax
  let currentMax = 1;
  for (const d of limitedData) {
    if (sizeMax !== undefined && d.sizeValue > sizeMax) {
      d.sizeValue = sizeMax;
    }
    if (d.sizeValue > currentMax) {
      currentMax = d.sizeValue;
    }
  }

  // Apply min floor (default: 15% of max sizeValue)
  const effectiveMin = sizeMin ?? currentMax * 0.15;
  for (const d of limitedData) {
    if (d.sizeValue < effectiveMin) {
      d.sizeValue = effectiveMin;
    }
  }

  return { items: limitedData, colorMin, colorMax };
}
