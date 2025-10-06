import { Router } from 'express';
import * as staffController from '../controllers/staff.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/', authenticate, asyncHandler(staffController.getAllStaff));
router.get('/:id', authenticate, asyncHandler(staffController.getStaffById));
router.get('/:id/workload', authenticate, asyncHandler(staffController.getStaffWorkload));
router.get('/:id/change-history', authenticate, asyncHandler(staffController.getStaffChangeHistory));
router.post('/', authenticate, authorize('admin', 'editor'), asyncHandler(staffController.createStaff));
router.put('/:id', authenticate, authorize('admin', 'editor'), asyncHandler(staffController.updateStaff));
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(staffController.deleteStaff));

export default router;
