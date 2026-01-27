/**
 * Billing Settings Controller
 *
 * Settings endpoints for billing module
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

/**
 * GET /api/billing/settings/access
 * Get billing access settings
 */
export async function getBillingAccessSettings(req: AuthRequest, res: Response) {
  try {
    const settings = await prisma.$queryRaw<any[]>`
      SELECT * FROM billing_access_settings ORDER BY id DESC LIMIT 1
    `;

    if (!settings || settings.length === 0) {
      return res.json({
        billing_module_enabled: false,
        access_level: 'admin_only',
      });
    }

    res.json(settings[0]);
  } catch (error) {
    logger.error('Error fetching billing settings', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to fetch billing settings' });
  }
}

/**
 * PATCH /api/billing/settings/access
 * Update billing access settings
 */
export async function updateBillingAccessSettings(req: AuthRequest, res: Response) {
  try {
    const { billing_module_enabled, access_level } = req.body;
    const userId = req.user?.userId;

    // Use upsert pattern: try to get existing row first
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM billing_access_settings ORDER BY id DESC LIMIT 1
    `;

    if (existing && existing.length > 0) {
      // Update existing row
      await prisma.$executeRaw`
        UPDATE billing_access_settings
        SET
          billing_module_enabled = ${billing_module_enabled},
          access_level = ${access_level},
          updated_by = ${userId},
          updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
    } else {
      // Insert new row if none exists
      await prisma.$executeRaw`
        INSERT INTO billing_access_settings (billing_module_enabled, access_level, updated_by, updated_at)
        VALUES (${billing_module_enabled}, ${access_level}, ${userId}, NOW())
      `;
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating billing settings', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to update billing settings' });
  }
}
