import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/summary', authenticate, dashboardController.getDashboardSummary);
router.get('/workload-report', authenticate, dashboardController.getWorkloadReport);
router.get('/activity-log', authenticate, dashboardController.getActivityLog);

export default router;
