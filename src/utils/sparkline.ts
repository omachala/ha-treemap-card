import { svg, nothing, type SVGTemplateResult } from 'lit';

export type SparklineMode = 'light' | 'dark';

export interface SparklineLineOptions {
  show?: boolean;
  style?: string;
}

export interface SparklineFillOptions {
  show?: boolean;
  style?: string;
}

export interface SparklineOptions {
  width?: number;
  height?: number;
  mode?: SparklineMode;
  line?: SparklineLineOptions;
  fill?: SparklineFillOptions;
}

/**
 * Convert data points to SVG coordinate strings for polyline and polygon.
 */
export function getSparklinePoints(
  data: number[],
  options: SparklineOptions = {}
): { linePoints: string; fillPoints: string } {
  const { width = 100, height = 20 } = options;
  const verticalPadding = 1; // Small padding top/bottom for line visibility

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  const linePoints = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y =
        height - verticalPadding - ((val - minVal) / range) * (height - verticalPadding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Polygon points: start at bottom-left, trace the line, end at bottom-right
  const fillPoints = `0,${height} ${linePoints} ${width},${height}`;

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
 * Render a sparkline SVG with gradient fill and line.
 */
export function renderSparkline(data: number[], options: SparklineOptions = {}): SVGTemplateResult {
  const { width = 100, height = 20, mode = 'dark', line, fill } = options;
  const { linePoints, fillPoints } = getSparklinePoints(data, options);
  const colors = getSparklineColors(mode);

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
    </svg>
  `;
}

/**
 * Render a sparkline with real data only.
 * Returns nothing if no data available.
 */
export function renderSparklineWithData(
  data: number[] | undefined,
  options: SparklineOptions = {}
): SVGTemplateResult | typeof nothing {
  if (data && data.length > 1) {
    return renderSparkline(data, options);
  }
  return nothing;
}
