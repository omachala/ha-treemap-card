/**
 * Number formatting utility
 *
 * Supports:
 *   precision: 0    - whole number (1234)
 *   precision: 1    - 1 decimal place (1234.5)
 *   precision: 2    - 2 decimal places (1234.50)
 *   abbreviate: true - abbreviated (1k, 2M, 3B, 4T)
 */

const ABBREVIATIONS = [
  { threshold: 1e12, suffix: 'T' },
  { threshold: 1e9, suffix: 'B' },
  { threshold: 1e6, suffix: 'M' },
  { threshold: 1e3, suffix: 'k' },
];

/**
 * Format a number with specified precision and optional abbreviation
 * @param value - The number to format
 * @param precision - Number of decimal places (default: 1)
 * @param abbreviate - Whether to abbreviate large numbers (default: false)
 * @returns Formatted string
 */
export function formatNumber(value: number, precision = 1, abbreviate = false): string {
  let displayValue = value;
  let suffix = '';

  if (abbreviate) {
    for (const abbr of ABBREVIATIONS) {
      if (Math.abs(value) >= abbr.threshold) {
        displayValue = value / abbr.threshold;
        suffix = abbr.suffix;
        break;
      }
    }
  }

  return displayValue.toFixed(precision) + suffix;
}

/**
 * Resolve the precision to use for a value
 * Priority: configPrecision > entityPrecision > default 1
 */
export function resolvePrecision(
  configPrecision: number | undefined,
  entityPrecision: number | undefined
): number {
  if (configPrecision !== undefined) {
    return configPrecision;
  }
  if (entityPrecision !== undefined) {
    return entityPrecision;
  }
  return 1;
}
