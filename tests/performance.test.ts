/**
 * Performance regression tests for treemap card
 *
 * These tests ensure optimized implementations remain faster than baseline.
 * Run with: pnpm test:run tests/performance.test.ts
 */

import { describe, it, expect } from 'vitest';
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

// Performance threshold: optimized must be at least this much faster
// Measured: ~2x speedup. Set to 1.7x to allow for variance on slower machines/CI.
const MIN_SPEEDUP = 1.7;

describe('Performance regression guard', () => {
  it('prepareTreemapData should be faster than multi-pass baseline', () => {
    const warmupIterations = 50;
    const iterations = 500;
    const testData = generateMockItems(200);

    // Warmup both implementations (JIT compilation)
    for (let i = 0; i < warmupIterations; i++) {
      const items = testData.map(d => ({ ...d }));
      prepareDataMultiPass(items, { inverse: true });
      prepareTreemapData(items, { inverse: true });
    }

    // Measure baseline (multi-pass)
    const baselineStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const items = testData.map(d => ({ ...d }));
      prepareDataMultiPass(items, { inverse: true });
    }
    const baselineTime = performance.now() - baselineStart;

    // Measure actual implementation
    const actualStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const items = testData.map(d => ({ ...d }));
      prepareTreemapData(items, { inverse: true });
    }
    const actualTime = performance.now() - actualStart;

    const speedup = baselineTime / actualTime;
    console.log(
      `Performance: baseline=${baselineTime.toFixed(2)}ms, actual=${actualTime.toFixed(2)}ms, speedup=${speedup.toFixed(2)}x`
    );

    // Assert that actual implementation is faster
    expect(speedup).toBeGreaterThanOrEqual(MIN_SPEEDUP);
  });
});
