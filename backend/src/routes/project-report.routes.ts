import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getProjectReportJson, getProjectReportExcel } from '../controllers/project-report.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/project-report', authenticate, asyncHandler(getProjectReportJson));
router.get('/project-report/excel', authenticate, asyncHandler(getProjectReportExcel));

export default router;
