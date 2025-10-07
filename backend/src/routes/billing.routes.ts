/**
 * Billing Routes
 *
 * API routes for billing module
 */

import express, { Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as billingController from '../controllers/billing.controller';
import prisma from '../utils/prisma';

const router = express.Router();

/**
 * Middleware: Check billing access permission
 */
async function checkBillingAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.$queryRaw<any[]>`
      SELECT * FROM billing_access_settings ORDER BY id DESC LIMIT 1
    `;

    const billingSettings = settings && settings.length > 0
      ? settings[0]
      : { billing_module_enabled: false, access_level: 'admin_only' };

    // Check if billing module is enabled
    if (!billingSettings.billing_module_enabled) {
      return res.status(403).json({ error: 'Billing module is not enabled' });
    }

    const user = req.user;
    const isAdmin = user?.role === 'admin';

    // Admin always has access
    if (isAdmin) {
      return next();
    }

    // For admin_only mode, deny non-admins
    if (billingSettings.access_level === 'admin_only') {
      return res.status(403).json({ error: 'Access denied - Admin only' });
    }

    // For admin_and_bc_attorney mode, check if user is B&C attorney
    if (billingSettings.access_level === 'admin_and_bc_attorney') {
      // Get full user record with staffId
      const dbUser = user?.userId
        ? await prisma.user.findUnique({
            where: { id: user.userId },
            select: { staffId: true },
          })
        : null;

      if (!dbUser?.staffId) {
        return res.status(403).json({ error: 'Access denied - No staff record' });
      }

      const staff = await prisma.staff.findUnique({
        where: { id: dbUser.staffId },
        select: { position: true },
      });

      if (staff?.position !== 'B&C Working Attorney') {
        return res.status(403).json({ error: 'Access denied - Not a B&C attorney' });
      }

      return next();
    }

    // Default deny
    res.status(403).json({ error: 'Access denied' });
  } catch (error) {
    console.error('Error checking billing access:', error);
    res.status(500).json({ error: 'Failed to check billing access' });
  }
}

/**
 * Middleware: Admin only
 */
function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied - Admin only' });
  }
  next();
}

// ============================================================================
// Billing Projects
// ============================================================================

router.get('/projects', authenticate, checkBillingAccess, billingController.getBillingProjects);
router.get('/projects/:id', authenticate, checkBillingAccess, billingController.getBillingProjectDetail);
router.patch('/projects/:id/financials', authenticate, adminOnly, billingController.updateFinancials);

// ============================================================================
// Project Mapping
// ============================================================================

router.get('/mapping/suggestions', authenticate, adminOnly, billingController.getMappingSuggestions);
router.post('/mapping/link', authenticate, adminOnly, billingController.linkProjects);
router.delete('/mapping/unlink/:linkId', authenticate, adminOnly, billingController.unlinkProjects);

// ============================================================================
// B&C Attorney Mapping
// ============================================================================

router.get('/bc-attorneys/unmapped', authenticate, adminOnly, billingController.getUnmappedAttorneys);
router.post('/bc-attorneys/map', authenticate, adminOnly, billingController.mapBCAttorney);

// ============================================================================
// Access Settings
// ============================================================================

router.get('/settings/access', authenticate, adminOnly, billingController.getBillingAccessSettings);
router.patch('/settings/access', authenticate, adminOnly, billingController.updateBillingAccessSettings);

export default router;
