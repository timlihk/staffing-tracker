/**
 * Billing Trigger Controller
 *
 * Handles API endpoints for billing milestone trigger queue and action items
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BillingTriggerQueueService } from '../services/billing-trigger-queue.service';
import { BillingMilestoneDateSweepService } from '../services/billing-milestone-date-sweep.service';
import { BillingMilestoneAISweepService } from '../services/billing-milestone-ai-sweep.service';
import { BillingPipelineInsightsService } from '../services/billing-pipeline-insights.service';
import { logger } from '../utils/logger';
import prisma from '../utils/prisma';
import { SweepLockError } from '../utils/sweep-lock';

const toSafeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) ? numeric : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseOptionalIntQuery = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

const parseOptionalNumberQuery = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatActionItem = (actionItem: any) => {
  if (!actionItem) {
    return null;
  }

  return {
    id: actionItem.id,
    actionType: actionItem.action_type,
    description: actionItem.description,
    dueDate: actionItem.due_date,
    status: actionItem.status,
    completedAt: actionItem.completed_at,
    assignedTo: actionItem.assignedTo ? {
      id: actionItem.assignedTo.id,
      name: actionItem.assignedTo.name,
      position: actionItem.assignedTo.position,
    } : null,
  };
};

const formatTrigger = (trigger: any) => {
  const actionItem = Array.isArray(trigger.billing_action_item)
    ? trigger.billing_action_item[0]
    : null;

  return {
    id: trigger.id,
    milestoneId: toSafeNumber(trigger.milestone_id),
    staffingProjectId: toSafeNumber(trigger.staffing_project_id),
    oldStatus: trigger.old_status,
    newStatus: trigger.new_status,
    matchConfidence: parseFloat(trigger.match_confidence?.toString() || '0'),
    triggerReason: trigger.trigger_reason,
    status: trigger.status,
    confirmedBy: toSafeNumber(trigger.confirmed_by),
    confirmedAt: trigger.confirmed_at,
    actionTaken: trigger.action_taken,
    eventType: trigger.event_type || null,
    createdAt: trigger.created_at,
    milestone: trigger.milestone ? {
      title: trigger.milestone.title,
      triggerText: trigger.milestone.trigger_text,
      amountValue: trigger.milestone.amount_value
        ? parseFloat(trigger.milestone.amount_value.toString())
        : null,
      dueDate: trigger.milestone.due_date,
    } : null,
    project: trigger.project ? {
      name: trigger.project.name,
      status: trigger.project.status,
    } : null,
    actionItem: formatActionItem(actionItem),
  };
};

/**
 * Get all pending triggers for admin review
 */
export const getPendingTriggers = async (req: AuthRequest, res: Response) => {
  try {
    const triggers = await BillingTriggerQueueService.getPendingTriggers();
    const formattedTriggers = triggers.map((trigger: any) => formatTrigger(trigger));

    res.json(formattedTriggers);
  } catch (error) {
    logger.error('Error fetching pending triggers:', error as any);
    res.status(500).json({ error: 'Failed to fetch pending triggers' });
  }
};

/**
 * Get all triggers with filters
 */
export const getTriggers = async (req: AuthRequest, res: Response) => {
  try {
    const { status, staffingProjectId, attorneyId, startDate, endDate } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (staffingProjectId) {
      const parsedStaffingProjectId = parseInt(staffingProjectId as string, 10);
      if (Number.isNaN(parsedStaffingProjectId)) {
        return res.status(400).json({ error: 'Invalid staffingProjectId' });
      }
      filters.staffingProjectId = parsedStaffingProjectId;
    }
    if (attorneyId) {
      const parsedAttorneyId = parseInt(attorneyId as string, 10);
      if (Number.isNaN(parsedAttorneyId)) {
        return res.status(400).json({ error: 'Invalid attorneyId' });
      }
      filters.attorneyId = parsedAttorneyId;
    }
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const triggers = await BillingTriggerQueueService.getTriggers(filters);
    const formattedTriggers = triggers.map((trigger: any) => formatTrigger(trigger));

    res.json(formattedTriggers);
  } catch (error) {
    logger.error('Error fetching triggers:', error as any);
    res.status(500).json({ error: 'Failed to fetch triggers' });
  }
};

/**
 * Add or update a consequence action item for a trigger.
 */
