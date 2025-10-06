import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.post('/login', asyncHandler(authController.login));
router.post('/register', authenticate, authorize('admin'), asyncHandler(authController.register));
router.get('/me', authenticate, asyncHandler(authController.me));
router.post('/reset-password', asyncHandler(authController.resetPassword));

export default router;
