/**
 * Billing Engagement Controller
 *
 * Engagement-related endpoints for billing module
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import {
  canAccessBillingProject,
  parseNumericIdParam,
  convertBigIntToNumber,
  parseDate,
  toSafeNumber,
} from './billing.utils';

interface EngagementDetailRow {
  engagement_id: bigint;
  cm_id: bigint;
  engagement_code: string | null;
  engagement_title: string | null;
  name: string | null;
  start_date: Date | null;
  end_date: Date | null;
  billing_to_date_usd: number | null;
  billing_to_date_cny: number | null;
  collected_to_date_usd: number | null;
  collected_to_date_cny: number | null;
  ubt_usd: number | null;
  ubt_cny: number | null;
  billing_credit_usd: number | null;
  billing_credit_cny: number | null;
  financials_updated_at: Date | null;
  financials_updated_by: string | null;
  billing_usd: number | null;
  collection_usd: number | null;
  efs_billing_credit_usd: number | null;
  efs_ubt_usd: number | null;
  billing_cny: number | null;
  collection_cny: number | null;
  efs_billing_credit_cny: number | null;
  efs_ubt_cny: number | null;
  agreed_fee_usd: number | null;
  agreed_fee_cny: number | null;
  efs_financials_last_updated_at: Date | null;
  efs_financials_last_updated_by: string | null;
  feeArrangement: Record<string, unknown> | null;
  milestones: Record<string, unknown>[];
  financeComments: Record<string, unknown>[];
  events: Record<string, unknown>[];
}

interface CMEngagementRow {
  engagement_id: bigint;
  cm_id: bigint;
  engagement_code: string | null;
  engagement_title: string | null;
  name: string | null;
  start_date: Date | null;
  end_date: Date | null;
  milestone_count: bigint;
  completed_milestone_count: bigint;
}

/**
 * GET /api/billing/projects/:id/engagement/:engagementId
 * Get detailed data for a specific engagement (for lazy loading)
 */
