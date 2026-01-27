import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import {
  getEmailSettings,
  updateEmailSettings,
} from '../controllers/email-settings.controller';
import { validate } from '../middleware/validate';
import { updateEmailSettingsSchema } from '../schemas/email-settings.schema';

const router = Router();

/**
 * @openapi
 * /email-settings:
 *   get:
 *     tags: [Settings]
 *     summary: Get email settings
 *     description: Retrieve current email notification settings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *                   description: Whether email notifications are enabled
 *                 reminderFrequency:
 *                   type: string
 *                   description: Frequency of reminder emails
 *                 recipients:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of email recipients
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, asyncHandler(getEmailSettings));

/**
 * @openapi
 * /email-settings:
 *   patch:
 *     tags: [Settings]
 *     summary: Update email settings
 *     description: Configure email notification settings (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *               reminderFrequency:
 *                 type: string
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Email settings updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.patch('/', authenticate, authorize('admin'), validate(updateEmailSettingsSchema), asyncHandler(updateEmailSettings));

export default router;
