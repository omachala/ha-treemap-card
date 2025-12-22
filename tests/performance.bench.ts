/**
 * Performance benchmarks for treemap card
 *
 * Run benchmarks: pnpm vitest bench
 * For regression tests, see performance.test.ts
 */

import { bench, describe } from 'vitest';
import type { TreemapItem } from '../src/types';
import { prepareTreemapData } from '../src/utils/data';

// Generate mock data similar to what _resolveData returns
function generateMockItems(count: number): TreemapItem[] {
  const items: TreemapItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      label: `Entity ${i}`,
      value: Math.random() * 100,
      sizeValue: Math.random() * 100,
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
function prepareDataMultiPass(
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

// Test data sets
const data50 = generateMockItems(50);
const data200 = generateMockItems(200);
const data500 = generateMockItems(500);

describe('Data preparation - 50 items', () => {
  bench('multi-pass (baseline)', () => {
    const items = data50.map(d => ({ ...d })); // Clone to avoid mutation issues
    prepareDataMultiPass(items, { inverse: true });
  });

  bench('prepareTreemapData (actual)', () => {
    const items = data50.map(d => ({ ...d }));
    prepareTreemapData(items, { inverse: true });
  });
});

describe('Data preparation - 200 items', () => {
  bench('multi-pass (baseline)', () => {
    const items = data200.map(d => ({ ...d }));
    prepareDataMultiPass(items, { inverse: true });
  });

  bench('prepareTreemapData (actual)', () => {
    const items = data200.map(d => ({ ...d }));
    prepareTreemapData(items, { inverse: true });
  });
});

describe('Data preparation - 500 items', () => {
  bench('multi-pass (baseline)', () => {
    const items = data500.map(d => ({ ...d }));
    prepareDataMultiPass(items, { inverse: true });
  });

  bench('prepareTreemapData (actual)', () => {
    const items = data500.map(d => ({ ...d }));
    prepareTreemapData(items, { inverse: true });
  });
});
