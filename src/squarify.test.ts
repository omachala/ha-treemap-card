import { describe, expect, it } from 'vitest';
import { squarify } from './squarify';
import type { TreemapItem } from './types';

// Helper to create test items with required fields
function makeItem(label: string, value: number, entityId?: string): TreemapItem {
  return {
    label,
    value,
    sizeValue: Math.abs(value),
    colorValue: value,
    entity_id: entityId,
  };
}

describe('squarify', () => {
  it('returns empty array for empty input', () => {
    const result = squarify([], 100, 100);
    expect(result).toEqual([]);
  });

  it('returns empty array when all values are zero', () => {
    const items: TreemapItem[] = [makeItem('A', 0), makeItem('B', 0)];
    const result = squarify(items, 100, 100);
    expect(result).toEqual([]);
  });

  it('handles single item filling entire container', () => {
    const items: TreemapItem[] = [makeItem('A', 100)];
    const result = squarify(items, 100, 100);

    expect(result).toHaveLength(1);
    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.label).toBe('A');
    expect(first?.x).toBeCloseTo(0);
    expect(first?.y).toBeCloseTo(0);
    expect(first?.width).toBeCloseTo(100);
    expect(first?.height).toBeCloseTo(100);
  });

  it('splits two equal items', () => {
    const items: TreemapItem[] = [makeItem('A', 50), makeItem('B', 50)];
    const result = squarify(items, 100, 100);

    expect(result).toHaveLength(2);

    // Total area should be preserved
    const totalArea = result.reduce((sum, r) => sum + r.width * r.height, 0);
    expect(totalArea).toBeCloseTo(10000);

    // Each item should have roughly half the area
    for (const rect of result) {
      expect(rect.width * rect.height).toBeCloseTo(5000);
    }
  });

  it('handles multiple items with different values', () => {
    const items: TreemapItem[] = [
      makeItem('Large', 60),
      makeItem('Medium', 30),
      makeItem('Small', 10),
    ];
    const result = squarify(items, 100, 100);

    expect(result).toHaveLength(3);

    // Find items by label
    const large = result.find(r => r.label === 'Large');
    const medium = result.find(r => r.label === 'Medium');
    const small = result.find(r => r.label === 'Small');

    expect(large).toBeDefined();
    expect(medium).toBeDefined();
    expect(small).toBeDefined();

    // Areas should be proportional to values (relative order should be preserved)
    const largeArea = large!.width * large!.height;
    const mediumArea = medium!.width * medium!.height;
    const smallArea = small!.width * small!.height;

    expect(largeArea).toBeGreaterThan(mediumArea);
    expect(mediumArea).toBeGreaterThan(smallArea);

    // Note: Total area may be less than container due to aspect ratio limiting
    // which shrinks very elongated rectangles for better visual appearance
    expect(largeArea + mediumArea + smallArea).toBeGreaterThan(9000);
  });

  it('preserves entity_id in output', () => {
    const items: TreemapItem[] = [makeItem('Battery', 80, 'sensor.battery_level')];
    const result = squarify(items, 100, 100);

    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.entity_id).toBe('sensor.battery_level');
  });

  it('handles negative values using absolute value for sizing', () => {
    const items: TreemapItem[] = [makeItem('A', 50), makeItem('B', -10), makeItem('C', 50)];
    const result = squarify(items, 100, 100);

    // All items should be included (negative values sized by absolute value)
    expect(result).toHaveLength(3);
    const itemB = result.find(r => r.label === 'B');
    expect(itemB).toBeDefined();
    // B should preserve its original negative value
    expect(itemB!.value).toBe(-10);
  });

  it('produces reasonable aspect ratios', () => {
    const items: TreemapItem[] = [
      makeItem('A', 25),
      makeItem('B', 25),
      makeItem('C', 25),
      makeItem('D', 25),
    ];
    const result = squarify(items, 100, 100);

    // All rectangles should have aspect ratio limited (max 4:1 enforced by post-processing)
    for (const rect of result) {
      const aspectRatio = Math.max(rect.width, rect.height) / Math.min(rect.width, rect.height);
      expect(aspectRatio).toBeLessThanOrEqual(4.1); // Post-process caps at 4:1
    }
  });

  it('handles non-square containers', () => {
    const items: TreemapItem[] = [makeItem('A', 50), makeItem('B', 50)];
    const result = squarify(items, 200, 50);

    expect(result).toHaveLength(2);

    const totalArea = result.reduce((sum, r) => sum + r.width * r.height, 0);
    expect(totalArea).toBeCloseTo(10000);
  });

  it('places largest items first by default (descending)', () => {
    const items: TreemapItem[] = [
      makeItem('Small', 10),
      makeItem('Large', 60),
      makeItem('Medium', 30),
    ];
    const result = squarify(items, 100, 100);

    // Sort by position (top-left first)
    const sorted = [...result].sort((a, b) => {
      if (Math.abs(a.y - b.y) > 1) return a.y - b.y;
      return a.x - b.x;
    });

    // Largest should be first (top-left position)
    expect(sorted[0]?.label).toBe('Large');
  });

  it('places smallest items first when ascending=true', () => {
    const items: TreemapItem[] = [
      makeItem('Small', 10),
      makeItem('Large', 60),
      makeItem('Medium', 30),
    ];

    // First check descending (default)
    const descResult = squarify(items, 100, 100, { ascending: false });

    // In descending, Large should be leftmost (smallest x)
    const descLarge = descResult.find(r => r.label === 'Large');
    const descSmall = descResult.find(r => r.label === 'Small');
    expect(descLarge).toBeDefined();
    expect(descSmall).toBeDefined();
    expect(descLarge!.x).toBeLessThan(descSmall!.x);

    const ascResult = squarify(items, 100, 100, { ascending: true });

    // In ascending, Small should be leftmost (smallest x)
    const ascLarge = ascResult.find(r => r.label === 'Large');
    const ascSmall = ascResult.find(r => r.label === 'Small');
    expect(ascLarge).toBeDefined();
    expect(ascSmall).toBeDefined();
    expect(ascSmall!.x).toBeLessThan(ascLarge!.x);
  });

  it('maintains correct sizes regardless of ascending order', () => {
    const items: TreemapItem[] = [
      makeItem('Small', 10),
      makeItem('Large', 60),
      makeItem('Medium', 30),
    ];

    const descResult = squarify(items, 100, 100, { ascending: false });
    const ascResult = squarify(items, 100, 100, { ascending: true });

    // Find Large in both results
    const largeDesc = descResult.find(r => r.label === 'Large');
    const largeAsc = ascResult.find(r => r.label === 'Large');

    // Large should have the same area in both (size is not affected by order)
    const areaDesc = largeDesc!.width * largeDesc!.height;
    const areaAsc = largeAsc!.width * largeAsc!.height;

    expect(areaDesc).toBeCloseTo(areaAsc, 0);
  });

  it('grid layout respects ascending order', () => {
    const items: TreemapItem[] = [
      makeItem('Small', 10),
      makeItem('Large', 60),
      makeItem('Medium', 30),
    ];

    // Equal size grid, descending (default)
    const descResult = squarify(items, 100, 100, { equalSize: true, ascending: false });
    // Equal size grid, ascending
    const ascResult = squarify(items, 100, 100, { equalSize: true, ascending: true });

    // In descending, Large should be at position 0 (top-left)
    const descFirst = descResult.find(r => r.x === 0 && r.y === 0);
    expect(descFirst?.label).toBe('Large');

    // In ascending, Small should be at position 0 (top-left)
    const ascFirst = ascResult.find(r => r.x === 0 && r.y === 0);
    expect(ascFirst?.label).toBe('Small');
  });
});