export const updateTriggerActionItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const triggerId = parseInt(id as string, 10);

    if (Number.isNaN(triggerId)) {
      return res.status(400).json({ error: 'Invalid trigger ID' });
    }

    const actionItem = await BillingTriggerQueueService.updateTriggerActionItem(triggerId, {
      actionType: req.body?.actionType,
      description: req.body?.description,
      dueDate: req.body?.dueDate,
      status: req.body?.status,
      assignedTo: req.body?.assignedTo,
    });

    res.json({
      message: 'Trigger action item updated successfully',
      actionItem: formatActionItem(actionItem),
    });
  } catch (error: any) {
    logger.error('Error updating trigger action item:', error);
    res.status(400).json({ error: error.message || 'Failed to update trigger action item' });
  }
};

/**
 * Confirm a trigger
 */
export const confirmTrigger = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const triggerId = parseInt(id as string, 10);

    if (Number.isNaN(triggerId)) {
      return res.status(400).json({ error: 'Invalid trigger ID' });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const trigger = await BillingTriggerQueueService.confirmTrigger(triggerId, userId);

    res.json({
      message: 'Trigger confirmed successfully',
      trigger: {
        id: trigger.id,
        status: trigger.status,
        confirmedBy: trigger.confirmed_by,
        confirmedAt: trigger.confirmed_at,
        actionTaken: trigger.action_taken,
      },
    });
  } catch (error: any) {
    logger.error('Error confirming trigger:', error);
    res.status(400).json({ error: error.message || 'Failed to confirm trigger' });
  }
};

/**
 * Reject a trigger
 */
export const rejectTrigger = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const triggerId = parseInt(id as string, 10);

    if (Number.isNaN(triggerId)) {
      return res.status(400).json({ error: 'Invalid trigger ID' });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const trigger = await BillingTriggerQueueService.rejectTrigger(triggerId, userId);

    res.json({
      message: 'Trigger rejected successfully',
      trigger: {
        id: trigger.id,
        status: trigger.status,
        confirmedBy: trigger.confirmed_by,
        confirmedAt: trigger.confirmed_at,
      },
    });
  } catch (error: any) {
    logger.error('Error rejecting trigger:', error);
    res.status(400).json({ error: error.message || 'Failed to reject trigger' });
  }
};

/**
 * Get overdue billing by attorney
 */
export const getOverdueByAttorney = async (req: AuthRequest, res: Response) => {
  try {
    const { attorneyId, minAmount, startDate, endDate } = req.query;

    const filters: any = {};
    if (attorneyId) filters.attorneyId = parseInt(attorneyId as string, 10);
    if (minAmount) filters.minAmount = parseFloat(minAmount as string);
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const overdue = await BillingTriggerQueueService.getOverdueByAttorney(filters);

    // Format the results
    const formattedOverdue = (overdue as any[]).map(item => ({
      staffId: Number(item.staff_id ?? 0),
      attorneyName: item.attorney_name,
      attorneyPosition: item.attorney_position,
      overdueMilestones: Number(item.overdue_milestones ?? 0),
      overdueAmount: Number(item.overdue_amount ?? 0),
      nextDueDate: item.next_due_date,
      billingProjectId: Number(item.billing_project_id),
      billingProjectName: item.project_name,
      staffingProjectId: item.staffing_project_id ? Number(item.staffing_project_id) : null,
      staffingProjectName: item.staffing_project_name,
      staffingProjectStatus: item.staffing_project_status,
      milestoneId: Number(item.milestone_id),
      milestoneTitle: item.milestone_title,
      milestoneAmount: item.milestone_amount ? Number(item.milestone_amount) : null,
      milestoneDueDate: item.milestone_due_date,
    }));

    res.json(formattedOverdue);
  } catch (error) {
    logger.error('Error fetching overdue by attorney:', error as any);
    res.status(500).json({ error: 'Failed to fetch overdue billing data' });
  }
};

/**
 * Run date-based milestone sweep (manual/admin trigger).
 */
