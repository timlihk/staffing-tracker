import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getStaffingReportJson, getStaffingReportExcel } from '../controllers/reports.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * @openapi
 * /reports/staffing:
 *   get:
 *     tags: [Reports]
 *     summary: Get staffing report (JSON)
 *     description: Generate and retrieve staffing report data in JSON format
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Staffing report data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 staff:
 *                   type: array
 *                   items:
 *                     type: object
 *                 projects:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/staffing', authenticate, asyncHandler(getStaffingReportJson));

/**
 * @openapi
 * /reports/staffing.xlsx:
 *   get:
 *     tags: [Reports]
 *     summary: Download staffing report (Excel)
 *     description: Download staffing report in Excel format
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
router.get('/staffing.xlsx', authenticate, asyncHandler(getStaffingReportExcel));

export default router;
