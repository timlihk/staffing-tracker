/**
 * Billing Milestone Controller
 *
 * Milestone-related endpoints for billing module
 */

import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import {
  canAccessBillingProject,
  parseNumericIdParam,
  convertBigIntToNumber,
  parseDate,
  parseNullableString,
  parseNullableNumber,
  toSafeNumber,
} from './billing.utils';

const verifyMilestoneProjectAccess = async (
  milestoneIds: number[],
  authUser: AuthRequest['user']
) => {
  if (!milestoneIds.length) {
    return { ok: true as const };
  }

  const milestoneIdValues = milestoneIds
    .filter((id) => Number.isFinite(id))
    .map((id) => BigInt(id));

  if (milestoneIdValues.length === 0) {
    return { ok: false as const, status: 400, error: 'Invalid milestone IDs' };
  }

  const rows = await prisma.$queryRaw<{ project_id: bigint }[]>(Prisma.sql`
    SELECT DISTINCT cm.project_id
    FROM billing_milestone m
    JOIN billing_engagement e ON e.engagement_id = m.engagement_id
    JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
    WHERE m.milestone_id IN (${Prisma.join(milestoneIdValues.map((id) => Prisma.sql`${id}`))})
  `);

  if (rows.length === 0) {
    return { ok: false as const, status: 404, error: 'No matching milestones found' };
  }

  for (const row of rows) {
    const hasAccess = await canAccessBillingProject(row.project_id, authUser);
    if (!hasAccess) {
      return { ok: false as const, status: 403, error: 'Access denied - Project not assigned to you' };
    }
  }

  return { ok: true as const };
};

/**
 * PATCH /api/billing/milestones
 * Bulk update milestone status and notes
 */
