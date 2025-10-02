import { Router } from 'express';
import * as staffController from '../controllers/staff.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, staffController.getAllStaff);
router.get('/:id', authenticate, staffController.getStaffById);
router.get('/:id/workload', authenticate, staffController.getStaffWorkload);
router.get('/:id/change-history', authenticate, staffController.getStaffChangeHistory);
router.post('/', authenticate, authorize('admin', 'editor'), staffController.createStaff);
router.put('/:id', authenticate, authorize('admin', 'editor'), staffController.updateStaff);
router.delete('/:id', authenticate, authorize('admin'), staffController.deleteStaff);

export default router;
