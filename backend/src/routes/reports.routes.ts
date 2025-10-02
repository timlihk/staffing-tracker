import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getStaffingReportJson, getStaffingReportExcel } from '../controllers/reports.controller';

const router = Router();

// All report routes require authentication
router.get('/staffing', authenticate, getStaffingReportJson);
router.get('/staffing.xlsx', authenticate, getStaffingReportExcel);

export default router;