export const runDueDateSweep = async (req: AuthRequest, res: Response) => {
  try {
    const dryRun = String(req.query?.dryRun || '').toLowerCase() === 'true';
    const parsedLimit = Number(req.query?.limit);
    const settings = await prisma.appSettings.findFirst();
    const limit = Number.isFinite(parsedLimit)
      ? parsedLimit
      : settings?.billingDateSweepLimit;

    const result = await BillingMilestoneDateSweepService.runDailySweep({
      dryRun,
      limit,
    });

    res.json({
      message: dryRun
        ? 'Dry run completed for date-based milestone sweep'
        : 'Date-based milestone sweep completed',
      ...result,
    });
  } catch (error) {
    if (error instanceof SweepLockError) {
      return res.status(409).json({ error: error.message });
    }
    logger.error('Error running date-based milestone sweep:', error as any);
    res.status(500).json({ error: 'Failed to run date-based milestone sweep' });
  }
};

/**
 * Run AI milestone due-date sweep (manual/admin trigger).
 */
export const runAIDueSweep = async (req: AuthRequest, res: Response) => {
  try {
    const dryRun = String(req.query?.dryRun || '').toLowerCase() === 'true';
    const parsedLimit = Number(req.query?.limit);
    const parsedBatchSize = Number(req.query?.batchSize);
    const parsedMinConfidence = Number(req.query?.minConfidence);
    const parsedAutoConfirmConfidence = Number(req.query?.autoConfirmConfidence);
    const settings = await prisma.appSettings.findFirst();

    const limit = Number.isFinite(parsedLimit)
      ? parsedLimit
      : settings?.billingAiSweepLimit;
    const batchSize = Number.isFinite(parsedBatchSize)
      ? parsedBatchSize
      : settings?.billingAiSweepBatchSize;
    const minConfidence = Number.isFinite(parsedMinConfidence)
      ? parsedMinConfidence
      : settings?.billingAiSweepMinConfidence;
    const autoConfirmConfidence = Number.isFinite(parsedAutoConfirmConfidence)
      ? parsedAutoConfirmConfidence
      : settings?.billingAiSweepAutoConfirmConfidence;

    const result = await BillingMilestoneAISweepService.runDailySweep({
      dryRun,
      limit,
      batchSize,
      minConfidence,
      autoConfirmConfidence,
    });

    res.json({
      message: dryRun
        ? 'Dry run completed for AI milestone due-date sweep'
        : 'AI milestone due-date sweep completed',
      ...result,
    });
  } catch (error) {
    if (error instanceof SweepLockError) {
      return res.status(409).json({ error: error.message });
    }
    logger.error('Error running AI milestone due-date sweep:', error as any);
    res.status(500).json({ error: 'Failed to run AI milestone due-date sweep' });
  }
};

/**
 * Get billing pipeline insights for control tower cards.
 */
export const getPipelineInsights = async (_req: AuthRequest, res: Response) => {
  try {
    const insights = await BillingPipelineInsightsService.getInsights();
    res.json(insights);
  } catch (error) {
    logger.error('Error fetching billing pipeline insights:', error as any);
    res.status(500).json({ error: 'Failed to fetch billing pipeline insights' });
  }
};

/**
 * Get high-level billing finance summary (billing/collection/UBT) with attorney breakdown.
 */
