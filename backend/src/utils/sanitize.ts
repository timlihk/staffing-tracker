/**
 * Sanitization utilities for logging and security
 */

/**
 * Sanitize user input for logging to prevent log injection attacks
 *
 * Removes:
 * - Newlines and carriage returns (prevents log splitting)
 * - Control characters
 * - Limits length to prevent log flooding
 *
 * @param input - Any value to sanitize
 * @param maxLength - Maximum length (default 100)
 * @returns Sanitized string safe for logging
 */
export const sanitizeForLogs = (input: any, maxLength: number = 100): string => {
  if (input === null || input === undefined) {
    return String(input);
  }

  let str: string;

  // Convert to string
  if (typeof input === 'object') {
    try {
      str = JSON.stringify(input);
    } catch {
      str = '[Object]';
    }
  } else {
    str = String(input);
  }

  // Remove control characters (including newlines, carriage returns, tabs)
  // Keep only printable ASCII and common Unicode characters
  str = str.replace(/[\x00-\x1F\x7F]/g, ' ');

  // Collapse multiple spaces
  str = str.replace(/\s+/g, ' ').trim();

  // Truncate if too long
  if (str.length > maxLength) {
    str = str.substring(0, maxLength) + '...';
  }

  return str;
};

/**
 * Sanitize multiple log parameters at once
 *
 * @param params - Object with key-value pairs to sanitize
 * @param maxLength - Maximum length per value
 * @returns Object with sanitized values
 */
export const sanitizeLogParams = (
  params: Record<string, any>,
  maxLength: number = 100
): Record<string, string> => {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    sanitized[key] = sanitizeForLogs(value, maxLength);
  }

  return sanitized;
};

/**
 * Redact sensitive field values from objects before logging
 *
 * @param obj - Object potentially containing sensitive data
 * @param sensitiveFields - Array of field names to redact (default: common sensitive fields)
 * @returns Object with sensitive fields redacted
 */
export const redactSensitiveFields = (
  obj: Record<string, any>,
  sensitiveFields: string[] = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie']
): Record<string, any> => {
  const redacted = { ...obj };

  for (const field of sensitiveFields) {
    // Case-insensitive check
    for (const key of Object.keys(redacted)) {
      if (key.toLowerCase().includes(field.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      }
    }
  }

  return redacted;
};

/**
 * Safe logging wrapper that sanitizes and redacts automatically
 *
 * Usage:
 *   logger.error('Login failed', safeLogData({ username: req.body.username, password: req.body.password }))
 *
 * @param data - Data to log
 * @returns Sanitized and redacted data safe for logging
 */
export const safeLogData = (data: Record<string, any>): Record<string, any> => {
  // First redact sensitive fields
  const redacted = redactSensitiveFields(data);

  // Then sanitize each value
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(redacted)) {
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = safeLogData(value); // Recursive for nested objects
    } else {
      sanitized[key] = sanitizeForLogs(value);
    }
  }

  return sanitized;
};
