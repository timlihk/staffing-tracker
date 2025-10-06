/**
 * Parse and validate integer query parameters with bounds checking
 */
export function parseQueryInt(
  value: string | undefined,
  options: {
    default: number;
    min?: number;
    max?: number;
  }
): number {
  if (!value) {
    return options.default;
  }

  const parsed = parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return options.default;
  }

  let result = parsed;

  if (options.min !== undefined) {
    result = Math.max(options.min, result);
  }

  if (options.max !== undefined) {
    result = Math.min(options.max, result);
  }

  return result;
}

/**
 * Check if a parsed integer was clamped due to exceeding limits
 */
export function wasValueClamped(
  rawValue: string | undefined,
  clampedValue: number,
  options: {
    min?: number;
    max?: number;
  }
): boolean {
  if (!rawValue) {
    return false;
  }

  const parsed = parseInt(rawValue, 10);

  if (Number.isNaN(parsed)) {
    return false;
  }

  if (options.max !== undefined && parsed > options.max) {
    return true;
  }

  if (options.min !== undefined && parsed < options.min) {
    return true;
  }

  return false;
}