export async function updateMilestones(req: AuthRequest, res: Response) {
  try {
    const { milestones } = req.body as {
      milestones?: Array<{
        milestone_id: number;
        completed?: boolean;
        invoice_sent_date?: string | null;
        payment_received_date?: string | null;
        notes?: string | null;
        due_date?: string | null;
        title?: string | null;
        trigger_text?: string | null;
        amount_value?: number | null;
        amount_currency?: string | null;
        ordinal?: number | null;
      }>;
    };

    if (!Array.isArray(milestones) || milestones.length === 0) {
      return res.status(400).json({ error: 'Milestones payload is required' });
    }

    const milestoneIds = milestones
      .map((item) => Number(item.milestone_id))
      .filter((id) => Number.isFinite(id));
    const accessCheck = await verifyMilestoneProjectAccess(milestoneIds, req.user);
    if (!accessCheck.ok) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    // Process each milestone update sequentially to avoid transaction timeout
    for (const milestone of milestones) {
      const milestoneId = Number(milestone.milestone_id);
      if (Number.isNaN(milestoneId)) {
        throw new Error('Invalid milestone ID');
      }

      const updateExpressions: Prisma.Sql[] = [];

      if (Object.prototype.hasOwnProperty.call(milestone, 'completed')) {
        const completed = Boolean(milestone.completed);
        updateExpressions.push(Prisma.sql`completed = ${completed}`);
        updateExpressions.push(
          Prisma.sql`
            completion_date = CASE
              WHEN ${completed} = true AND completed = false THEN NOW()
              WHEN ${completed} = false THEN NULL
              ELSE completion_date
            END
          `
        );
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'invoice_sent_date')) {
        const invoiceDate = parseDate(milestone.invoice_sent_date);
        updateExpressions.push(Prisma.sql`invoice_sent_date = ${invoiceDate}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'payment_received_date')) {
        const paymentDate = parseDate(milestone.payment_received_date);
        updateExpressions.push(Prisma.sql`payment_received_date = ${paymentDate}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'notes')) {
        const notes = parseNullableString(milestone.notes);
        updateExpressions.push(Prisma.sql`notes = ${notes}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'due_date')) {
        const dueDate = parseDate(milestone.due_date);
        updateExpressions.push(Prisma.sql`due_date = ${dueDate}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'title')) {
        const title = parseNullableString(milestone.title);
        updateExpressions.push(Prisma.sql`title = ${title}`);
        updateExpressions.push(Prisma.sql`description = ${title}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'trigger_text')) {
        const triggerText = parseNullableString(milestone.trigger_text);
        updateExpressions.push(Prisma.sql`trigger_text = ${triggerText}`);
        updateExpressions.push(Prisma.sql`raw_fragment = ${triggerText}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'amount_value')) {
        const amountValue = parseNullableNumber(milestone.amount_value);
        updateExpressions.push(Prisma.sql`amount_value = ${amountValue}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'amount_currency')) {
        const currency = parseNullableString(milestone.amount_currency);
        updateExpressions.push(Prisma.sql`amount_currency = ${currency}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'ordinal')) {
        const ordinal = parseNullableNumber(milestone.ordinal);
        updateExpressions.push(Prisma.sql`ordinal = ${ordinal}`);
      }

      if (updateExpressions.length === 0) {
        continue;
      }

      updateExpressions.push(Prisma.sql`updated_at = NOW()`);

      const updateResult = await prisma.$executeRaw(
        Prisma.sql`
          UPDATE billing_milestone
          SET ${Prisma.join(updateExpressions, ', ')}
          WHERE milestone_id = ${milestoneId}
        `
      );

      logger.info('Milestone updated', { milestoneId, rowsAffected: updateResult });
    }

    // Auto-resolve pending triggers for milestones marked complete via dialog
    const completedMilestoneIds = milestones
      .filter((m) => m.completed === true)
      .map((m) => Number(m.milestone_id))
      .filter((id) => Number.isFinite(id));

    if (completedMilestoneIds.length > 0) {
      try {
        const resolvedBy = req.user?.userId ?? null;
        await prisma.$executeRaw`
          UPDATE billing_milestone_trigger_queue
          SET status = 'confirmed',
              confirmed_by = ${resolvedBy},
              confirmed_at = NOW(),
              action_taken = 'auto_resolved_dialog'
          WHERE milestone_id = ANY(${completedMilestoneIds}::bigint[])
            AND status = 'pending'
        `;
      } catch (resolveErr) {
        logger.error('Failed to auto-resolve pending triggers for dialog-completed milestones', {
          error: resolveErr instanceof Error ? resolveErr.message : String(resolveErr),
          milestoneIds: completedMilestoneIds,
        });
      }
    }

    if (req.user?.userId) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          actionType: 'update',
          entityType: 'billing_milestone',
          entityId: milestones[0].milestone_id,
          description: `Updated ${milestones.length} billing milestones`,
        },
      });
    }

    // Set cache-control headers to prevent stale data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating milestones', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to update milestones' });
  }
}