export const getFinanceSummary = async (req: AuthRequest, res: Response) => {
  try {
    const attorneyId = parseOptionalIntQuery(req.query.attorneyId);

    if (req.query.attorneyId !== undefined && attorneyId === undefined) {
      return res.status(400).json({ error: 'Invalid attorneyId' });
    }

    const [totalsRow] = await prisma.$queryRawUnsafe<any[]>(
      `
        WITH scoped_projects AS (
          SELECT DISTINCT bp.project_id
          FROM billing_project bp
          WHERE $1::int IS NULL
            OR EXISTS (
              SELECT 1
              FROM billing_project_bc_attorneys bpa
              WHERE bpa.billing_project_id = bp.project_id
                AND bpa.staff_id = $1::int
            )
        ),
        project_financials AS (
          SELECT
            sp.project_id,
            COALESCE(SUM(COALESCE(cm.billing_to_date_usd, 0)::numeric), 0) AS billing_usd,
            COALESCE(SUM(COALESCE(cm.collected_to_date_usd, 0)::numeric), 0) AS collection_usd,
            COALESCE(SUM(COALESCE(cm.ubt_usd, 0)::numeric), 0) AS ubt_usd
          FROM scoped_projects sp
          LEFT JOIN billing_project_cm_no cm ON cm.project_id = sp.project_id
          GROUP BY sp.project_id
        )
        SELECT
          COALESCE(SUM(pf.billing_usd), 0) AS billing_usd,
          COALESCE(SUM(pf.collection_usd), 0) AS collection_usd,
          COALESCE(SUM(pf.ubt_usd), 0) AS ubt_usd,
          COALESCE(COUNT(*), 0)::bigint AS project_count
        FROM project_financials pf
      `,
      attorneyId ?? null
    );

    const byAttorneyRows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          s.id AS staff_id,
          s.name AS attorney_name,
          s.position AS attorney_position,
          COALESCE(SUM(COALESCE(cm.billing_to_date_usd, 0)::numeric), 0) AS billing_usd,
          COALESCE(SUM(COALESCE(cm.collected_to_date_usd, 0)::numeric), 0) AS collection_usd,
          COALESCE(SUM(COALESCE(cm.ubt_usd, 0)::numeric), 0) AS ubt_usd,
          COALESCE(COUNT(DISTINCT bp.project_id), 0)::bigint AS project_count
        FROM billing_project_bc_attorneys bpa
        JOIN staff s ON s.id = bpa.staff_id
        JOIN billing_project bp ON bp.project_id = bpa.billing_project_id
        LEFT JOIN billing_project_cm_no cm ON cm.project_id = bp.project_id
        WHERE $1::int IS NULL OR s.id = $1::int
        GROUP BY s.id, s.name, s.position
        ORDER BY ubt_usd DESC, billing_usd DESC, attorney_name ASC
      `,
      attorneyId ?? null
    );

    return res.json({
      asOf: new Date().toISOString(),
      totals: {
        billingUsd: Number(totalsRow?.billing_usd ?? 0),
        collectionUsd: Number(totalsRow?.collection_usd ?? 0),
        ubtUsd: Number(totalsRow?.ubt_usd ?? 0),
        projectCount: Number(totalsRow?.project_count ?? 0),
      },
      byAttorney: byAttorneyRows.map((row) => ({
        staffId: Number(row.staff_id ?? 0),
        attorneyName: row.attorney_name || 'Unassigned',
        attorneyPosition: row.attorney_position || null,
        billingUsd: Number(row.billing_usd ?? 0),
        collectionUsd: Number(row.collection_usd ?? 0),
        ubtUsd: Number(row.ubt_usd ?? 0),
        projectCount: Number(row.project_count ?? 0),
      })),
    });
  } catch (error) {
    logger.error('Error fetching billing finance summary:', error as any);
    return res.status(500).json({ error: 'Failed to fetch billing finance summary' });
  }
};

/**
 * Get long-stop-date risk queue for control tower.
 */
export const getLongStopRisks = async (req: AuthRequest, res: Response) => {
  try {
    const attorneyId = parseOptionalIntQuery(req.query.attorneyId);
    const windowDays = clamp(parseOptionalIntQuery(req.query.windowDays) ?? 30, 1, 180);
    const limit = clamp(parseOptionalIntQuery(req.query.limit) ?? 500, 1, 2000);
    const minUbtAmount = parseOptionalNumberQuery(req.query.minUbtAmount);

    if (req.query.attorneyId !== undefined && attorneyId === undefined) {
      return res.status(400).json({ error: 'Invalid attorneyId' });
    }
    if (req.query.windowDays !== undefined && parseOptionalIntQuery(req.query.windowDays) === undefined) {
      return res.status(400).json({ error: 'Invalid windowDays' });
    }
    if (req.query.limit !== undefined && parseOptionalIntQuery(req.query.limit) === undefined) {
      return res.status(400).json({ error: 'Invalid limit' });
    }
    if (req.query.minUbtAmount !== undefined && minUbtAmount === undefined) {
      return res.status(400).json({ error: 'Invalid minUbtAmount' });
    }

    const params: Array<number> = [windowDays];
    const conditions: string[] = [
      'rr.lsd_date IS NOT NULL',
      'rr.lsd_date::date <= (CURRENT_DATE + ($1::int * INTERVAL \'1 day\'))',
    ];

    if (attorneyId !== undefined) {
      params.push(attorneyId);
      conditions.push(`rr.staff_id = $${params.length}::int`);
    }

    if (minUbtAmount !== undefined) {
      params.push(minUbtAmount);
      conditions.push(`COALESCE(rr.ubt_usd, 0) >= $${params.length}::numeric`);
    }

    params.push(limit);

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
        WITH project_financials AS (
          SELECT
            cm.project_id AS billing_project_id,
            COALESCE(SUM(COALESCE(cm.billing_to_date_usd, 0)::numeric), 0) AS billing_usd,
            COALESCE(SUM(COALESCE(cm.collected_to_date_usd, 0)::numeric), 0) AS collection_usd,
            COALESCE(SUM(COALESCE(cm.ubt_usd, 0)::numeric), 0) AS ubt_usd
          FROM billing_project_cm_no cm
          GROUP BY cm.project_id
        ),
        project_lsd AS (
          SELECT
            cm.project_id AS billing_project_id,
            MIN(fa.lsd_date) AS lsd_date
          FROM billing_project_cm_no cm
          JOIN billing_engagement e ON e.cm_id = cm.cm_id
          JOIN billing_fee_arrangement fa ON fa.engagement_id = e.engagement_id
          GROUP BY cm.project_id
        ),
        risk_rows AS (
          SELECT
            bp.project_id AS billing_project_id,
            bp.project_name AS billing_project_name,
            bp.client_name,
            COALESCE(s.id, 0) AS staff_id,
            COALESCE(s.name, 'Unassigned') AS attorney_name,
            s.position AS attorney_position,
            p.id AS staffing_project_id,
            p.name AS staffing_project_name,
            p.status AS staffing_project_status,
            pl.lsd_date,
            COALESCE(pf.billing_usd, 0) AS billing_usd,
            COALESCE(pf.collection_usd, 0) AS collection_usd,
            COALESCE(pf.ubt_usd, 0) AS ubt_usd
          FROM billing_project bp
          LEFT JOIN project_lsd pl ON pl.billing_project_id = bp.project_id
          LEFT JOIN project_financials pf ON pf.billing_project_id = bp.project_id
          LEFT JOIN billing_project_bc_attorneys bpa ON bpa.billing_project_id = bp.project_id
          LEFT JOIN staff s ON s.id = bpa.staff_id
          LEFT JOIN billing_staffing_project_link bspl ON bspl.billing_project_id = bp.project_id
          LEFT JOIN projects p ON p.id = bspl.staffing_project_id
        )
        SELECT
          rr.billing_project_id,
          rr.billing_project_name,
          rr.client_name,
          rr.staff_id,
          rr.attorney_name,
          rr.attorney_position,
          rr.staffing_project_id,
          rr.staffing_project_name,
          rr.staffing_project_status,
          rr.lsd_date,
          (rr.lsd_date::date - CURRENT_DATE)::int AS days_to_long_stop,
          CASE
            WHEN rr.lsd_date::date < CURRENT_DATE THEN 'past_due'
            WHEN rr.lsd_date::date <= (CURRENT_DATE + INTERVAL '14 day') THEN 'due_14'
            WHEN rr.lsd_date::date <= (CURRENT_DATE + INTERVAL '30 day') THEN 'due_30'
            ELSE 'watch'
          END AS risk_level,
          rr.billing_usd,
          rr.collection_usd,
          rr.ubt_usd
        FROM risk_rows rr
        WHERE ${conditions.join(' AND ')}
        ORDER BY rr.lsd_date ASC, rr.ubt_usd DESC, rr.billing_project_name ASC
        LIMIT $${params.length}::int
      `,
      ...params
    );

    return res.json(rows.map((row) => ({
      billingProjectId: Number(row.billing_project_id ?? 0),
      billingProjectName: row.billing_project_name,
      clientName: row.client_name,
      staffId: Number(row.staff_id ?? 0),
      attorneyName: row.attorney_name || 'Unassigned',
      attorneyPosition: row.attorney_position || null,
      staffingProjectId: row.staffing_project_id ? Number(row.staffing_project_id) : null,
      staffingProjectName: row.staffing_project_name || null,
      staffingProjectStatus: row.staffing_project_status || null,
      lsdDate: row.lsd_date,
      daysToLongStop: Number(row.days_to_long_stop ?? 0),
      riskLevel: row.risk_level,
      billingUsd: Number(row.billing_usd ?? 0),
      collectionUsd: Number(row.collection_usd ?? 0),
      ubtUsd: Number(row.ubt_usd ?? 0),
    })));
  } catch (error) {
    logger.error('Error fetching long-stop risks:', error as any);
    return res.status(500).json({ error: 'Failed to fetch long-stop risks' });
  }
};

