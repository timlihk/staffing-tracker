/**
 * Admin Routes
 * Routes for administrative operations
 */

import express from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * @openapi
 * /admin/recreate-billing-views:
 *   post:
 *     tags: [Admin]
 *     summary: Recreate billing dashboard views
 *     description: Drops and recreates billing views with latest schema. Requires admin role.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Views recreated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 views:
 *                   type: array
 *                   items:
 *                     type: string
 *                 timestamp:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.post('/recreate-billing-views', authenticate, adminController.recreateBillingViews);

export default router;

/**
 * @openapi
 * /admin/update-billing-financials:
 *   post:
 *     tags: [Admin]
 *     summary: Update billing financials from Excel
 *     description: Reads Excel file and updates billing_project_cm_no table. Requires admin role.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Update completed
 */
import { updateBillingFinancials } from '../controllers/admin.controller';
router.post('/update-billing-financials', authenticate, updateBillingFinancials);
