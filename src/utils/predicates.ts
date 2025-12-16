/**
 * Type predicate functions for runtime type checking
 * These replace unsafe type assertions (as Type) with proper runtime validation
 */

/**
 * Check if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if a value is a string or undefined
 */
export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

/**
 * Check if a value is a number or undefined
 */
export function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && !Number.isNaN(value));
}

/**
 * Check if a value is a string array
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * Check if a value is an RGB color tuple [r, g, b]
 */
export function isRgbColor(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'number')
  );
}

/**
 * Check if a value is an HS color tuple [hue, saturation]
 */
export function isHsColor(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) && value.length === 2 && value.every(item => typeof item === 'number')
  );
}

/**
 * Valid HVAC action states
 */
export type HvacAction = 'heating' | 'cooling' | 'idle' | 'off';

/**
 * Check if a value is a valid HVAC action
 */
export function isHvacAction(value: unknown): value is HvacAction {
  return (
    typeof value === 'string' &&
    (value === 'heating' || value === 'cooling' || value === 'idle' || value === 'off')
  );
}

/**
 * Get an optional HVAC action from a value
 */
export function getHvacAction(value: unknown): HvacAction | undefined {
  return isHvacAction(value) ? value : undefined;
}

/**
 * Safely get a number from an unknown value
 */
export function getNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  return undefined;
}

/**
 * Safely get a string from an unknown value
 */
export function getString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

/**
 * Safely get a string array from an unknown value
 */
export function getStringArray(value: unknown): string[] {
  if (isStringArray(value)) {
    return value;
  }
  return [];
}

/**
 * Safely get an RGB color from an unknown value
 */
export function getRgbColor(value: unknown): [number, number, number] | undefined {
  if (isRgbColor(value)) {
    return value;
  }
  return undefined;
}

/**
 * Safely get an HS color from an unknown value
 */
export function getHsColor(value: unknown): [number, number] | undefined {
  if (isHsColor(value)) {
    return value;
  }
  return undefined;
}
