import type { TreemapItem } from '../src/types';

// Generate mock data similar to what _resolveData returns
export function generateMockItems(count: number): TreemapItem[] {
  const items: TreemapItem[] = [];
  for (let i = 0; i < count; i++) {
    const value = Math.random() * 100;
    items.push({
      label: `Entity ${i}`,
      value,
      sizeValue: Math.random() * 100,
      sortValue: value,
      colorValue: Math.random() * 100,
      entity_id: `sensor.entity_${i}`,
      unit: 'W',
    });
  }
  return items;
}

/**
 * Baseline: inefficient multi-pass implementation
 * Used to compare against the optimized version
 */
export function prepareDataMultiPass(
  data: TreemapItem[],
  options: { inverse?: boolean; limit?: number; sizeMin?: number; sizeMax?: number }
): { items: TreemapItem[]; min: number; max: number } {
  const { inverse, limit, sizeMin, sizeMax } = options;

  // Pass 1: Calculate color min/max
  const colorValues = data.map(({ colorValue }) => colorValue);
  const min = Math.min(...colorValues);
  const max = Math.max(...colorValues);

  // Pass 2-4: Apply inverse sizing (3 passes!)
  if (inverse) {
    const maxSize = Math.max(...data.map(({ sizeValue }) => sizeValue));
    const minSize = Math.min(...data.map(({ sizeValue }) => sizeValue));
    for (const d of data) {
      d.sizeValue = maxSize + minSize - d.sizeValue;
    }
    const invertedMax = Math.max(...data.map(({ sizeValue }) => sizeValue));
    const minFloor = invertedMax * 0.1;
    for (const d of data) {
      if (d.sizeValue < minFloor) {
        d.sizeValue = minFloor;
      }
    }
  }

  // Pass 5: Sort
  let sortedData = [...data].sort((a, b) => b.sizeValue - a.sizeValue);

  // Pass 6: Limit
  if (limit !== undefined && limit > 0) {
    sortedData = sortedData.slice(0, limit);
  }

  // Pass 7: Apply size.max
  if (sizeMax !== undefined) {
    for (const d of sortedData) {
      if (d.sizeValue > sizeMax) {
        d.sizeValue = sizeMax;
      }
    }
  }

  // Pass 8: Calculate current max and apply size.min
  const currentMax = Math.max(...sortedData.map(({ sizeValue }) => sizeValue), 1);
  const effectiveMin = sizeMin ?? currentMax * 0.15;
  for (const d of sortedData) {
    if (d.sizeValue < effectiveMin) {
      d.sizeValue = effectiveMin;
    }
  }

  return { items: sortedData, min, max };
}
