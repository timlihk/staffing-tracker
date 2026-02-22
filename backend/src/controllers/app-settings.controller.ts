import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined;
};

const toOptionalInteger = (value: unknown, min: number, max: number): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  const rounded = Math.floor(numeric);
  return Math.min(Math.max(rounded, min), max);
};

const toOptionalFloat = (value: unknown, min: number, max: number): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  return Math.min(Math.max(numeric, min), max);
};

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
          billingDateSweepEnabled: false,
          billingDateSweepLimit: 2000,
          billingAiSweepEnabled: false,
          billingAiSweepLimit: 300,
          billingAiSweepBatchSize: 20,
          billingAiSweepMinConfidence: 0.75,
          billingAiSweepAutoConfirmConfidence: 0.92,
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
    const enableDataExport = toOptionalBoolean(req.body?.enableDataExport);
    const billingDateSweepEnabled = toOptionalBoolean(req.body?.billingDateSweepEnabled);
    const billingDateSweepLimit = toOptionalInteger(req.body?.billingDateSweepLimit, 1, 10000);
    const billingAiSweepEnabled = toOptionalBoolean(req.body?.billingAiSweepEnabled);
    const billingAiSweepLimit = toOptionalInteger(req.body?.billingAiSweepLimit, 1, 5000);
    const billingAiSweepBatchSize = toOptionalInteger(req.body?.billingAiSweepBatchSize, 1, 50);
    const billingAiSweepMinConfidence = toOptionalFloat(req.body?.billingAiSweepMinConfidence, 0, 1);
    const billingAiSweepAutoConfirmConfidence = toOptionalFloat(
      req.body?.billingAiSweepAutoConfirmConfidence,
      0,
      1
    );

    // Get or create settings
    let settings = await prisma.appSettings.findFirst();

    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          enableDataExport: false,
          billingDateSweepEnabled: false,
          billingDateSweepLimit: 2000,
          billingAiSweepEnabled: false,
          billingAiSweepLimit: 300,
          billingAiSweepBatchSize: 20,
          billingAiSweepMinConfidence: 0.75,
          billingAiSweepAutoConfirmConfidence: 0.92,
        },
      });
    }

    // Update settings
    const updatedSettings = await prisma.appSettings.update({
      where: { id: settings.id },
      data: {
        enableDataExport: enableDataExport ?? settings.enableDataExport,
        billingDateSweepEnabled: billingDateSweepEnabled ?? settings.billingDateSweepEnabled,
        billingDateSweepLimit: billingDateSweepLimit ?? settings.billingDateSweepLimit,
        billingAiSweepEnabled: billingAiSweepEnabled ?? settings.billingAiSweepEnabled,
        billingAiSweepLimit: billingAiSweepLimit ?? settings.billingAiSweepLimit,
        billingAiSweepBatchSize: billingAiSweepBatchSize ?? settings.billingAiSweepBatchSize,
        billingAiSweepMinConfidence:
          billingAiSweepMinConfidence ?? settings.billingAiSweepMinConfidence,
        billingAiSweepAutoConfirmConfidence:
          billingAiSweepAutoConfirmConfidence ?? settings.billingAiSweepAutoConfirmConfidence,
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
        description: [
          `data export ${updatedSettings.enableDataExport ? 'enabled' : 'disabled'}`,
          `date sweep ${updatedSettings.billingDateSweepEnabled ? 'enabled' : 'disabled'}`,
          `ai sweep ${updatedSettings.billingAiSweepEnabled ? 'enabled' : 'disabled'}`,
        ].join(', '),
      },
    });

    res.json(updatedSettings);
  } catch (error) {
    logger.error('Update app settings error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to update app settings' });
  }
};
