/**
 * Billing Attorney Controller
 *
 * Attorney endpoints for billing module
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { convertBigIntToNumber } from './billing.utils';

/**
 * GET /api/billing/bc-attorneys
 * Get distinct B&C attorneys used across billing projects (for filters)
 */
export async function listAllBCAttorneys(req: AuthRequest, res: Response) {
  try {
    const attorneys = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT
        s.id AS staff_id,
        s.name,
        s.position
      FROM billing_project_bc_attorneys bpba
      JOIN staff s ON s.id = bpba.staff_id
      ORDER BY s.name
    `;

    res.json(convertBigIntToNumber(attorneys));
  } catch (error) {
    logger.error('Error listing BC attorneys', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to list BC attorneys' });
  }
}
