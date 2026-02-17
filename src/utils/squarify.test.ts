import { describe, expect, it } from 'vitest';
import { squarify } from './squarify';
import type { TreemapItem } from '../types';

// Helper to create test items with required fields
function makeItem(label: string, value: number, entityId?: string): TreemapItem {
  return {
    label,
    value,
    sizeValue: Math.abs(value),
    sortValue: value,
    colorValue: value,
    entity_id: entityId,
  };
}

describe('squarify', () => {
  it('returns empty array for empty input', () => {
    const { rects: result } = squarify([], 100, 100);
    expect(result).toEqual([]);
  });

  it('returns empty array when all values are zero', () => {
    const items: TreemapItem[] = [makeItem('A', 0), makeItem('B', 0)];
    const { rects: result } = squarify(items, 100, 100);
    expect(result).toEqual([]);
  });

  it('handles single item filling entire container', () => {
    const items: TreemapItem[] = [makeItem('A', 100)];
    const { rects: result } = squarify(items, 100, 100);

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
    const { rects: result } = squarify(items, 100, 100);

    expect(result).toHaveLength(2);

    // Total area should be preserved
    const totalArea = result.reduce((sum, r) => sum + r.width * r.height, 0);
    expect(totalArea).toBeCloseTo(10_000);

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
    const { rects: result } = squarify(items, 100, 100);

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
    const { rects: result } = squarify(items, 100, 100);

    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.entity_id).toBe('sensor.battery_level');
  });

  it('handles negative values using absolute value for sizing', () => {
    const items: TreemapItem[] = [makeItem('A', 50), makeItem('B', -10), makeItem('C', 50)];
    const { rects: result } = squarify(items, 100, 100);

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
    const { rects: result } = squarify(items, 100, 100);

    // All rectangles should have aspect ratio limited (max 4:1 enforced by post-processing)
    for (const rect of result) {
      const aspectRatio = Math.max(rect.width, rect.height) / Math.min(rect.width, rect.height);
      expect(aspectRatio).toBeLessThanOrEqual(4.1); // Post-process caps at 4:1
    }
  });

  it('handles non-square containers', () => {
    const items: TreemapItem[] = [makeItem('A', 50), makeItem('B', 50)];
    const { rects: result } = squarify(items, 200, 50);

    expect(result).toHaveLength(2);

    const totalArea = result.reduce((sum, r) => sum + r.width * r.height, 0);
    expect(totalArea).toBeCloseTo(10_000);
  });

  it('places largest items first by default (descending)', () => {
    const items: TreemapItem[] = [
      makeItem('Small', 10),
      makeItem('Large', 60),
      makeItem('Medium', 30),
    ];
    const { rects: result } = squarify(items, 100, 100);

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
    const { rects: descResult } = squarify(items, 100, 100, { ascending: false });

    // In descending, Large should be leftmost (smallest x)
    const descLarge = descResult.find(r => r.label === 'Large');
    const descSmall = descResult.find(r => r.label === 'Small');
    expect(descLarge).toBeDefined();
    expect(descSmall).toBeDefined();
    expect(descLarge!.x).toBeLessThan(descSmall!.x);

    const { rects: ascResult } = squarify(items, 100, 100, { ascending: true });

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

    const { rects: descResult } = squarify(items, 100, 100, { ascending: false });
    const { rects: ascResult } = squarify(items, 100, 100, { ascending: true });

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
    const { rects: descResult } = squarify(items, 100, 100, { equalSize: true, ascending: false });
    // Equal size grid, ascending
    const { rects: ascResult } = squarify(items, 100, 100, { equalSize: true, ascending: true });

    // In descending, Large should be at position 0 (top-left)
    const descFirst = descResult.find(r => r.x === 0 && r.y === 0);
    expect(descFirst?.label).toBe('Large');

    // In ascending, Small should be at position 0 (top-left)
    const ascFirst = ascResult.find(r => r.x === 0 && r.y === 0);
    expect(ascFirst?.label).toBe('Small');
  });

  it('breaks row when adding item worsens aspect ratio', () => {
    // Create items where adding the 3rd item would worsen the row's aspect ratio
    // This triggers the break condition at lines 241-243
    const items: TreemapItem[] = [
      makeItem('A', 40),
      makeItem('B', 40),
      makeItem('C', 10),
      makeItem('D', 10),
    ];
    const { rects: result } = squarify(items, 100, 100);

    expect(result).toHaveLength(4);
    // All items should be placed
    expect(result.map(rect => rect.label).sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('corrects extremely wide rectangles', () => {
    // Create a scenario that produces a wide rectangle needing correction
    // Very wide container with items of very different sizes
    const items: TreemapItem[] = [makeItem('Large', 90), makeItem('Tiny', 1)];
    // Wide container to encourage wide rectangles
    const { rects: result } = squarify(items, 200, 50);

    expect(result).toHaveLength(2);

    // All rectangles should have aspect ratio <= 4 after post-processing
    for (const rect of result) {
      const aspectRatio = Math.max(rect.width / rect.height, rect.height / rect.width);
      expect(aspectRatio).toBeLessThanOrEqual(4.1);
    }
  });

  it('corrects extremely tall rectangles', () => {
    // Create a scenario that produces a tall rectangle needing correction
    const items: TreemapItem[] = [makeItem('Large', 90), makeItem('Tiny', 1)];
    // Tall container to encourage tall rectangles
    const { rects: result } = squarify(items, 50, 200);

    expect(result).toHaveLength(2);

    // All rectangles should have aspect ratio <= 4 after post-processing
    for (const rect of result) {
      const aspectRatio = Math.max(rect.width / rect.height, rect.height / rect.width);
      expect(aspectRatio).toBeLessThanOrEqual(4.1);
    }
  });

  it('handles items that force grouping due to remaining count', () => {
    // When only 1-3 items remain and row has items, they're forced together
    // This triggers the forceAdd logic at line 239
    const items: TreemapItem[] = [
      makeItem('A', 50),
      makeItem('B', 30),
      makeItem('C', 15),
      makeItem('D', 5),
    ];
    const { rects: result } = squarify(items, 100, 100);

    expect(result).toHaveLength(4);
    // Verify all items are placed and have non-zero area
    for (const rect of result) {
      expect(rect.width * rect.height).toBeGreaterThan(0);
    }
  });

  describe('sortBy option', () => {
    describe('equal sizes', () => {
      it.each([
        {
          sortBy: 'default' as const,
          items: [
            makeItem('Zebra', 30, 'sensor.zebra'),
            makeItem('Apple', 50, 'sensor.apple'),
            makeItem('Mango', 20, 'sensor.mango'),
          ],
          expectedTopLeft: 'Zebra',
          description: 'preserves input order when sortBy is "default"',
        },
        {
          sortBy: 'entity_id' as const,
          items: [
            makeItem('Zebra', 30, 'sensor.zebra'),
            makeItem('Apple', 50, 'sensor.apple'),
            makeItem('Mango', 20, 'sensor.mango'),
          ],
          expectedTopLeft: 'Apple',
          description: 'sorts by entity_id alphabetically',
        },
        {
          sortBy: 'label' as const,
          items: [
            makeItem('Zebra Room', 30, 'sensor.z'),
            makeItem('Apple Room', 50, 'sensor.a'),
            makeItem('Mango Room', 20, 'sensor.m'),
          ],
          expectedTopLeft: 'Apple Room',
          description: 'sorts by label alphabetically',
        },
      ])('$description', ({ sortBy, items, expectedTopLeft }) => {
        const { rects: result } = squarify(items, 100, 100, {
          equalSize: true,
          sortBy,
          ascending: true,
        });

        const topLeft = result.find(r => r.x === 0 && r.y === 0);
        expect(topLeft?.label).toBe(expectedTopLeft);
      });
    });

    describe('variable sizes', () => {
      it('preserves input order when sortBy is "default"', () => {
        const items: TreemapItem[] = [
          makeItem('Small', 10, 'sensor.small'),
          makeItem('Large', 60, 'sensor.large'),
          makeItem('Medium', 30, 'sensor.medium'),
        ];

        const { rects: result } = squarify(items, 100, 100, {
          equalSize: false,
          sortBy: 'default',
        });

        // Items should maintain config order: Small first
        const labels = result.map(r => r.label);
        const smallIndex = labels.indexOf('Small');
        const largeIndex = labels.indexOf('Large');
        const mediumIndex = labels.indexOf('Medium');

        // Small should be processed before Large and Medium
        expect(smallIndex).toBeLessThan(largeIndex);
        expect(smallIndex).toBeLessThan(mediumIndex);
      });

      it('sorts by entity_id', () => {
        const items: TreemapItem[] = [
          makeItem('Cell 03', 32, 'sensor.cell_03_voltage'), // 3rd by name, medium value
          makeItem('Cell 01', 33, 'sensor.cell_01_voltage'), // 1st by name, high value
          makeItem('Cell 02', 29, 'sensor.cell_02_voltage'), // 2nd by name, low value
        ];

        const { rects: result } = squarify(items, 100, 100, {
          equalSize: false,
          sortBy: 'entity_id',
        });

        // Items should be sorted by entity_id (cell_01, cell_02, cell_03)
        // But rectangles have different sizes based on values
        const cell01 = result.find(r => r.label === 'Cell 01');
        const cell02 = result.find(r => r.label === 'Cell 02');
        const cell03 = result.find(r => r.label === 'Cell 03');

        expect(cell01).toBeDefined();
        expect(cell02).toBeDefined();
        expect(cell03).toBeDefined();

        const area01 = cell01!.width * cell01!.height;
        const area02 = cell02!.width * cell02!.height;
        const area03 = cell03!.width * cell03!.height;

        // Verify sizes reflect values: 01 > 03 > 02
        expect(area01).toBeGreaterThan(area03);
        expect(area03).toBeGreaterThan(area02);
      });
    });
  });

  describe('equal-value items bug', () => {
    it('variable-size squarify with 11 equal values should produce equal row heights', () => {
      // Reproduce the Lights card bug: 11 lights, all at 255 brightness
      const items = Array.from({ length: 11 }, (_, i) =>
        makeItem(`Light ${i + 1}`, 255, `light.${i + 1}`)
      );

      const { rects } = squarify(items, 100, 100, { equalSize: false });

      // Group rectangles by row (Y position)
      const rowMap = new Map<number, typeof rects>();
      for (const rect of rects) {
        const y = Math.round(rect.y * 10) / 10; // Round to handle floating point
        if (!rowMap.has(y)) {
          rowMap.set(y, []);
        }
        rowMap.get(y)!.push(rect);
      }

      // Extract row heights
      const rowHeights = Array.from(rowMap.values()).map(rowRects => {
        // All rects in a row should have the same height
        return rowRects[0]!.height;
      });

      // All rows should have equal height (±1% tolerance)
      const firstHeight = rowHeights[0]!;
      for (const height of rowHeights) {
        expect(height).toBeCloseTo(firstHeight, 0);
      }
    });
  });
});
