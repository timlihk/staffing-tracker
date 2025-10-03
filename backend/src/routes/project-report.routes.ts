import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getProjectReportJson, getProjectReportExcel } from '../controllers/project-report.controller';

const router = Router();

router.get('/project-report', authenticate, getProjectReportJson);
router.get('/project-report/excel', authenticate, getProjectReportExcel);

export default router;
