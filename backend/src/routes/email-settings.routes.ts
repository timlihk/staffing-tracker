import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import {
  getEmailSettings,
  updateEmailSettings,
} from '../controllers/email-settings.controller';

const router = Router();

// All users can read settings (needed to determine if emails should be sent)
router.get('/', authenticate, asyncHandler(getEmailSettings));

// Only admins can update settings
router.patch('/', authenticate, authorize('admin'), asyncHandler(updateEmailSettings));

export default router;
