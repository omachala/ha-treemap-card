import type { TreemapItem, TreemapRect } from './types';

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
  const maxVal = Math.max(...row);
  const minVal = Math.min(...row);

  const w2 = width * width;
  const s2 = sum * sum;

  return Math.max((w2 * maxVal) / s2, s2 / (w2 * minVal));
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
  const sum = row.reduce((acc, r) => acc + r.normalizedValue, 0);

  const rects: TreemapRect[] = [];
  let offset = 0;

  if (vertical) {
    const rowWidth = sum / container.height;

    for (const r of row) {
      const height = r.normalizedValue / rowWidth;
      rects.push({
        label: r.item.label,
        value: r.item.value,
        sizeValue: r.item.sizeValue,
        colorValue: r.item.colorValue,
        entity_id: r.item.entity_id,
        icon: r.item.icon,
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

    for (const r of row) {
      const width = r.normalizedValue / rowHeight;
      rects.push({
        label: r.item.label,
        value: r.item.value,
        sizeValue: r.item.sizeValue,
        colorValue: r.item.colorValue,
        entity_id: r.item.entity_id,
        icon: r.item.icon,
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

interface SquarifyOptions {
  compressRange?: boolean;
  equalSize?: boolean;
  ascending?: boolean;
}

/**
 * Simple grid layout for equal-sized rectangles
 */
function gridLayout(
  items: TreemapItem[],
  width: number,
  height: number,
  ascending = false
): TreemapRect[] {
  const n = items.length;
  if (n === 0) return [];

  // Calculate optimal grid dimensions
  const aspectRatio = width / height;
  let cols = Math.ceil(Math.sqrt(n * aspectRatio));
  let rows = Math.ceil(n / cols);

  // Adjust to minimize empty cells
  while (cols * (rows - 1) >= n && rows > 1) rows--;
  while ((cols - 1) * rows >= n && cols > 1) cols--;

  const cellWidth = width / cols;
  const cellHeight = height / rows;

  // Sort items by value for grid layout
  const sortedItems = [...items].sort((a, b) =>
    ascending ? a.value - b.value : b.value - a.value
  );

  return sortedItems.map((item, i) => ({
    label: item.label,
    value: item.value,
    sizeValue: item.sizeValue,
    colorValue: item.colorValue,
    entity_id: item.entity_id,
    icon: item.icon,
    x: (i % cols) * cellWidth,
    y: Math.floor(i / cols) * cellHeight,
    width: cellWidth,
    height: cellHeight,
  }));
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
): TreemapRect[] {
  const { compressRange = true, equalSize = false, ascending = false } = options;

  if (items.length === 0) return [];

  // Use grid layout for equal sizes
  if (equalSize) {
    return gridLayout(items, width, height, ascending);
  }

  // Use absolute values for sizing (we want small losses to show as small, big losses as big)
  const absValues = items.map(item => Math.abs(item.value));
  const maxAbs = Math.max(...absValues);
  if (maxAbs === 0) return [];

  const area = width * height;

  // Compress range using sqrt so small values are still visible
  // sqrt(1) = 1, sqrt(100) = 10, so 1% becomes 10% of max instead of 1%
  const sizeValues = compressRange ? absValues.map(v => Math.sqrt(v / maxAbs) * maxAbs) : absValues;

  const totalSizeValue = sizeValues.reduce((a, b) => a + b, 0);

  // Filter and map with indices preserved
  const validItems: { item: TreemapItem; absValue: number; sizeValue: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const absValue = absValues[i];
    const sizeValue = sizeValues[i];
    const item = items[i];
    if (absValue !== undefined && absValue > 0 && sizeValue !== undefined && item) {
      validItems.push({ item, absValue, sizeValue });
    }
  }

  // Always sort descending for optimal layout - we'll flip coordinates later if ascending
  const normalized = validItems
    .map(({ item, sizeValue }) => ({
      item,
      normalizedValue: (sizeValue / totalSizeValue) * area,
    }))
    .sort((a, b) => b.normalizedValue - a.normalizedValue);

  const result: TreemapRect[] = [];
  let container: Container = { x: 0, y: 0, width, height };
  let remaining = [...normalized];

  while (remaining.length > 0) {
    const vertical = container.width < container.height;
    const side = vertical ? container.height : container.width;

    const row: { item: TreemapItem; normalizedValue: number }[] = [];
    let rowValues: number[] = [];

    // Add items to row while aspect ratio improves
    while (remaining.length > 0) {
      const next = remaining[0];
      if (!next) break;

      const newRowValues = [...rowValues, next.normalizedValue];
      const currentWorst = worst(rowValues, side);
      const newWorst = worst(newRowValues, side);

      // Force last items together to avoid lonely items on their own row
      // If only 1-3 items remain and we already have some in row, keep adding
      const forceAdd = remaining.length <= 3 && rowValues.length > 0;

      if (rowValues.length > 0 && newWorst > currentWorst && !forceAdd) {
        break;
      }

      row.push(next);
      rowValues = newRowValues;
      remaining = remaining.slice(1);
    }

    // Layout the row
    const { rects, remaining: newContainer } = layoutRow(row, container, vertical);
    result.push(...rects);
    container = newContainer;

    // Safety check for degenerate cases
    if (container.width <= 0 || container.height <= 0) break;
  }

  // Post-process: fix rectangles with extreme aspect ratios (> 4:1)
  // This happens when a small item is left alone at the end
  const maxAspectRatio = 4;
  for (const rect of result) {
    const aspectRatio = Math.max(rect.width / rect.height, rect.height / rect.width);
    if (aspectRatio > maxAspectRatio) {
      // Shrink the long dimension to achieve max aspect ratio
      if (rect.width > rect.height) {
        // Too wide - shrink width, keep centered
        const newWidth = rect.height * maxAspectRatio;
        rect.x = rect.x + (rect.width - newWidth) / 2;
        rect.width = newWidth;
      } else {
        // Too tall - shrink height, keep centered
        const newHeight = rect.width * maxAspectRatio;
        rect.y = rect.y + (rect.height - newHeight) / 2;
        rect.height = newHeight;
      }
    }
  }

  // For ascending order, flip the entire layout by mirroring coordinates
  // This puts smallest items top-left while keeping their original sizes
  if (ascending && result.length > 0) {
    for (const rect of result) {
      // Mirror: new_x = width - old_x - rect_width, new_y = height - old_y - rect_height
      rect.x = width - rect.x - rect.width;
      rect.y = height - rect.y - rect.height;
    }

    // Normalize: shift all rects so the layout starts at (0,0)
    // This is needed because aspect ratio post-processing may leave gaps
    const minX = Math.min(...result.map(r => r.x));
    const minY = Math.min(...result.map(r => r.y));
    if (minX !== 0 || minY !== 0) {
      for (const rect of result) {
        rect.x -= minX;
        rect.y -= minY;
      }
    }
  }

  return result;
}
