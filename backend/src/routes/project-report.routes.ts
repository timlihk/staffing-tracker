import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getProjectReportJson, getProjectReportExcel } from '../controllers/project-report.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Mounted at /api/project-reports
router.get('/', authenticate, asyncHandler(getProjectReportJson));
router.get('/excel', authenticate, asyncHandler(getProjectReportExcel));

export default router;
