import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getProjectReportJson, getProjectReportExcel } from '../controllers/project-report.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * @openapi
 * /project-reports:
 *   get:
 *     tags: [Reports]
 *     summary: Get project report (JSON)
 *     description: Generate and retrieve project report data in JSON format
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Project report data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   projectId:
 *                     type: integer
 *                   projectName:
 *                     type: string
 *                   category:
 *                     type: string
 *                   status:
 *                     type: string
 *                   teamMembers:
 *                     type: array
 *                     items:
 *                       type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, asyncHandler(getProjectReportJson));

/**
 * @openapi
 * /project-reports/excel:
 *   get:
 *     tags: [Reports]
 *     summary: Download project report (Excel)
 *     description: Download project report in Excel format
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file download
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 */
router.get('/excel', authenticate, asyncHandler(getProjectReportExcel));

export default router;