export async function getEngagementDetail(req: AuthRequest, res: Response) {
  try {
    const { id, engagementId } = req.params;
    let projectIdBigInt: bigint;
    let engagementIdBigInt: bigint;
    try {
      projectIdBigInt = parseNumericIdParam(id, 'project ID');
      engagementIdBigInt = parseNumericIdParam(engagementId, 'engagement ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const hasAccess = await canAccessBillingProject(projectIdBigInt, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied - Project not assigned to you' });
    }

    // Get engagement details with JSON aggregation
    const engagementData = await prisma.$queryRaw<EngagementDetailRow[]>`
      SELECT
        e.engagement_id,
        e.cm_id,
        e.engagement_code,
        e.engagement_title,
        e.name,
        e.start_date,
        e.end_date,
        cm.billing_to_date_usd,
        cm.billing_to_date_cny,
        cm.collected_to_date_usd,
        cm.collected_to_date_cny,
        cm.ubt_usd,
        cm.ubt_cny,
        cm.billing_credit_usd,
        cm.billing_credit_cny,
        cm.financials_updated_at,
        cm.financials_updated_by,
        efs.billing_usd,
        efs.collection_usd,
        efs.billing_credit_usd as efs_billing_credit_usd,
        efs.ubt_usd as efs_ubt_usd,
        efs.billing_cny,
        efs.collection_cny,
        efs.billing_credit_cny as efs_billing_credit_cny,
        efs.ubt_cny as efs_ubt_cny,
        efs.agreed_fee_usd,
        efs.agreed_fee_cny,
        efs.financials_last_updated_at as efs_financials_last_updated_at,
        efs.financials_last_updated_by as efs_financials_last_updated_by,
        (
          SELECT JSON_BUILD_OBJECT(
            'fee_id', fa.fee_id,
            'raw_text', fa.raw_text,
            'lsd_date', fa.lsd_date,
            'lsd_raw', fa.lsd_raw
          )
          FROM billing_fee_arrangement fa
          WHERE fa.engagement_id = e.engagement_id
          LIMIT 1
        ) as "feeArrangement",
        (
          SELECT COALESCE(JSON_AGG(
            JSON_BUILD_OBJECT(
              'milestone_id', m.milestone_id,
              'ordinal', m.ordinal,
              'title', m.title,
              'description', m.description,
              'trigger_type', m.trigger_type,
              'trigger_text', m.trigger_text,
              'amount_value', m.amount_value,
              'amount_currency', m.amount_currency,
              'is_percent', m.is_percent,
              'percent_value', m.percent_value,
              'due_date', m.due_date,
              'completed', m.completed,
              'completion_date', m.completion_date,
              'completion_source', m.completion_source,
              'invoice_sent_date', m.invoice_sent_date,
              'payment_received_date', m.payment_received_date,
              'notes', m.notes,
              'raw_fragment', m.raw_fragment
            ) ORDER BY m.sort_order ASC, m.ordinal ASC
          ), '[]'::JSON)
          FROM billing_milestone m
          WHERE m.engagement_id = e.engagement_id
        ) as milestones,
        (
          SELECT COALESCE(JSON_AGG(
            JSON_BUILD_OBJECT(
              'comment_id', fc.comment_id,
              'engagement_id', fc.engagement_id,
              'milestone_id', fc.milestone_id,
              'comment_text', fc.comment_text,
              'notes', fc.notes,
              'created_at', fc.created_at,
              'created_by', fc.created_by
            ) ORDER BY fc.created_at DESC
          ), '[]'::JSON)
          FROM (
            SELECT
              comment_id,
              engagement_id,
              milestone_id,
              comment_text,
              notes,
              created_at,
              created_by
            FROM billing_finance_comment
            WHERE engagement_id = e.engagement_id
            ORDER BY created_at DESC
            LIMIT 100
          ) fc
        ) as "financeComments",
        (
          SELECT COALESCE(JSON_AGG(
            JSON_BUILD_OBJECT(
              'event_id', be.event_id,
              'engagement_id', be.engagement_id,
              'event_type', be.event_type,
              'event_date', be.event_date,
              'description', be.description,
              'amount_usd', be.amount_usd,
              'amount_cny', be.amount_cny,
              'created_at', be.created_at,
              'created_by', be.created_by
            ) ORDER BY be.event_date DESC, be.event_id DESC
          ), '[]'::JSON)
          FROM (
            SELECT
              event_id,
              engagement_id,
              event_type,
              event_date,
              description,
              amount_usd,
              amount_cny,
              created_at,
              created_by
            FROM billing_event
            WHERE engagement_id = e.engagement_id
            ORDER BY event_date DESC, event_id DESC
            LIMIT 50
          ) be
        ) as events
      FROM billing_engagement e
      INNER JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
      LEFT JOIN billing_engagement_financial_summary efs ON efs.cm_id = cm.cm_id
      WHERE e.engagement_id = ${engagementIdBigInt}
        AND cm.project_id = ${projectIdBigInt}
      LIMIT 1
    `;

    if (!engagementData || engagementData.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    res.json(convertBigIntToNumber(engagementData[0]));
  } catch (error) {
    logger.error('Error fetching engagement detail', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to fetch engagement detail' });
  }
}

/**
 * GET /api/billing/projects/:id/cm/:cmId/engagements
 * Get engagements for a specific C/M number (for lazy loading)
 */
export async function getCMEngagements(req: AuthRequest, res: Response) {
  try {
    const { id, cmId } = req.params;
    let projectIdBigInt: bigint;
    let cmIdBigInt: bigint;
    try {
      projectIdBigInt = parseNumericIdParam(id, 'project ID');
      cmIdBigInt = parseNumericIdParam(cmId, 'CM ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const hasAccess = await canAccessBillingProject(projectIdBigInt, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied - Project not assigned to you' });
    }

    const engagements = await prisma.$queryRaw<CMEngagementRow[]>`
      SELECT
        e.engagement_id,
        e.cm_id,
        e.engagement_code,
        e.engagement_title,
        e.name,
        e.start_date,
        e.end_date,
        COUNT(m.milestone_id) as milestone_count,
        COUNT(CASE WHEN M.completed THEN 1 END) as completed_milestone_count
      FROM billing_engagement e
      INNER JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
      LEFT JOIN billing_milestone m ON m.engagement_id = e.engagement_id
      WHERE cm.project_id = ${projectIdBigInt}
        AND cm.cm_id = ${cmIdBigInt}
      GROUP BY
        e.engagement_id, e.cm_id, e.engagement_code, e.engagement_title,
        e.name, e.start_date, e.end_date
      ORDER BY e.start_date DESC NULLS LAST, e.engagement_id
    `;

    res.json(convertBigIntToNumber(engagements));
  } catch (error) {
    logger.error('Error fetching CM engagements', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to fetch CM engagements' });
  }
}

/**
 * POST /api/billing/projects/:id/cm/:cmId/engagements
 * Create a new engagement under a C/M number
 */
export async function createEngagement(req: AuthRequest, res: Response) {
  try {
    const { id, cmId } = req.params;
    let projectIdBigInt: bigint;
    let cmIdBigInt: bigint;
    try {
      projectIdBigInt = parseNumericIdParam(id, 'project ID');
      cmIdBigInt = parseNumericIdParam(cmId, 'CM ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const hasAccess = await canAccessBillingProject(projectIdBigInt, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify CM belongs to project
    const cm = await prisma.$queryRaw<{ cm_id: bigint }[]>`
      SELECT cm_id FROM billing_project_cm_no
      WHERE cm_id = ${cmIdBigInt} AND project_id = ${projectIdBigInt}
      LIMIT 1
    `;
    if (!cm.length) {
      return res.status(404).json({ error: 'C/M not found for this project' });
    }

    const { engagement_title, engagement_code, start_date, end_date, fee_arrangement_text } = req.body;

    // Auto-generate engagement_code if not provided
    let code = engagement_code;
    if (!code) {
      const existing = await prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(*) as cnt FROM billing_engagement WHERE cm_id = ${cmIdBigInt}
      `;
      const count = Number(existing[0]?.cnt ?? 0);
      code = `manual_${count + 1}`;
    }

    const startDateVal = start_date ? parseDate(start_date) : null;
    const endDateVal = end_date ? parseDate(end_date) : null;

    const inserted = await prisma.$queryRaw<{ engagement_id: bigint }[]>`
      INSERT INTO billing_engagement (project_id, cm_id, engagement_code, engagement_title, start_date, end_date, created_at, updated_at)
      VALUES (${projectIdBigInt}, ${cmIdBigInt}, ${code}, ${engagement_title}, ${startDateVal}, ${endDateVal}, NOW(), NOW())
      RETURNING engagement_id
    `;

    const engagementId = inserted[0]?.engagement_id;
    if (!engagementId) throw new Error('Failed to create engagement');

    // Create fee arrangement if text provided
    if (fee_arrangement_text && fee_arrangement_text.trim()) {
      await prisma.$executeRaw`
        INSERT INTO billing_fee_arrangement (engagement_id, raw_text, created_at, updated_at)
        VALUES (${engagementId}, ${fee_arrangement_text.trim()}, NOW(), NOW())
      `;
    }

    if (req.user?.userId) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          actionType: 'create',
          entityType: 'billing_engagement',
          entityId: toSafeNumber(engagementId),
          description: `Created engagement "${engagement_title}" for CM ${cmIdBigInt.toString()}`,
        },
      });
    }

    res.status(201).json(convertBigIntToNumber({ success: true, engagement_id: engagementId }));
  } catch (error) {
    logger.error('Error creating engagement', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to create engagement' });
  }
}

/**
 * PATCH /api/billing/engagements/:engagementId/fee-arrangement
 * Update fee arrangement reference text and LSD date for an engagement
 */
export async function updateFeeArrangement(req: AuthRequest, res: Response) {
  try {
    let engagementIdBigInt: bigint;
    try {
      engagementIdBigInt = parseNumericIdParam(req.params.engagementId, 'engagement ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const { raw_text, lsd_date } = req.body as { raw_text?: string; lsd_date?: string | null };

    if (typeof raw_text !== 'string' || raw_text.trim().length === 0) {
      return res.status(400).json({ error: 'Fee arrangement text is required' });
    }

    const existing = await prisma.$queryRaw<{ fee_id: bigint }[]>`
      SELECT fee_id
      FROM billing_fee_arrangement
      WHERE engagement_id = ${engagementIdBigInt}
      LIMIT 1
    `;

    const trimmedLsdDate = typeof lsd_date === 'string' ? lsd_date.trim() : '';
    const lsdDateValue = trimmedLsdDate ? parseDate(trimmedLsdDate) : null;

    if (trimmedLsdDate && !lsdDateValue) {
      return res.status(400).json({ error: 'Invalid long stop date' });
    }

    if (!existing.length) {
      await prisma.$executeRaw`
        INSERT INTO billing_fee_arrangement (engagement_id, raw_text, lsd_date)
        VALUES (${engagementIdBigInt}, ${raw_text}, ${lsdDateValue})
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE billing_fee_arrangement
        SET raw_text = ${raw_text},
            lsd_date = ${lsdDateValue}
        WHERE fee_id = ${existing[0].fee_id}
      `;
    }

    if (req.user?.userId) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          actionType: 'update',
          entityType: 'billing_fee_arrangement',
          entityId: toSafeNumber(engagementIdBigInt),
          description: `Updated fee arrangement for engagement ${engagementIdBigInt.toString()}`,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating fee arrangement', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to update fee arrangement' });
  }
}
