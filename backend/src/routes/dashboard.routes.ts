import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/summary', authenticate, asyncHandler(dashboardController.getDashboardSummary));
router.get('/workload-report', authenticate, asyncHandler(dashboardController.getWorkloadReport));
router.get('/activity-log', authenticate, asyncHandler(dashboardController.getActivityLog));
router.get('/change-history', authenticate, asyncHandler(dashboardController.getDetailedChangeHistory));

export default router;
