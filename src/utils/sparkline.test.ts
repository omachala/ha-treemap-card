import { describe, it, expect } from 'vitest';
import { getSparklinePoints, renderSparkline, renderSparklineWithData } from './sparkline';
import { nothing } from 'lit';

describe('getSparklinePoints', () => {
  it('generates line and fill points for simple data', () => {
    const data = [0, 50, 100];
    const { linePoints, fillPoints } = getSparklinePoints(data, { width: 100, height: 20 });

    // Line should have 3 points
    const points = linePoints.split(' ');
    expect(points).toHaveLength(3);

    // First point at x=0, last at x=100
    expect(points[0]).toMatch(/^0\.0,/);
    expect(points[2]).toMatch(/^100\.0,/);

    // Fill polygon starts at bottom-left, traces line, ends at bottom-right
    expect(fillPoints).toMatch(/^0,20 /);
    expect(fillPoints).toMatch(/ 100,20$/);
  });

  it('handles flat data (all same values)', () => {
    const data = [50, 50, 50, 50];
    const { linePoints } = getSparklinePoints(data, { width: 100, height: 20 });

    // All y values should be the same (middle of chart)
    const points = linePoints.split(' ');
    const yValues = points.map(p => Number.parseFloat(p.split(',')[1] ?? '0'));
    expect(new Set(yValues).size).toBe(1);
  });

  it('uses default width and height', () => {
    const data = [0, 100];
    const { fillPoints } = getSparklinePoints(data);

    // Default width=100, height=20
    expect(fillPoints).toContain('100,20');
  });

  it('respects custom width and height', () => {
    const data = [0, 100];
    const { fillPoints } = getSparklinePoints(data, { width: 200, height: 40 });

    expect(fillPoints).toContain('200,40');
  });

  it('normalizes data to fit within height with padding', () => {
    const data = [0, 100];
    const { linePoints } = getSparklinePoints(data, { width: 100, height: 20 });

    const points = linePoints.split(' ');
    const yValues = points.map(p => Number.parseFloat(p.split(',')[1] ?? '0'));

    // Min y should be close to 1 (top padding), max close to 19 (bottom - padding)
    expect(Math.min(...yValues)).toBeCloseTo(1, 0);
    expect(Math.max(...yValues)).toBeCloseTo(19, 0);
  });

  it('handles negative values', () => {
    const data = [-50, 0, 50];
    const { linePoints } = getSparklinePoints(data, { width: 100, height: 20 });

    const points = linePoints.split(' ');
    expect(points).toHaveLength(3);

    // Should normalize to height range
    const yValues = points.map(p => Number.parseFloat(p.split(',')[1] ?? '0'));
    expect(Math.min(...yValues)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...yValues)).toBeLessThanOrEqual(20);
  });

  it('generates correct x spacing for many data points', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const { linePoints } = getSparklinePoints(data, { width: 100, height: 20 });

    const points = linePoints.split(' ');
    expect(points).toHaveLength(11);

    const xValues = points.map(p => Number.parseFloat(p.split(',')[0] ?? '0'));
    // First x should be 0, last should be 100
    expect(xValues[0]).toBe(0);
    expect(xValues[10]).toBe(100);
    // Spacing should be even (10 intervals for 11 points)
    expect(xValues[1]).toBeCloseTo(10, 0);
  });
});

describe('renderSparkline', () => {
  it('returns SVG template result', () => {
    const data = [10, 20, 30];
    const result = renderSparkline(data);

    // Should return an object with strings property (Lit SVG template)
    expect(result).toHaveProperty('strings');
    expect(result).toHaveProperty('values');
  });

  it('returns valid template for different modes', () => {
    const data = [10, 20, 30];

    const darkResult = renderSparkline(data, { mode: 'dark' });
    expect(darkResult).toHaveProperty('strings');

    const lightResult = renderSparkline(data, { mode: 'light' });
    expect(lightResult).toHaveProperty('strings');
  });

  it('returns valid template with line hidden', () => {
    const data = [10, 20, 30];
    const result = renderSparkline(data, { line: { show: false } });

    expect(result).toHaveProperty('strings');
    // Should have nothing value for hidden line
    expect(result.values).toContain(nothing);
  });

  it('returns valid template with fill hidden', () => {
    const data = [10, 20, 30];
    const result = renderSparkline(data, { fill: { show: false } });

    expect(result).toHaveProperty('strings');
    // Should have nothing values for hidden fill
    const nothingCount = result.values.filter(v => v === nothing).length;
    expect(nothingCount).toBeGreaterThanOrEqual(1);
  });

  it('accepts custom dimensions', () => {
    const data = [10, 20, 30];
    const result = renderSparkline(data, { width: 200, height: 40 });

    expect(result).toHaveProperty('strings');
    // Width and height should be in values
    expect(result.values).toContain(200);
    expect(result.values).toContain(40);
  });

  it('accepts custom line style', () => {
    const data = [10, 20, 30];
    const result = renderSparkline(data, { line: { style: 'stroke-dasharray: 2;' } });

    expect(result).toHaveProperty('strings');
  });

  it('accepts custom fill style', () => {
    const data = [10, 20, 30];
    const result = renderSparkline(data, { fill: { style: 'fill: red;' } });

    expect(result).toHaveProperty('strings');
    // Custom fill should skip gradient (nothing in values)
    expect(result.values).toContain(nothing);
  });
});

describe('renderSparklineWithData', () => {
  it('returns nothing for undefined data', () => {
    const result = renderSparklineWithData(undefined);
    expect(result).toBe(nothing);
  });

  it('returns nothing for empty array', () => {
    const result = renderSparklineWithData([]);
    expect(result).toBe(nothing);
  });

  it('returns nothing for single data point', () => {
    const result = renderSparklineWithData([50]);
    expect(result).toBe(nothing);
  });

  it('returns sparkline for valid data (2+ points)', () => {
    const result = renderSparklineWithData([10, 20]);
    expect(result).not.toBe(nothing);
    expect(result).toHaveProperty('strings');
  });

  it('returns sparkline for many data points', () => {
    const result = renderSparklineWithData([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result).not.toBe(nothing);
    expect(result).toHaveProperty('strings');
  });

  it('passes options through to renderSparkline', () => {
    const result = renderSparklineWithData([10, 20, 30], { width: 150, height: 30 });

    expect(result).not.toBe(nothing);
    // Result is SVGTemplateResult with values array
    if (result !== nothing && 'values' in result) {
      expect(result.values).toContain(150);
      expect(result.values).toContain(30);
    }
  });
});
