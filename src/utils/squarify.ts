import type { TreemapItem, TreemapRect } from '../types';

/**
 * Squarified treemap algorithm
 * Based on: https://www.win.tue.nl/~vanwijk/stm.pdf
 *
 * Produces rectangles with aspect ratios as close to 1 as possible
 */

interface Container {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate the worst aspect ratio in a row
 */
function worst(row: number[], width: number): number {
  if (row.length === 0) return Infinity;

  const sum = row.reduce((a, b) => a + b, 0);
  const maxValue = Math.max(...row);
  const minValue = Math.min(...row);

  const w2 = width * width;
  const s2 = sum * sum;

  return Math.max((w2 * maxValue) / s2, s2 / (w2 * minValue));
}

/**
 * Layout a row of items within a container
 * Builds from top-left towards bottom-right (larger items in top-left, smaller in bottom-right)
 */
function layoutRow(
  row: { item: TreemapItem; normalizedValue: number }[],
  container: Container,
  vertical: boolean
): { rects: TreemapRect[]; remaining: Container } {
  const sum = row.reduce((accumulator, entry) => accumulator + entry.normalizedValue, 0);

  const rects: TreemapRect[] = [];
  let offset = 0;

  if (vertical) {
    const rowWidth = sum / container.height;

    for (const entry of row) {
      const height = entry.normalizedValue / rowWidth;
      rects.push({
        label: entry.item.label,
        value: entry.item.value,
        sizeValue: entry.item.sizeValue,
        sortValue: entry.item.sortValue,
        colorValue: entry.item.colorValue,
        entity_id: entry.item.entity_id,
        icon: entry.item.icon,
        light: entry.item.light,
        climate: entry.item.climate,
        sparklineData: entry.item.sparklineData,
        unavailable: entry.item.unavailable,
        rawState: entry.item.rawState,
        x: container.x,
        y: container.y + offset,
        width: rowWidth,
        height,
      });
      offset += height;
    }

    return {
      rects,
      remaining: {
        x: container.x + rowWidth,
        y: container.y,
        width: container.width - rowWidth,
        height: container.height,
      },
    };
  } else {
    const rowHeight = sum / container.width;

    for (const entry of row) {
      const width = entry.normalizedValue / rowHeight;
      rects.push({
        label: entry.item.label,
        value: entry.item.value,
        sizeValue: entry.item.sizeValue,
        sortValue: entry.item.sortValue,
        colorValue: entry.item.colorValue,
        entity_id: entry.item.entity_id,
        icon: entry.item.icon,
        light: entry.item.light,
        climate: entry.item.climate,
        sparklineData: entry.item.sparklineData,
        unavailable: entry.item.unavailable,
        rawState: entry.item.rawState,
        x: container.x + offset,
        y: container.y,
        width,
        height: rowHeight,
      });
      offset += width;
    }

    return {
      rects,
      remaining: {
        x: container.x,
        y: container.y + rowHeight,
        width: container.width,
        height: container.height - rowHeight,
      },
    };
  }
}

type SortBy = 'value' | 'entity_id' | 'label' | 'default';

interface SquarifyOptions {
  compressRange?: boolean;
  equalSize?: boolean;
  ascending?: boolean;
  sortBy?: SortBy;
}

/**
 * Sort items based on sortBy strategy
 */
function sortItems<T extends TreemapItem>(items: T[], sortBy: SortBy, ascending: boolean): T[] {
  if (sortBy === 'default') {
    return [...items];
  }

  return [...items].sort((a, b) => {
    let comparison: number;

    if (sortBy === 'entity_id') {
      const aId = a.entity_id ?? '';
      const bId = b.entity_id ?? '';
      comparison = aId.localeCompare(bId);
    } else if (sortBy === 'label') {
      comparison = a.label.localeCompare(b.label);
    } else {
      // sortBy === 'value': use sortValue (original signed, negated when size.inverse)
      comparison = a.sortValue - b.sortValue;
    }

    return ascending ? comparison : -comparison;
  });
}

export interface SquarifyResult {
  rects: TreemapRect[];
  rows: number; // Number of rows in the layout
}

/**
 * Simple grid layout for equal-sized rectangles
 */
function gridLayout(
  items: TreemapItem[],
  width: number,
  height: number,
  ascending = false,
  sortBy: SortBy = 'value'
): SquarifyResult {
  const n = items.length;
  if (n === 0) return { rects: [], rows: 0 };

  // Calculate optimal grid dimensions
  const aspectRatio = width / height;
  let cols = Math.ceil(Math.sqrt(n * aspectRatio));
  let rows = Math.ceil(n / cols);

  // Adjust to minimize empty cells
  while (cols * (rows - 1) >= n && rows > 1) rows--;
  while ((cols - 1) * rows >= n && cols > 1) cols--;

  const cellWidth = width / cols;
  const cellHeight = height / rows;

  // Sort items using shared sorting logic
  const sortedItems = sortItems(items, sortBy, ascending);

  const rects = sortedItems.map((item, index) => ({
    label: item.label,
    value: item.value,
    sizeValue: item.sizeValue,
    sortValue: item.sortValue,
    colorValue: item.colorValue,
    entity_id: item.entity_id,
    icon: item.icon,
    light: item.light,
    climate: item.climate,
    sparklineData: item.sparklineData,
    unavailable: item.unavailable,
    rawState: item.rawState,
    x: (index % cols) * cellWidth,
    y: Math.floor(index / cols) * cellHeight,
    width: cellWidth,
    height: cellHeight,
  }));

  return { rects, rows };
}

/**
 * Normalize and sort items for squarify algorithm
 */
function normalizeAndSort(
  items: TreemapItem[],
  compressRange: boolean,
  area: number,
  sortBy: SortBy
): { item: TreemapItem; normalizedValue: number }[] {
  const absValues = items.map(item => Math.abs(item.value));
  const maxAbs = Math.max(...absValues);

  // Compress range using sqrt so small values are still visible
  const sizeValues = compressRange
    ? absValues.map(absValue => Math.sqrt(absValue / maxAbs) * maxAbs)
    : absValues;

  const totalSizeValue = sizeValues.reduce((a, b) => a + b, 0);

  // Filter and map with indices preserved
  const validItems: { item: TreemapItem; absValue: number; sizeValue: number }[] = [];
  for (const [index, item] of items.entries()) {
    const absValue = absValues[index];
    const sizeValue = sizeValues[index];
    if (absValue !== undefined && sizeValue !== undefined && sizeValue > 0 && item) {
      validItems.push({ item, absValue, sizeValue });
    }
  }

  // Map items with normalized values
  const normalized = validItems.map(({ item, sizeValue }) => ({
    item,
    normalizedValue: (sizeValue / totalSizeValue) * area,
  }));

  // Sort based on sortBy parameter
  if (sortBy === 'default') {
    // Keep input order - no sorting
  } else if (sortBy === 'entity_id') {
    normalized.sort((a, b) => {
      const aId = a.item.entity_id ?? '';
      const bId = b.item.entity_id ?? '';
      return aId.localeCompare(bId);
    });
  } else if (sortBy === 'label') {
    normalized.sort((a, b) => a.item.label.localeCompare(b.item.label));
  } else {
    // sortBy === 'value': sort by normalizedValue (area) descending.
    // Squarify requires largest items first to produce good aspect ratios.
    // sortValue is for display order (grid layout), not layout order.
    normalized.sort((a, b) => b.normalizedValue - a.normalizedValue);
  }

  return normalized;
}

/**
 * Build a row of items that minimizes aspect ratio
 */
function buildRow(
  remaining: { item: TreemapItem; normalizedValue: number }[],
  side: number
): {
  row: { item: TreemapItem; normalizedValue: number }[];
  rowValues: number[];
  newRemaining: { item: TreemapItem; normalizedValue: number }[];
} {
  const row: { item: TreemapItem; normalizedValue: number }[] = [];
  let rowValues: number[] = [];
  let currentRemaining = [...remaining];

  while (currentRemaining.length > 0) {
    const next = currentRemaining[0];
    if (!next) break;

    const newRowValues = [...rowValues, next.normalizedValue];
    const currentWorst = worst(rowValues, side);
    const newWorst = worst(newRowValues, side);

    // Force last items together to avoid lonely items on their own row
    const forceAdd = currentRemaining.length <= 3 && rowValues.length > 0;

    if (rowValues.length > 0 && newWorst > currentWorst && !forceAdd) {
      break;
    }

    row.push(next);
    rowValues = newRowValues;
    currentRemaining = currentRemaining.slice(1);
  }

  return { row, rowValues, newRemaining: currentRemaining };
}

/**
 * Mirror layout for ascending order (smallest items top-left)
 */
function mirrorLayout(result: TreemapRect[], width: number, height: number): void {
  for (const rect of result) {
    // Mirror: new_x = width - old_x - rect_width, new_y = height - old_y - rect_height
    rect.x = width - rect.x - rect.width;
    rect.y = height - rect.y - rect.height;
  }

  // Normalize: shift all rects so the layout starts at (0,0)
  const minX = Math.min(...result.map(rect => rect.x));
  const minY = Math.min(...result.map(rect => rect.y));
  if (minX !== 0 || minY !== 0) {
    for (const rect of result) {
      rect.x -= minX;
      rect.y -= minY;
    }
  }
}

/**
 * Main squarify algorithm
 * @param items - Items with values (can be negative for losses, positive for gains)
 * @param width - Container width
 * @param height - Container height
 * @param options - Optional settings: compressRange, equalSize, ascending
 */
export function squarify(
  items: TreemapItem[],
  width: number,
  height: number,
  options: SquarifyOptions = {}
): SquarifyResult {
  const { compressRange = true, equalSize = false, ascending = false, sortBy = 'value' } = options;

  if (items.length === 0) return { rects: [], rows: 0 };

  // Use grid layout for equal sizes
  if (equalSize) {
    return gridLayout(items, width, height, ascending, sortBy);
  }

  // Check for zero values
  const absValues = items.map(item => Math.abs(item.value));
  const maxAbs = Math.max(...absValues);
  if (maxAbs === 0) return { rects: [], rows: 0 };

  // Auto-detect equal values and use grid layout for equal row heights
  // If all non-zero values are within 1% of each other, they're effectively equal
  const nonZeroValues = absValues.filter(v => v > 0);
  if (nonZeroValues.length > 1) {
    const minAbs = Math.min(...nonZeroValues);
    const valueRange = maxAbs - minAbs;
    const isEqualValues = valueRange / maxAbs < 0.01; // <1% variance
    if (isEqualValues) {
      return gridLayout(items, width, height, ascending, sortBy);
    }
  }

  const area = width * height;
  const normalized = normalizeAndSort(items, compressRange, area, sortBy);

  const result: TreemapRect[] = [];
  let container: Container = { x: 0, y: 0, width, height };
  let remaining = [...normalized];

  while (remaining.length > 0) {
    const vertical = container.width < container.height;
    const side = vertical ? container.height : container.width;

    const { row, newRemaining } = buildRow(remaining, side);
    remaining = newRemaining;

    const { rects, remaining: newContainer } = layoutRow(row, container, vertical);
    result.push(...rects);
    container = newContainer;

    // Safety check for degenerate cases
    if (container.width <= 0 || container.height <= 0) break;
  }

  // For ascending order, flip the entire layout by mirroring coordinates
  if (ascending && result.length > 0) {
    mirrorLayout(result, width, height);
  }

  // Count rows by unique Y positions
  const uniqueYPositions = new Set(result.map(rect => Math.round(rect.y * 100) / 100));
  const rows = uniqueYPositions.size;

  return { rects: result, rows };
}
