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
function getSparklineColors(mode: SparklineMode): { line: string; fill: string } {
  if (mode === 'light') {
    return {
      line: 'rgba(255, 255, 255, 0.25)',
      fill: 'rgba(255, 255, 255, 0.15)',
    };
  }
  // dark mode (default)
  return {
    line: 'rgba(0, 0, 0, 0.2)',
    fill: 'rgba(0, 0, 0, 0.12)',
  };
}

/**
 * Render a sparkline SVG with fill and line.
 */
export function renderSparkline(data: number[], options: SparklineOptions = {}): SVGTemplateResult {
  const { width = 100, height = 20, mode = 'dark', line, fill } = options;
  const { linePoints, fillPoints } = getSparklinePoints(data, options);
  const colors = getSparklineColors(mode);

  const showFill = fill?.show !== false;
  const showLine = line?.show !== false;

  // Build styles: custom style overrides defaults
  const fillStyle = fill?.style || `fill: ${colors.fill};`;
  const lineStyle = line?.style || `stroke: ${colors.line}; stroke-width: 1.5;`;

  return svg`
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
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