export async function createMilestone(req: AuthRequest, res: Response) {
  try {
    let engagementIdBigInt: bigint;
    try {
      engagementIdBigInt = parseNumericIdParam(req.params.engagementId, 'engagement ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const engagement = await prisma.$queryRaw<{ engagement_id: bigint }[]>`
      SELECT engagement_id
      FROM billing_engagement
      WHERE engagement_id = ${engagementIdBigInt}
      LIMIT 1
    `;

    if (!engagement || engagement.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const engagementProject = await prisma.$queryRaw<{ project_id: bigint }[]>`
      SELECT cm.project_id
      FROM billing_engagement e
      JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
      WHERE e.engagement_id = ${engagementIdBigInt}
      LIMIT 1
    `;

    if (!engagementProject.length) {
      return res.status(404).json({ error: 'Engagement project mapping not found' });
    }

    const hasAccess = await canAccessBillingProject(engagementProject[0].project_id, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied - Project not assigned to you' });
    }

    const feeRecord = await prisma.$queryRaw<{ fee_id: bigint }[]>`
      SELECT fee_id
      FROM billing_fee_arrangement
      WHERE engagement_id = ${engagementIdBigInt}
      LIMIT 1
    `;

    const { body } = req;
    const title = parseNullableString(body?.title);
    const triggerText = parseNullableString(body?.trigger_text);
    const notes = parseNullableString(body?.notes);
    const dueDate = parseDate(body?.due_date);
    const invoiceDate = parseDate(body?.invoice_sent_date);
    const paymentDate = parseDate(body?.payment_received_date);
    const amountValue = parseNullableNumber(body?.amount_value);
    const amountCurrency = parseNullableString(body?.amount_currency);
    const ordinal = parseNullableNumber(body?.ordinal);
    const completed = Boolean(body?.completed);

    const nextSort = await prisma.$queryRaw<{ next_sort: number }[]>`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort
      FROM billing_milestone
      WHERE engagement_id = ${engagementIdBigInt}
    `;

    const sortOrder = nextSort[0]?.next_sort ?? 1;

    const inserted = await prisma.$queryRaw<{ milestone_id: bigint }[]>`
      INSERT INTO billing_milestone (
        engagement_id,
        fee_id,
        ordinal,
        title,
        description,
        trigger_type,
        trigger_text,
        amount_value,
        amount_currency,
        is_percent,
        percent_value,
        due_date,
        completed,
        completion_date,
        invoice_sent_date,
        payment_received_date,
        notes,
        raw_fragment,
        sort_order,
        created_at,
        updated_at
      ) VALUES (
        ${engagementIdBigInt},
        ${feeRecord[0]?.fee_id ?? null},
        ${ordinal},
        ${title},
        ${title},
        'manual',
        ${triggerText},
        ${amountValue},
        ${amountCurrency},
        false,
        NULL,
        ${dueDate},
        ${completed},
        CASE WHEN ${completed} THEN NOW() ELSE NULL END,
        ${invoiceDate},
        ${paymentDate},
        ${notes},
        ${triggerText ?? title},
        ${sortOrder},
        NOW(),
        NOW()
      )
      RETURNING milestone_id
    `;

    const milestoneId = inserted[0]?.milestone_id;

    if (!milestoneId) {
      throw new Error('Failed to create milestone');
    }

    if (req.user?.userId) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          actionType: 'create',
          entityType: 'billing_milestone',
          entityId: toSafeNumber(milestoneId),
          description: `Created billing milestone for engagement ${engagementIdBigInt.toString()}`,
        },
      });
    }

    res.json(convertBigIntToNumber({ success: true, milestone_id: milestoneId }));
  } catch (error) {
    logger.error('Error creating milestone', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to create milestone' });
  }
}

export async function deleteMilestone(req: AuthRequest, res: Response) {
  try {
    let milestoneIdBigInt: bigint;
    try {
      milestoneIdBigInt = parseNumericIdParam(req.params.milestoneId, 'milestone ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const milestoneProject = await prisma.$queryRaw<{ project_id: bigint }[]>(Prisma.sql`
      SELECT cm.project_id
      FROM billing_milestone m
      JOIN billing_engagement e ON e.engagement_id = m.engagement_id
      JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
      WHERE m.milestone_id = ${milestoneIdBigInt}
      LIMIT 1
    `);

    if (!milestoneProject.length) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const hasAccess = await canAccessBillingProject(milestoneProject[0].project_id, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied - Project not assigned to you' });
    }

    const deleted = await prisma.$queryRaw<{ milestone_id: bigint }[]>`
      DELETE FROM billing_milestone
      WHERE milestone_id = ${milestoneIdBigInt}
      RETURNING milestone_id
    `;

    if (!deleted || deleted.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (req.user?.userId) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          actionType: 'delete',
          entityType: 'billing_milestone',
          entityId: toSafeNumber(milestoneIdBigInt),
          description: `Deleted billing milestone ${milestoneIdBigInt.toString()}`,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting milestone', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to delete milestone' });
  }
}
