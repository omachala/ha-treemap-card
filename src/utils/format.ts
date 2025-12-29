/**
 * Number formatting utility
 *
 * Supports format strings:
 *   0      - whole number (1234)
 *   0.0    - 1 decimal place (1234.5)
 *   0.00   - 2 decimal places (1234.50)
 *   0a     - abbreviated whole (1k, 2M, 3B)
 *   0.0a   - abbreviated 1 decimal (1.2k, 3.5M)
 *   0.00a  - abbreviated 2 decimals (1.23k, 4.56M)
 */

const ABBREVIATIONS = [
  { threshold: 1e12, suffix: 'T' },
  { threshold: 1e9, suffix: 'B' },
  { threshold: 1e6, suffix: 'M' },
  { threshold: 1e3, suffix: 'k' },
];

/**
 * Format a number using a format string
 * @param value - The number to format
 * @param format - Format string (e.g., "0.0a")
 * @returns Formatted string
 */
export function formatNumber(value: number, format: string): string {
  const abbreviated = format.endsWith('a');
  const formatWithoutA = abbreviated ? format.slice(0, -1) : format;

  // Count decimal places (number of 0s after the dot)
  const decimalMatch = /\.(\d+)$/.exec(formatWithoutA);
  const decimals = decimalMatch?.[1]?.length ?? 0;

  let displayValue = value;
  let suffix = '';

  if (abbreviated) {
    for (const abbr of ABBREVIATIONS) {
      if (Math.abs(value) >= abbr.threshold) {
        displayValue = value / abbr.threshold;
        suffix = abbr.suffix;
        break;
      }
    }
  }

  return displayValue.toFixed(decimals) + suffix;
}
