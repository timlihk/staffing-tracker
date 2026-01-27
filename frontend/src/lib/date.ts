/**
 * Date/time constants and utilities
 */

// Time in milliseconds
export const Time = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

// Common date calculations
export const DateHelpers = {
  daysAgo: (date: Date | string | null): number | null => {
    if (!date) return null;
    const d = typeof date === 'string' ? new Date(date) : date;
    return Math.floor((Date.now() - d.getTime()) / Time.DAY);
  },

  isStale: (date: Date | string | null, days: number): boolean => {
    const daysAgo = DateHelpers.daysAgo(date);
    return daysAgo !== null && daysAgo > days;
  },

  formatDaysAgo: (date: Date | string | null): string => {
    const days = DateHelpers.daysAgo(date);
    if (days === null) return 'Never';
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  },

  formatDate: (value?: string | null): string => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString();
  },

  formatDateTime: (value: string | null): string => {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  },

  fiveMinutesAgo: (): Date => new Date(Date.now() - 5 * Time.MINUTE),
} as const;
