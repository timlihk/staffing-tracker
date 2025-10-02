import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getProjectReportJson } from '../controllers/project-report.controller';

const router = Router();

router.get('/project-report', authenticate, getProjectReportJson);

export default router;
