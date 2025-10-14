import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema, resetPasswordSchema } from '../schemas/auth.schema';

const router = Router();

router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.post('/register', authenticate, authorize('admin'), validate(registerSchema), asyncHandler(authController.register));
router.get('/me', authenticate, asyncHandler(authController.me));
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(authController.resetPassword));

export default router;
