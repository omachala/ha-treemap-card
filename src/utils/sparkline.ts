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
  height?: number; // Height as percentage of total (default: 15)
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
 * Get default HVAC bar colors based on mode.
 */
function getHvacColors(
  mode: SparklineMode,
  hvacOptions?: SparklineHvacOptions
): { heating: string; cooling: string } {
  // User-defined colors take precedence
  if (hvacOptions?.heatingColor || hvacOptions?.coolingColor) {
    return {
      heating: hvacOptions.heatingColor || (mode === 'light' ? '#ff6b35' : '#ff8c42'),
      cooling: hvacOptions.coolingColor || (mode === 'light' ? '#4a90d9' : '#64b5f6'),
    };
  }

  // Default colors based on mode
  if (mode === 'light') {
    return {
      heating: 'rgba(255, 107, 53, 0.5)', // Orange with transparency
      cooling: 'rgba(74, 144, 217, 0.5)', // Blue with transparency
    };
  }
  return {
    heating: 'rgba(255, 140, 66, 0.4)', // Lighter orange for dark backgrounds
    cooling: 'rgba(100, 181, 246, 0.4)', // Lighter blue for dark backgrounds
  };
}

/**
 * Render HVAC action bars at the bottom of the sparkline.
 */
function renderHvacBars(
  segments: HvacActionSegment[],
  width: number,
  height: number,
  barHeight: number,
  colors: { heating: string; cooling: string }
): SVGTemplateResult {
  const yPosition = height - barHeight;

  return svg`
    ${segments.map(segment => {
      const x = segment.start * width;
      const w = (segment.end - segment.start) * width;
      const color = segment.action === 'heating' ? colors.heating : colors.cooling;

      return svg`<rect
        x="${x.toFixed(1)}"
        y="${yPosition.toFixed(1)}"
        width="${Math.max(0.5, w).toFixed(1)}"
        height="${barHeight.toFixed(1)}"
        fill="${color}"
      />`;
    })}
  `;
}

/**
 * Render a sparkline SVG with gradient fill, line, and optional HVAC bars.
 */
export function renderSparkline(
  data: number[],
  options: SparklineOptions = {},
  hvacActions?: HvacActionSegment[]
): SVGTemplateResult {
  const { width = 100, height = 20, mode = 'dark', line, fill, hvac } = options;

  // Calculate HVAC bar dimensions
  const showHvac = hvac?.show !== false && hvacActions && hvacActions.length > 0;
  const hvacBarHeight = showHvac ? (hvac?.height ?? 15) * (height / 100) : 0;

  const { linePoints, fillPoints } = getSparklinePoints(data, options, hvacBarHeight);
  const colors = getSparklineColors(mode);
  const hvacColors = getHvacColors(mode, hvac);

  const showFill = fill?.show !== false;
  const showLine = line?.show !== false; // Line visible by default

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
      ${showFill ? svg`<polygon points="${fillPoints}" style="${fillStyle}" />` : nothing}
      ${showLine ? svg`<polyline points="${linePoints}" style="fill: none; stroke-linecap: round; stroke-linejoin: round; ${lineStyle}" />` : nothing}
      ${showHvac ? renderHvacBars(hvacActions, width, height, hvacBarHeight, hvacColors) : nothing}
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
    if (sparklineData.temperature && sparklineData.temperature.length > 1) {
      return renderSparkline(sparklineData.temperature, options, sparklineData.hvacActions);
    }
    return nothing;
  }

  // Handle raw number array (legacy support)
  if (Array.isArray(data) && data.length > 1) {
    return renderSparkline(data, options);
  }
  return nothing;
}
