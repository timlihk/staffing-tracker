import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { getAppSettings, updateAppSettings } from '../controllers/app-settings.controller';

const router = Router();

// Get app settings (any authenticated user)
router.get('/', authenticate, getAppSettings);

// Update app settings (admin only)
router.patch('/', authenticate, requireAdmin, updateAppSettings);

export default router;
