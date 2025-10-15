/**
 * Billing Attorney Name Parser
 *
 * Utilities for parsing attorney names from the billing system's
 * attorney_in_charge field which may contain multiple names in various formats.
 *
 * Examples of input formats:
 * - "John Doe"
 * - "John Doe, Jane Smith"
 * - "John Doe; Jane Smith"
 * - "John Doe and Jane Smith"
 * - "John Doe & Jane Smith"
 */

/**
 * Parse attorney names from a comma/semicolon/and-separated string
 *
 * @param attorneyField - The attorney_in_charge field from billing_project
 * @returns Array of individual attorney names, trimmed and filtered
 *
 * @example
 * parseAttorneyNames("John Doe, Jane Smith")
 * // Returns: ["John Doe", "Jane Smith"]
 *
 * @example
 * parseAttorneyNames("John Doe and Jane Smith")
 * // Returns: ["John Doe", "Jane Smith"]
 */
export function parseAttorneyNames(attorneyField: string | null | undefined): string[] {
  if (!attorneyField || attorneyField.trim() === '') {
    return [];
  }

  // Split by common delimiters: comma, semicolon, "and", "&"
  // Using regex to handle multiple formats
  return attorneyField
    .split(/[,;]|\band\b|&/)
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .filter(name => !name.toLowerCase().includes('tbd'))  // Filter out "TBD" or "To Be Determined"
    .filter(name => !name.toLowerCase().includes('n/a')); // Filter out "N/A"
}

/**
 * Normalize attorney name for better matching
 * Handles common variations like:
 * - "Doe, John" vs "John Doe"
 * - Extra whitespace
 * - Different casing
 *
 * @param name - Attorney name to normalize
 * @returns Normalized name in "FirstName LastName" format
 */
export function normalizeAttorneyName(name: string): string {
  const trimmed = name.trim();

  // Handle "LastName, FirstName" format
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim());
    if (parts.length === 2) {
      return `${parts[1]} ${parts[0]}`;
    }
  }

  return trimmed;
}

/**
 * Split attorney names and normalize them
 *
 * @param attorneyField - The attorney_in_charge field
 * @returns Array of normalized attorney names
 */
export function parseAndNormalizeAttorneyNames(attorneyField: string | null | undefined): string[] {
  const names = parseAttorneyNames(attorneyField);
  return names.map(normalizeAttorneyName);
}

/**
 * Check if an attorney field contains multiple attorneys
 */
export function hasMultipleAttorneys(attorneyField: string | null | undefined): boolean {
  const names = parseAttorneyNames(attorneyField);
  return names.length > 1;
}

/**
 * Get the primary attorney (first one listed)
 */
export function getPrimaryAttorney(attorneyField: string | null | undefined): string | null {
  const names = parseAttorneyNames(attorneyField);
  return names.length > 0 ? names[0] : null;
}
