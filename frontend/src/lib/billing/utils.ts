import { formatCurrencyWhole } from '../currency';
import type { EngagementDetailResponse, CMEngagementSummary } from '../../api/billing';

export type Milestone = EngagementDetailResponse['milestones'][number];

export type MilestoneFormState = {
  title: string;
  due_date: string;
  invoice_sent_date: string;
  payment_received_date: string;
  notes: string;
  amount_value: string;
  amount_currency: string;
  ordinal: string;
  completed: boolean;
};

/**
 * Format a date string to a readable format
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? '—'
    : dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Format a date string to YYYY/MM/DD format
 */
export function formatDateYmd(value: string | null | undefined): string {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * Convert a date string to input date format (YYYY-MM-DD)
 */
export function toInputDate(value: string | null | undefined): string {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

/**
 * Convert empty string to null
 */
export function emptyToNull(value: string): string | null {
  return value.trim().length ? value : null;
}

/**
 * Parse string to number or return null
 */
export function stringToNumberOrNull(value: string): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Format currency with USD/CNY fallback
 */
export function formatCurrencyWholeWithFallback(
  usd: number | null | undefined,
  cny: number | null | undefined
): string {
  if (usd != null && !Number.isNaN(usd)) {
    return formatCurrencyWhole(usd, 'USD');
  }
  if (cny != null && !Number.isNaN(cny)) {
    return formatCurrencyWhole(cny, 'CNY');
  }
  return '—';
}

/**
 * Create initial milestone form state
 */
export function createMilestoneFormState(overrides?: Partial<MilestoneFormState>): MilestoneFormState {
  return {
    title: '',
    due_date: '',
    invoice_sent_date: '',
    payment_received_date: '',
    notes: '',
    amount_value: '',
    amount_currency: 'USD',
    ordinal: '',
    completed: false,
    ...overrides,
  };
}

/**
 * Build a display label for a milestone
 */
export function buildMilestoneLabel(milestone: Milestone): string {
  if (milestone.title) return milestone.title;
  if (milestone.description) return milestone.description;
  if (milestone.raw_fragment) return milestone.raw_fragment;
  return milestone.ordinal != null ? `Milestone ${milestone.ordinal}` : 'Milestone';
}

/**
 * Parse engagement ID to number or null
 */
export function parseEngagementId(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Map engagement detail to summary
 */
export function mapToSummary(engagement: EngagementDetailResponse): CMEngagementSummary {
  return {
    engagement_id: engagement.engagement_id,
    cm_id: engagement.cm_id,
    engagement_code: engagement.engagement_code,
    engagement_title: engagement.engagement_title,
    name: engagement.name,
    start_date: engagement.start_date,
    end_date: engagement.end_date,
    total_agreed_fee_value: engagement.total_agreed_fee_value,
    total_agreed_fee_currency: engagement.total_agreed_fee_currency,
    milestone_count: engagement.milestones?.length ?? 0,
    completed_milestone_count: engagement.milestones?.filter((milestone) => milestone.completed).length ?? 0,
  };
}

/**
 * Format milestone value as currency
 */
export function formatMilestoneValue(milestone: Milestone): string {
  if (milestone.amount_value != null) {
    const raw = Number(milestone.amount_value);
    if (!Number.isNaN(raw)) {
      return formatCurrencyWhole(raw, milestone.amount_currency ?? undefined);
    }
  }
  return '—';
}
