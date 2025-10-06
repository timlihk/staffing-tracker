import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getStaffingReportJson, getStaffingReportExcel } from '../controllers/reports.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// All report routes require authentication
router.get('/staffing', authenticate, asyncHandler(getStaffingReportJson));
router.get('/staffing.xlsx', authenticate, asyncHandler(getStaffingReportExcel));

export default router;
