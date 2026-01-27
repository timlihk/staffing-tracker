/**
 * Billing Financials Controller
 *
 * Financial endpoints for billing module
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import {
  parseNumericIdParam,
  parseNullableNumber,
  toSafeNumber,
} from './billing.utils';

/**
 * PATCH /api/billing/projects/:id/financials
 * Update UBT and Billing Credits for a project
 */
export async function updateFinancials(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { ubt_usd, ubt_cny, billing_credit_usd, billing_credit_cny } = req.body;
    const userId = req.user?.userId;

    let projectIdBigInt: bigint;
    try {
      projectIdBigInt = parseNumericIdParam(id, 'project ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const engagements = await prisma.billing_engagement.findMany({
      where: { project_id: projectIdBigInt },
      select: { engagement_id: true },
    });

    if (!engagements.length) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    // Update financials
    await prisma.$executeRaw`
      UPDATE billing_engagement
      SET
        ubt_usd = ${parseNullableNumber(ubt_usd) ?? 0},
        ubt_cny = ${parseNullableNumber(ubt_cny) ?? 0},
        billing_credit_usd = ${parseNullableNumber(billing_credit_usd) ?? 0},
        billing_credit_cny = ${parseNullableNumber(billing_credit_cny) ?? 0},
        financials_last_updated_at = NOW(),
        financials_last_updated_by = ${userId}
      WHERE project_id = ${projectIdBigInt}
    `;

    const activityEntityId = toSafeNumber(projectIdBigInt);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        actionType: 'update',
        entityType: 'billing_financials',
        entityId: activityEntityId,
        description: `Updated UBT and Billing Credits for billing project ${projectIdBigInt.toString()} (${engagements.length} engagement${engagements.length === 1 ? '' : 's'})`,
      },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating financials', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to update financials' });
  }
}
