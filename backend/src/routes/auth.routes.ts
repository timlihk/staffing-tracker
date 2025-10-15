import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema, resetPasswordSchema } from '../schemas/auth.schema';
import { passwordResetLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.post('/register', authenticate, authorize('admin'), validate(registerSchema), asyncHandler(authController.register));
router.get('/me', authenticate, asyncHandler(authController.me));
router.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), asyncHandler(authController.resetPassword));

// Refresh token endpoints
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));
router.post('/logout-all', authenticate, asyncHandler(authController.logoutAll));

export default router;
