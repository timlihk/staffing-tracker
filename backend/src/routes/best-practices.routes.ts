import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getBestPracticeGuide } from '../controllers/best-practices.controller';

const router = Router();

/**
 * @openapi
 * /best-practices:
 *   get:
 *     tags: [Settings]
 *     summary: Get role-based best practice guide
 *     description: Returns first-principle guidance for project, lifecycle, and billing data entry/editing.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Best practice guide payload
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, getBestPracticeGuide);

export default router;

