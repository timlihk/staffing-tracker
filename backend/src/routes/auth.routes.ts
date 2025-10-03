import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/login', authController.login);
router.post('/register', authenticate, authorize('admin'), authController.register);
router.get('/me', authenticate, authController.me);
router.post('/reset-password', authController.resetPassword);

export default router;
