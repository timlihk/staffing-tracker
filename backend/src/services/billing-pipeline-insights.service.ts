import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';

interface TotalsRow {
  invoicable_amount: Prisma.Decimal | number | null;
  invoicable_count: bigint | number | null;
  outstanding_ar_amount: Prisma.Decimal | number | null;
  outstanding_ar_count: bigint | number | null;
  overdue_ar_30_amount: Prisma.Decimal | number | null;
  overdue_ar_30_count: bigint | number | null;
  collected_ytd_amount: Prisma.Decimal | number | null;
  collected_ytd_count: bigint | number | null;
  upcoming_30_amount: Prisma.Decimal | number | null;
  upcoming_30_count: bigint | number | null;
  pending_action_items: bigint | number | null;
  pending_triggers: bigint | number | null;
}

interface AttorneyRow {
  staff_id: bigint | number | null;
  attorney_name: string | null;
  attorney_position: string | null;
  invoicable_amount: Prisma.Decimal | number | null;
  outstanding_ar_amount: Prisma.Decimal | number | null;
  overdue_ar_30_amount: Prisma.Decimal | number | null;
  upcoming_30_amount: Prisma.Decimal | number | null;
}

export interface BillingPipelineInsights {
  asOf: string;
  totals: {
    invoicableAmount: number;
    invoicableCount: number;
    outstandingArAmount: number;
    outstandingArCount: number;
    overdueAr30Amount: number;
    overdueAr30Count: number;
    collectedYtdAmount: number;
    collectedYtdCount: number;
    upcoming30Amount: number;
    upcoming30Count: number;
    pendingActionItems: number;
    pendingTriggers: number;
  };
  byAttorney: Array<{
    staffId: number;
    attorneyName: string;
    attorneyPosition: string | null;
    invoicableAmount: number;
    outstandingArAmount: number;
    overdueAr30Amount: number;
    upcoming30Amount: number;
  }>;
}

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const parsed = Number((value as { toString: () => string }).toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toInt = (value: unknown): number => Math.max(0, Math.floor(toNumber(value)));

export class BillingPipelineInsightsService {
  static async getInsights(): Promise<BillingPipelineInsights> {
    const [totalsRows, attorneyRows] = await Promise.all([
      prisma.$queryRaw<TotalsRow[]>(Prisma.sql`
        WITH milestone_base AS (
          SELECT
            m.milestone_id,
            COALESCE(m.amount_value, 0)::numeric AS amount_value,
            m.completed,
            m.due_date,
            m.invoice_sent_date,
            m.payment_received_date
          FROM billing_milestone m
        ),
        pending_actions AS (
          SELECT COUNT(*)::bigint AS cnt
          FROM billing_action_item ai
          WHERE ai.status = 'pending'
        ),
        pending_triggers AS (
          SELECT COUNT(*)::bigint AS cnt
          FROM billing_milestone_trigger_queue tq
          WHERE tq.status = 'pending'
        )
        SELECT
          COALESCE(SUM(CASE WHEN mb.completed IS TRUE AND mb.invoice_sent_date IS NULL THEN mb.amount_value ELSE 0 END), 0) AS invoicable_amount,
          COALESCE(COUNT(CASE WHEN mb.completed IS TRUE AND mb.invoice_sent_date IS NULL THEN 1 END), 0)::bigint AS invoicable_count,
          COALESCE(SUM(CASE WHEN mb.invoice_sent_date IS NOT NULL AND mb.payment_received_date IS NULL THEN mb.amount_value ELSE 0 END), 0) AS outstanding_ar_amount,
          COALESCE(COUNT(CASE WHEN mb.invoice_sent_date IS NOT NULL AND mb.payment_received_date IS NULL THEN 1 END), 0)::bigint AS outstanding_ar_count,
          COALESCE(SUM(CASE WHEN mb.invoice_sent_date IS NOT NULL AND mb.payment_received_date IS NULL AND mb.invoice_sent_date <= (CURRENT_DATE - INTERVAL '30 day') THEN mb.amount_value ELSE 0 END), 0) AS overdue_ar_30_amount,
          COALESCE(COUNT(CASE WHEN mb.invoice_sent_date IS NOT NULL AND mb.payment_received_date IS NULL AND mb.invoice_sent_date <= (CURRENT_DATE - INTERVAL '30 day') THEN 1 END), 0)::bigint AS overdue_ar_30_count,
          COALESCE(SUM(CASE WHEN mb.payment_received_date IS NOT NULL AND mb.payment_received_date >= DATE_TRUNC('year', CURRENT_DATE) THEN mb.amount_value ELSE 0 END), 0) AS collected_ytd_amount,
          COALESCE(COUNT(CASE WHEN mb.payment_received_date IS NOT NULL AND mb.payment_received_date >= DATE_TRUNC('year', CURRENT_DATE) THEN 1 END), 0)::bigint AS collected_ytd_count,
          COALESCE(SUM(CASE WHEN mb.completed IS NOT TRUE AND mb.due_date IS NOT NULL AND mb.due_date >= CURRENT_DATE AND mb.due_date < (CURRENT_DATE + INTERVAL '30 day') THEN mb.amount_value ELSE 0 END), 0) AS upcoming_30_amount,
          COALESCE(COUNT(CASE WHEN mb.completed IS NOT TRUE AND mb.due_date IS NOT NULL AND mb.due_date >= CURRENT_DATE AND mb.due_date < (CURRENT_DATE + INTERVAL '30 day') THEN 1 END), 0)::bigint AS upcoming_30_count,
          (SELECT cnt FROM pending_actions) AS pending_action_items,
          (SELECT cnt FROM pending_triggers) AS pending_triggers
        FROM milestone_base mb
      `),
      prisma.$queryRaw<AttorneyRow[]>(Prisma.sql`
        WITH milestone_attorney AS (
          SELECT
            COALESCE(s.id, 0) AS staff_id,
            COALESCE(s.name, 'Unassigned') AS attorney_name,
            s.position AS attorney_position,
            COALESCE(m.amount_value, 0)::numeric AS amount_value,
            m.completed,
            m.due_date,
            m.invoice_sent_date,
            m.payment_received_date
          FROM billing_milestone m
          JOIN billing_engagement e ON e.engagement_id = m.engagement_id
          JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
          JOIN billing_project bp ON bp.project_id = cm.project_id
          LEFT JOIN billing_project_bc_attorneys bpa ON bpa.billing_project_id = bp.project_id
          LEFT JOIN staff s ON s.id = bpa.staff_id
        )
        SELECT
          staff_id,
          attorney_name,
          attorney_position,
          COALESCE(SUM(CASE WHEN completed IS TRUE AND invoice_sent_date IS NULL THEN amount_value ELSE 0 END), 0) AS invoicable_amount,
          COALESCE(SUM(CASE WHEN invoice_sent_date IS NOT NULL AND payment_received_date IS NULL THEN amount_value ELSE 0 END), 0) AS outstanding_ar_amount,
          COALESCE(SUM(CASE WHEN invoice_sent_date IS NOT NULL AND payment_received_date IS NULL AND invoice_sent_date <= (CURRENT_DATE - INTERVAL '30 day') THEN amount_value ELSE 0 END), 0) AS overdue_ar_30_amount,
          COALESCE(SUM(CASE WHEN completed IS NOT TRUE AND due_date IS NOT NULL AND due_date >= CURRENT_DATE AND due_date < (CURRENT_DATE + INTERVAL '30 day') THEN amount_value ELSE 0 END), 0) AS upcoming_30_amount
        FROM milestone_attorney
        GROUP BY staff_id, attorney_name, attorney_position
        ORDER BY overdue_ar_30_amount DESC, outstanding_ar_amount DESC, invoicable_amount DESC
      `),
    ]);

    const totals = totalsRows[0] || {
      invoicable_amount: 0,
      invoicable_count: 0,
      outstanding_ar_amount: 0,
      outstanding_ar_count: 0,
      overdue_ar_30_amount: 0,
      overdue_ar_30_count: 0,
      collected_ytd_amount: 0,
      collected_ytd_count: 0,
      upcoming_30_amount: 0,
      upcoming_30_count: 0,
      pending_action_items: 0,
      pending_triggers: 0,
    };

    return {
      asOf: new Date().toISOString(),
      totals: {
        invoicableAmount: toNumber(totals.invoicable_amount),
        invoicableCount: toInt(totals.invoicable_count),
        outstandingArAmount: toNumber(totals.outstanding_ar_amount),
        outstandingArCount: toInt(totals.outstanding_ar_count),
        overdueAr30Amount: toNumber(totals.overdue_ar_30_amount),
        overdueAr30Count: toInt(totals.overdue_ar_30_count),
        collectedYtdAmount: toNumber(totals.collected_ytd_amount),
        collectedYtdCount: toInt(totals.collected_ytd_count),
        upcoming30Amount: toNumber(totals.upcoming_30_amount),
        upcoming30Count: toInt(totals.upcoming_30_count),
        pendingActionItems: toInt(totals.pending_action_items),
        pendingTriggers: toInt(totals.pending_triggers),
      },
      byAttorney: attorneyRows.map((row) => ({
        staffId: toInt(row.staff_id),
        attorneyName: row.attorney_name || 'Unassigned',
        attorneyPosition: row.attorney_position,
        invoicableAmount: toNumber(row.invoicable_amount),
        outstandingArAmount: toNumber(row.outstanding_ar_amount),
        overdueAr30Amount: toNumber(row.overdue_ar_30_amount),
        upcoming30Amount: toNumber(row.upcoming_30_amount),
      })),
    };
  }
}

