import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * @openapi
 * /dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get dashboard summary
 *     description: Retrieve high-level statistics and metrics for the dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalProjects:
 *                   type: integer
 *                 activeProjects:
 *                   type: integer
 *                 totalStaff:
 *                   type: integer
 *                 activeStaff:
 *                   type: integer
 *                 totalAssignments:
 *                   type: integer
 *                 projectsNeedingAttention:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/summary', authenticate, asyncHandler(dashboardController.getDashboardSummary));

/**
 * @openapi
 * /dashboard/workload-report:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get workload report
 *     description: Retrieve staff workload distribution and capacity data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workload report data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 staffWorkloads:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       staffId:
 *                         type: integer
 *                       staffName:
 *                         type: string
 *                       activeProjects:
 *                         type: integer
 *                       utilizationPercentage:
 *                         type: number
 *       401:
 *         description: Unauthorized
 */
router.get('/workload-report', authenticate, asyncHandler(dashboardController.getWorkloadReport));

/**
 * @openapi
 * /dashboard/activity-log:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get activity log
 *     description: Retrieve recent system activity and changes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activity log entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   action:
 *                     type: string
 *                   entityType:
 *                     type: string
 *                   entityId:
 *                     type: integer
 *                   performedBy:
 *                     type: string
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get('/activity-log', authenticate, asyncHandler(dashboardController.getActivityLog));

/**
 * @openapi
 * /dashboard/change-history:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get detailed change history
 *     description: Retrieve comprehensive change history across all entities
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed change history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   entityType:
 *                     type: string
 *                   entityId:
 *                     type: integer
 *                   changedBy:
 *                     type: string
 *                   changeType:
 *                     type: string
 *                   changes:
 *                     type: object
 *                   changedAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get('/change-history', authenticate, asyncHandler(dashboardController.getDetailedChangeHistory));

export default router;
