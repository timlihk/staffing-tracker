import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
} from '../controllers/user.controller';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', asyncHandler(listUsers));
router.post('/', asyncHandler(createUser));
router.patch('/:id', asyncHandler(updateUser));
router.post('/:id/reset-password', asyncHandler(resetUserPassword));
router.delete('/:id', asyncHandler(deleteUser));

export default router;
