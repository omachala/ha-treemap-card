import { svg, nothing, type SVGTemplateResult } from 'lit';
import type { SparklineData, HvacActionSegment } from './history';

export type SparklineMode = 'light' | 'dark';

export interface SparklineLineOptions {
  show?: boolean;
  style?: string;
}

export interface SparklineFillOptions {
  show?: boolean;
  style?: string;
}

export interface SparklineHvacOptions {
  show?: boolean;
  heatingColor?: string;
  coolingColor?: string;
}

export interface SparklineOptions {
  width?: number;
  height?: number;
  mode?: SparklineMode;
  line?: SparklineLineOptions;
  fill?: SparklineFillOptions;
  hvac?: SparklineHvacOptions;
  periodHours?: number; // For HVAC quantization (default: 24)
}

/**
 * Convert data points to SVG coordinate strings for polyline and polygon.
 */
export function getSparklinePoints(
  data: number[],
  options: SparklineOptions = {},
  bottomPadding = 0
): { linePoints: string; fillPoints: string } {
  const { width = 100, height = 20 } = options;
  const verticalPadding = 1; // Small padding top/bottom for line visibility
  const effectiveHeight = height - bottomPadding;

  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const range = maxValue - minValue || 1;

  const linePoints = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y =
        effectiveHeight -
        verticalPadding -
        ((value - minValue) / range) * (effectiveHeight - verticalPadding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Polygon points: start at bottom-left, trace the line, end at bottom-right
  const fillPoints = `0,${effectiveHeight} ${linePoints} ${width},${effectiveHeight}`;

  return { linePoints, fillPoints };
}

/**
 * Get sparkline colors based on mode.
 */
function getSparklineColors(mode: SparklineMode): {
  line: string;
  fillTop: string;
  fillBottom: string;
} {
  if (mode === 'light') {
    return {
      line: 'rgba(255, 255, 255, 0.25)',
      fillTop: 'rgba(255, 255, 255, 0.25)',
      fillBottom: 'rgba(255, 255, 255, 0.12)',
    };
  }
  // dark mode (default)
  return {
    line: 'rgba(0, 0, 0, 0.15)',
    fillTop: 'rgba(0, 0, 0, 0.2)',
    fillBottom: 'rgba(0, 0, 0, 0.1)',
  };
}

// Counter for unique gradient IDs
let gradientIdCounter = 0;

/**
 * Get default HVAC fill colors based on mode.
 * Uses the same colors as sparkline line/fill for heating, blue for cooling.
 */
function getHvacColors(
  mode: SparklineMode,
  hvacOptions?: SparklineHvacOptions
): { heating: string; cooling: string } {
  // User-defined colors take precedence
  if (hvacOptions?.heatingColor || hvacOptions?.coolingColor) {
    return {
      heating:
        hvacOptions.heatingColor ||
        (mode === 'light' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)'),
      cooling: hvacOptions.coolingColor || (mode === 'light' ? '#4a90d9' : '#64b5f6'),
    };
  }

  // Default: heating uses same color as sparkline fill but more opaque, cooling uses blue
  if (mode === 'light') {
    return {
      heating: 'rgba(255, 255, 255, 0.4)', // Same as sparkline fill (light mode)
      cooling: 'rgba(74, 144, 217, 0.6)', // Blue for cooling
    };
  }
  return {
    heating: 'rgba(0, 0, 0, 0.35)', // Same as sparkline fill (dark mode), more visible
    cooling: 'rgba(100, 181, 246, 0.5)', // Blue for cooling
  };
}

/**
 * Quantize HVAC segments into 15-minute blocks.
 * If ANY heating/cooling occurred in a 15-min block, mark that whole block as active.
 */
function quantizeHvacSegments(
  segments: HvacActionSegment[],
  periodHours: number
): ('heating' | 'cooling' | null)[] {
  const blocksPerHour = 4; // 15-minute blocks
  const totalBlocks = periodHours * blocksPerHour;
  const blocks: ('heating' | 'cooling' | null)[] = Array.from({ length: totalBlocks }, () => null);

  for (const segment of segments) {
    // Only process heating/cooling, ignore idle/off
    if (segment.action !== 'heating' && segment.action !== 'cooling') continue;

    // segment.start and segment.end are 0-1 normalized positions
    const startBlock = Math.floor(segment.start * totalBlocks);
    const endBlock = Math.ceil(segment.end * totalBlocks);

    for (let i = startBlock; i < endBlock && i < totalBlocks; i++) {
      if (i >= 0) {
        // Heating takes precedence over cooling if both present
        if (segment.action === 'heating' || blocks[i] !== 'heating') {
          blocks[i] = segment.action;
        }
      }
    }
  }

  return blocks;
}

interface HvacFillOptions {
  segments: HvacActionSegment[];
  data: number[];
  width: number;
  height: number;
  colors: { heating: string; cooling: string };
  periodHours: number;
}

/**
 * Render HVAC-colored fill sections under the sparkline.
 */
function renderHvacFill(options: HvacFillOptions): SVGTemplateResult {
  const { segments, data, width, height, colors, periodHours } = options;
  if (data.length < 2) return svg``;

  const blocks = quantizeHvacSegments(segments, periodHours);
  const totalBlocks = blocks.length;

  // Calculate min/max for y-scaling
  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const range = maxValue - minValue || 1;
  const verticalPadding = 1;

  // Helper to get Y coordinate for a data point
  const getY = (value: number) =>
    height - verticalPadding - ((value - minValue) / range) * (height - verticalPadding * 2);

  // Helper to get data value at a given x position (0-1)
  const getValueAt = (xPos: number) => {
    const dataIndex = xPos * (data.length - 1);
    const lower = Math.floor(dataIndex);
    const upper = Math.min(Math.ceil(dataIndex), data.length - 1);
    const t = dataIndex - lower;
    return (data[lower] ?? 0) * (1 - t) + (data[upper] ?? 0) * t;
  };

  // Group consecutive blocks with same action
  const regions: { start: number; end: number; action: 'heating' | 'cooling' }[] = [];
  let currentRegion: { start: number; end: number; action: 'heating' | 'cooling' } | null = null;

  for (let i = 0; i < totalBlocks; i++) {
    const action = blocks[i];
    if (action) {
      if (currentRegion !== null && currentRegion.action === action) {
        currentRegion.end = (i + 1) / totalBlocks;
      } else {
        if (currentRegion) regions.push(currentRegion);
        currentRegion = { start: i / totalBlocks, end: (i + 1) / totalBlocks, action };
      }
    } else if (currentRegion) {
      regions.push(currentRegion);
      currentRegion = null;
    }
  }
  if (currentRegion) regions.push(currentRegion);

  // Render each region as a polygon
  return svg`
    ${regions.map(region => {
      const color = region.action === 'heating' ? colors.heating : colors.cooling;
      const steps = 10; // Points along the top edge for smooth curve
      const stepSize = (region.end - region.start) / steps;

      // Build polygon points: bottom-left, along curve, bottom-right
      let points = `${(region.start * width).toFixed(1)},${height}`;

      // Top edge following the sparkline
      for (let i = 0; i <= steps; i++) {
        const xPos = region.start + i * stepSize;
        const x = xPos * width;
        const y = getY(getValueAt(xPos));
        points += ` ${x.toFixed(1)},${y.toFixed(1)}`;
      }

      // Close at bottom-right
      points += ` ${(region.end * width).toFixed(1)},${height}`;

      return svg`<polygon points="${points}" fill="${color}" />`;
    })}
  `;
}

/**
 * Render a sparkline SVG with gradient fill, line, and optional HVAC colored regions.
 */
export function renderSparkline(
  data: number[],
  options: SparklineOptions = {},
  hvacActions?: HvacActionSegment[]
): SVGTemplateResult {
  const { width = 100, height = 20, mode = 'dark', line, fill, hvac, periodHours = 24 } = options;

  // Only render line/fill if we have temperature data
  const hasData = data.length > 1;
  const showHvac = hvac?.show !== false && hvacActions && hvacActions.length > 0;

  const { linePoints, fillPoints } = hasData
    ? getSparklinePoints(data, options, 0)
    : { linePoints: '', fillPoints: '' };
  const colors = getSparklineColors(mode);
  const hvacColors = getHvacColors(mode, hvac);

  const showFill = fill?.show !== false && hasData;
  const showLine = line?.show !== false && hasData; // Line visible by default

  // Generate unique gradient ID for this sparkline
  const gradientId = `sparkline-gradient-${gradientIdCounter++}`;

  // Custom fill style overrides gradient
  const useCustomFill = !!fill?.style;
  const fillStyle = fill?.style || `fill: url(#${gradientId});`;
  // Default stroke color is always applied, custom style can override or add properties
  const defaultLineStyle = `stroke: ${colors.line}; stroke-width: 1.5;`;
  const lineStyle = line?.style ? `${defaultLineStyle} ${line.style}` : defaultLineStyle;

  return svg`
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      ${
        showFill && !useCustomFill
          ? svg`
        <defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color: ${colors.fillTop};" />
            <stop offset="100%" style="stop-color: ${colors.fillBottom};" />
          </linearGradient>
        </defs>
      `
          : nothing
      }
      ${showHvac && hasData ? renderHvacFill({ segments: hvacActions, data, width, height, colors: hvacColors, periodHours }) : nothing}
      ${showFill && !hvacActions ? svg`<polygon points="${fillPoints}" style="${fillStyle}" />` : nothing}
      ${showLine ? svg`<polyline points="${linePoints}" style="fill: none; stroke-linecap: round; stroke-linejoin: round; ${lineStyle}" />` : nothing}
    </svg>
  `;
}

/**
 * Render a sparkline with real data only.
 * Returns nothing if no data available.
 * Accepts either raw number array or SparklineData object with temperature and hvacActions.
 */
export function renderSparklineWithData(
  data: number[] | SparklineData | undefined,
  options: SparklineOptions = {}
): SVGTemplateResult | typeof nothing {
  // Handle SparklineData object
  if (data && typeof data === 'object' && 'temperature' in data) {
    const sparklineData = data;
    const hasTemperature = sparklineData.temperature && sparklineData.temperature.length > 1;
    const hasHvacActions = sparklineData.hvacActions && sparklineData.hvacActions.length > 0;

    // Render if we have temperature data OR hvac actions
    if (hasTemperature || hasHvacActions) {
      return renderSparkline(
        hasTemperature ? sparklineData.temperature : [],
        options,
        sparklineData.hvacActions
      );
    }
    return nothing;
  }

  // Handle raw number array (legacy support)
  if (Array.isArray(data) && data.length > 1) {
    return renderSparkline(data, options);
  }
  return nothing;
}
