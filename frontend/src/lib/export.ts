/**
 * Export utilities for CSV and other formats
 */

export interface CsvColumn<T> {
  header: string;
  key: keyof T | string;
  formatter?: (value: unknown, row: T) => string;
}

/**
 * Convert data to CSV string
 */
export function toCsv<T>(data: T[], columns: CsvColumn<T>[]): string {
  if (!data.length) return '';

  // Create header row
  const headers = columns.map((col) => escapeCsvValue(col.header));
  const lines: string[] = [headers.join(',')];

  // Create data rows
  for (const row of data) {
    const values = columns.map((col) => {
      const rawValue = getNestedValue(row, col.key as string);
      const formatted = col.formatter ? col.formatter(rawValue, row) : String(rawValue ?? '');
      return escapeCsvValue(formatted);
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

/**
 * Escape special characters for CSV
 */
function escapeCsvValue(value: string): string {
  const str = String(value ?? '');
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Get nested object value by path (e.g., "user.name")
 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/**
 * Download data as CSV file
 */
export function downloadCsv<T>(
  data: T[],
  columns: CsvColumn<T>[],
  filename: string
): void {
  const csv = toCsv(data, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download data as JSON file
 */
export function downloadJson<T>(data: T[], filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format date for export
 */
export function formatExportDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

/**
 * Format currency for export
 */
export function formatExportCurrency(
  value: number | null | undefined,
  currency: string = 'USD'
): string {
  if (value == null || isNaN(value)) return '';
  return `${currency} ${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Common column formatters
 */
export const Formatters = {
  date: (value: unknown): string => formatExportDate(value as Date | string),
  currency: (value: unknown, currency = 'USD'): string =>
    formatExportCurrency(value as number, currency),
  boolean: (value: unknown): string => (value ? 'Yes' : 'No'),
  array: (value: unknown, separator = '; '): string =>
    Array.isArray(value) ? value.join(separator) : String(value ?? ''),
};
