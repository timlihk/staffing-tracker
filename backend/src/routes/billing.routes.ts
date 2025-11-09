/**
 * Billing Routes
 *
 * API routes for billing module
 */

import express, { Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as billingController from '../controllers/billing.controller';
import prisma from '../utils/prisma';
import { validate } from '../middleware/validate';
import {
  updateFinancialsSchema,
  updateFeeArrangementSchema,
  createMilestoneSchema,
  updateMilestonesSchema,
  linkProjectsSchema,
  mapBCAttorneySchema,
  updateBillingAccessSettingsSchema,
  billingIdParamSchema,
  engagementIdParamSchema,
  milestoneIdParamSchema,
  linkIdParamSchema,
} from '../schemas/billing.schema';

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

/**
 * @openapi
 * /billing/projects:
 *   get:
 *     tags: [Billing]
 *     summary: Get all billing projects
 *     description: Retrieve a list of all billing matters and collections
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of billing projects
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Billing module not enabled or insufficient access
 */
router.get('/projects', authenticate, checkBillingAccess, billingController.getBillingProjects);

/**
 * @openapi
 * /billing/projects/{id}:
 *   get:
 *     tags: [Billing]
 *     summary: Get billing project detail
 *     description: Retrieve detailed information about a specific billing matter
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Billing project ID
 *     responses:
 *       200:
 *         description: Billing project details including engagements and financials
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Billing project not found
 */
router.get('/projects/:id', authenticate, checkBillingAccess, validate(billingIdParamSchema, 'params'), billingController.getBillingProjectDetail);

/**
 * @openapi
 * /billing/projects/{id}/bc-attorneys:
 *   get:
 *     tags: [Billing]
 *     summary: Get B&C attorneys for billing project
 *     description: Retrieve list of B&C attorneys assigned to a billing project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Billing project ID
 *     responses:
 *       200:
 *         description: List of B&C attorneys
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/projects/:id/bc-attorneys', authenticate, checkBillingAccess, validate(billingIdParamSchema, 'params'), billingController.getBillingProjectBCAttorneys);

/**
 * @openapi
 * /billing/bc-attorneys:
 *   get:
 *     tags: [Billing]
 *     summary: List distinct B&C attorneys
 *     description: Returns unique B&C attorneys assigned to billing projects for filter dropdowns
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of B&C attorneys
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/bc-attorneys', authenticate, checkBillingAccess, billingController.listAllBCAttorneys);

/**
 * @openapi
 * /billing/projects/{id}:
 *   put:
 *     tags: [Billing]
 *     summary: Update billing project
 *     description: Update project information including name, client, B&C attorneys, and financials (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Billing project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               project_name:
 *                 type: string
 *               client_name:
 *                 type: string
 *               bc_attorney_staff_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of staff IDs to assign as B&C attorneys
 *               agreed_fee_usd:
 *                 type: number
 *                 nullable: true
 *               agreed_fee_cny:
 *                 type: number
 *                 nullable: true
 *               billing_usd:
 *                 type: number
 *                 nullable: true
 *               billing_cny:
 *                 type: number
 *                 nullable: true
 *               collection_usd:
 *                 type: number
 *                 nullable: true
 *               collection_cny:
 *                 type: number
 *                 nullable: true
 *               ubt_usd:
 *                 type: number
 *                 nullable: true
 *               ubt_cny:
 *                 type: number
 *                 nullable: true
 *               billing_credit_usd:
 *                 type: number
 *                 nullable: true
 *               billing_credit_cny:
 *                 type: number
 *                 nullable: true
 *               bonus_usd:
 *                 type: number
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Billing project updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       404:
 *         description: Billing project not found
 */
router.put('/projects/:id', authenticate, adminOnly, validate(billingIdParamSchema, 'params'), billingController.updateBillingProject);

/**
 * @openapi
 * /billing/projects/{id}/engagement/{engagementId}:
 *   get:
 *     tags: [Billing]
 *     summary: Get engagement detail
 *     description: Retrieve detailed information about a specific engagement within a billing matter
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Billing project ID
 *       - in: path
 *         name: engagementId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Engagement ID
 *     responses:
 *       200:
 *         description: Engagement details including fee arrangement and milestones
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Engagement not found
 */
router.get('/projects/:id/engagement/:engagementId', authenticate, checkBillingAccess, validate(billingIdParamSchema, 'params'), validate(engagementIdParamSchema, 'params'), billingController.getEngagementDetail);

/**
 * @openapi
 * /billing/projects/{id}/cm/{cmId}/engagements:
 *   get:
 *     tags: [Billing]
 *     summary: Get client matter engagements
 *     description: Retrieve all engagements for a specific client matter
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Billing project ID
 *       - in: path
 *         name: cmId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client matter ID
 *     responses:
 *       200:
 *         description: List of engagements for the client matter
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/projects/:id/cm/:cmId/engagements', authenticate, checkBillingAccess, validate(billingIdParamSchema, 'params'), billingController.getCMEngagements);

/**
 * @openapi
 * /billing/projects/{id}/activity:
 *   get:
 *     tags: [Billing]
 *     summary: Get billing project activity
 *     description: Retrieve change history and activity log for a billing project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Billing project ID
 *     responses:
 *       200:
 *         description: Activity log for the billing project
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/projects/:id/activity', authenticate, checkBillingAccess, validate(billingIdParamSchema, 'params'), billingController.getBillingProjectActivity);

/**
 * @openapi
 * /billing/projects/{id}/financials:
 *   patch:
 *     tags: [Billing]
 *     summary: Update billing project financials
 *     description: Update financial information for a billing matter (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Billing project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               totalBilled:
 *                 type: number
 *                 format: decimal
 *               totalCollected:
 *                 type: number
 *                 format: decimal
 *               outstandingAR:
 *                 type: number
 *                 format: decimal
 *     responses:
 *       200:
 *         description: Financials updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.patch('/projects/:id/financials', authenticate, adminOnly, validate(billingIdParamSchema, 'params'), validate(updateFinancialsSchema), billingController.updateFinancials);

/**
 * @openapi
 * /billing/engagements/{engagementId}/fee-arrangement:
 *   patch:
 *     tags: [Billing]
 *     summary: Update engagement fee arrangement
 *     description: Update fee arrangement details for an engagement (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: engagementId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Engagement ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               feeType:
 *                 type: string
 *               totalFee:
 *                 type: number
 *                 format: decimal
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Fee arrangement updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.patch('/engagements/:engagementId/fee-arrangement', authenticate, adminOnly, validate(engagementIdParamSchema, 'params'), validate(updateFeeArrangementSchema), billingController.updateFeeArrangement);

/**
 * @openapi
 * /billing/engagements/{engagementId}/milestones:
 *   post:
 *     tags: [Billing]
 *     summary: Create fee milestone
 *     description: Add a new fee milestone to an engagement (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: engagementId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Engagement ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [description, amount]
 *             properties:
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *                 format: decimal
 *               dueDate:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *     responses:
 *       201:
 *         description: Milestone created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.post('/engagements/:engagementId/milestones', authenticate, adminOnly, validate(engagementIdParamSchema, 'params'), validate(createMilestoneSchema), billingController.createMilestone);

/**
 * @openapi
 * /billing/milestones:
 *   patch:
 *     tags: [Billing]
 *     summary: Update multiple milestones
 *     description: Bulk update fee milestones (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [milestones]
 *             properties:
 *               milestones:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Milestones updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.patch('/milestones', authenticate, adminOnly, validate(updateMilestonesSchema), billingController.updateMilestones);

/**
 * @openapi
 * /billing/milestones/{milestoneId}:
 *   delete:
 *     tags: [Billing]
 *     summary: Delete fee milestone
 *     description: Remove a fee milestone (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: milestoneId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Milestone ID
 *     responses:
 *       200:
 *         description: Milestone deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       404:
 *         description: Milestone not found
 */
router.delete('/milestones/:milestoneId', authenticate, adminOnly, validate(milestoneIdParamSchema, 'params'), billingController.deleteMilestone);

// ============================================================================
// Project Mapping
// ============================================================================

/**
 * @openapi
 * /billing/mapping/suggestions:
 *   get:
 *     tags: [Billing]
 *     summary: Get project mapping suggestions
 *     description: Retrieve suggested matches between billing matters and staffing projects (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of mapping suggestions
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.get('/mapping/suggestions', authenticate, adminOnly, billingController.getMappingSuggestions);

/**
 * @openapi
 * /billing/mapping/link:
 *   post:
 *     tags: [Billing]
 *     summary: Link billing project to staffing project
 *     description: Create a mapping between a billing matter and a staffing project (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [billingProjectId, staffingProjectId]
 *             properties:
 *               billingProjectId:
 *                 type: integer
 *               staffingProjectId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Projects linked successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.post('/mapping/link', authenticate, adminOnly, validate(linkProjectsSchema), billingController.linkProjects);

/**
 * @openapi
 * /billing/mapping/suggest/{billingProjectId}:
 *   get:
 *     tags: [Billing]
 *     summary: Get suggested staffing project matches
 *     description: Suggest staffing projects that might match a billing project using fuzzy name matching (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: billingProjectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Billing Project ID
 *     responses:
 *       200:
 *         description: List of suggested matches with similarity scores
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 billing_project:
 *                   type: object
 *                   properties:
 *                     project_id:
 *                       type: integer
 *                     project_name:
 *                       type: string
 *                 existing_link:
 *                   type: object
 *                   nullable: true
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       score:
 *                         type: number
 *                       status:
 *                         type: string
 *                       category:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       404:
 *         description: Billing project not found
 */
router.get('/mapping/suggest/:billingProjectId', authenticate, adminOnly, billingController.suggestProjectMatches);

/**
 * @openapi
 * /billing/mapping/unlink/{linkId}:
 *   delete:
 *     tags: [Billing]
 *     summary: Unlink projects
 *     description: Remove mapping between billing matter and staffing project (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: linkId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Link ID
 *     responses:
 *       200:
 *         description: Projects unlinked successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       404:
 *         description: Link not found
 */
router.delete('/mapping/unlink/:linkId', authenticate, adminOnly, validate(linkIdParamSchema, 'params'), billingController.unlinkProjects);

// ============================================================================
// B&C Attorney Mapping
// ============================================================================

/**
 * @openapi
 * /billing/bc-attorneys/unmapped:
 *   get:
 *     tags: [Billing]
 *     summary: Get unmapped B&C attorneys
 *     description: Retrieve list of B&C attorneys from billing data not yet mapped to staff records (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of unmapped B&C attorneys
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.get('/bc-attorneys/unmapped', authenticate, adminOnly, billingController.getUnmappedAttorneys);

/**
 * @openapi
 * /billing/bc-attorneys/map:
 *   post:
 *     tags: [Billing]
 *     summary: Map B&C attorney to staff record
 *     description: Create mapping between billing system B&C attorney and staffing system staff record (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bcAttorneyId, staffId]
 *             properties:
 *               bcAttorneyId:
 *                 type: integer
 *               staffId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: B&C attorney mapped successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.post('/bc-attorneys/map', authenticate, adminOnly, validate(mapBCAttorneySchema), billingController.mapBCAttorney);

// ============================================================================
// Access Settings
// ============================================================================

/**
 * @openapi
 * /billing/settings/access:
 *   get:
 *     tags: [Billing]
 *     summary: Get billing access settings
 *     description: Retrieve current billing module access configuration (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Billing access settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 billing_module_enabled:
 *                   type: boolean
 *                 access_level:
 *                   type: string
 *                   enum: [admin_only, admin_and_bc_attorney]
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.get('/settings/access', authenticate, adminOnly, billingController.getBillingAccessSettings);

/**
 * @openapi
 * /billing/settings/access:
 *   patch:
 *     tags: [Billing]
 *     summary: Update billing access settings
 *     description: Configure billing module access permissions (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               billing_module_enabled:
 *                 type: boolean
 *               access_level:
 *                 type: string
 *                 enum: [admin_only, admin_and_bc_attorney]
 *     responses:
 *       200:
 *         description: Access settings updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.patch('/settings/access', authenticate, adminOnly, validate(updateBillingAccessSettingsSchema), billingController.updateBillingAccessSettings);

export default router;
