import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getEmailSettings,
  updateEmailSettings,
} from '../controllers/email-settings.controller';

const router = Router();

// All users can read settings (needed to determine if emails should be sent)
router.get('/', authenticate, getEmailSettings);

// Only admins can update settings
router.patch('/', authenticate, authorize('admin'), updateEmailSettings);

export default router;
