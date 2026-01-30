import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

/**
 * Get app settings (singleton)
 */
export const getAppSettings = async (req: AuthRequest, res: Response) => {
  try {
    // Get or create settings (there should only be one row)
    let settings = await prisma.appSettings.findFirst();

    if (!settings) {
      // Create default settings if none exist (export disabled by default for confidentiality)
      settings = await prisma.appSettings.create({
        data: {
          enableDataExport: false,
        },
      });
    }

    res.json(settings);
  } catch (error) {
    logger.error('Get app settings error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to get app settings' });
  }
};

/**
 * Update app settings (admin only)
 */
export const updateAppSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { enableDataExport } = req.body;

    // Get or create settings
    let settings = await prisma.appSettings.findFirst();

    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          enableDataExport: false,
        },
      });
    }

    // Update settings
    const updatedSettings = await prisma.appSettings.update({
      where: { id: settings.id },
      data: {
        enableDataExport: enableDataExport ?? settings.enableDataExport,
        updatedBy: req.user?.userId,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'update',
        entityType: 'app_settings',
        entityId: updatedSettings.id,
        description: `Updated app settings: data export ${updatedSettings.enableDataExport ? 'enabled' : 'disabled'}`,
      },
    });

    res.json(updatedSettings);
  } catch (error) {
    logger.error('Update app settings error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to update app settings' });
  }
};
