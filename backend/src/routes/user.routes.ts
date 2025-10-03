import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
} from '../controllers/user.controller';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.post('/:id/reset-password', resetUserPassword);
router.delete('/:id', deleteUser);

export default router;