/**
 * Get unpaid invoice alerts queue (invoice sent but not marked paid after threshold days).
 */
export const getUnpaidInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const attorneyId = parseOptionalIntQuery(req.query.attorneyId);
    const thresholdDays = clamp(parseOptionalIntQuery(req.query.thresholdDays) ?? 30, 1, 365);
    const limit = clamp(parseOptionalIntQuery(req.query.limit) ?? 1000, 1, 5000);
    const minAmount = parseOptionalNumberQuery(req.query.minAmount);

    if (req.query.attorneyId !== undefined && attorneyId === undefined) {
      return res.status(400).json({ error: 'Invalid attorneyId' });
    }
    if (req.query.thresholdDays !== undefined && parseOptionalIntQuery(req.query.thresholdDays) === undefined) {
      return res.status(400).json({ error: 'Invalid thresholdDays' });
    }
    if (req.query.limit !== undefined && parseOptionalIntQuery(req.query.limit) === undefined) {
      return res.status(400).json({ error: 'Invalid limit' });
    }
    if (req.query.minAmount !== undefined && minAmount === undefined) {
      return res.status(400).json({ error: 'Invalid minAmount' });
    }

    const params: Array<number> = [thresholdDays];
    const conditions: string[] = [
      'm.invoice_sent_date IS NOT NULL',
      'm.payment_received_date IS NULL',
      'm.invoice_sent_date::date <= (CURRENT_DATE - ($1::int * INTERVAL \'1 day\'))',
    ];

    if (attorneyId !== undefined) {
      params.push(attorneyId);
      conditions.push(`COALESCE(s.id, 0) = $${params.length}::int`);
    }

    if (minAmount !== undefined) {
      params.push(minAmount);
      conditions.push(`COALESCE(m.amount_value, 0) >= $${params.length}::numeric`);
    }

    params.push(limit);

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          COALESCE(s.id, 0) AS staff_id,
          COALESCE(s.name, 'Unassigned') AS attorney_name,
          s.position AS attorney_position,
          bp.project_id AS billing_project_id,
          bp.project_name AS billing_project_name,
          bp.client_name,
          p.id AS staffing_project_id,
          p.name AS staffing_project_name,
          p.status AS staffing_project_status,
          e.engagement_id,
          COALESCE(e.engagement_title, e.name) AS engagement_title,
          m.milestone_id,
          m.title AS milestone_title,
          COALESCE(m.amount_value, 0)::numeric AS milestone_amount,
          m.invoice_sent_date,
          (CURRENT_DATE - m.invoice_sent_date::date)::int AS days_since_invoice
        FROM billing_milestone m
        JOIN billing_engagement e ON e.engagement_id = m.engagement_id
        JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
        JOIN billing_project bp ON bp.project_id = cm.project_id
        LEFT JOIN billing_project_bc_attorneys bpa ON bpa.billing_project_id = bp.project_id
        LEFT JOIN staff s ON s.id = bpa.staff_id
        LEFT JOIN billing_staffing_project_link bspl ON bspl.billing_project_id = bp.project_id
        LEFT JOIN projects p ON p.id = bspl.staffing_project_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY days_since_invoice DESC, m.invoice_sent_date ASC, bp.project_name ASC
        LIMIT $${params.length}::int
      `,
      ...params
    );

    return res.json(rows.map((row) => ({
      staffId: Number(row.staff_id ?? 0),
      attorneyName: row.attorney_name || 'Unassigned',
      attorneyPosition: row.attorney_position || null,
      billingProjectId: Number(row.billing_project_id ?? 0),
      billingProjectName: row.billing_project_name,
      clientName: row.client_name,
      staffingProjectId: row.staffing_project_id ? Number(row.staffing_project_id) : null,
      staffingProjectName: row.staffing_project_name || null,
      staffingProjectStatus: row.staffing_project_status || null,
      engagementId: Number(row.engagement_id ?? 0),
      engagementTitle: row.engagement_title || null,
      milestoneId: Number(row.milestone_id ?? 0),
      milestoneTitle: row.milestone_title || null,
      milestoneAmount: Number(row.milestone_amount ?? 0),
      invoiceSentDate: row.invoice_sent_date,
      daysSinceInvoice: Number(row.days_since_invoice ?? 0),
    })));
  } catch (error) {
    logger.error('Error fetching unpaid invoice alerts:', error as any);
    return res.status(500).json({ error: 'Failed to fetch unpaid invoice alerts' });
  }
};
