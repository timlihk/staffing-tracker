import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

/**
 * Get email settings (singleton)
 */
export const getEmailSettings = async (req: AuthRequest, res: Response) => {
  try {
    // Get or create settings (there should only be one row)
    let settings = await prisma.emailSettings.findFirst();

    if (!settings) {
      // Create default settings if none exist
      settings = await prisma.emailSettings.create({
        data: {
          emailNotificationsEnabled: true,
          notifyPartner: true,
          notifyAssociate: true,
          notifyJuniorFlic: true,
          notifySeniorFlic: true,
          notifyIntern: true,
          notifyBCWorkingAttorney: true,
        },
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Get email settings error:', error);
    res.status(500).json({ error: 'Failed to get email settings' });
  }
};

/**
 * Update email settings (admin only)
 */
export const updateEmailSettings = async (req: AuthRequest, res: Response) => {
  try {
    const {
      emailNotificationsEnabled,
      notifyPartner,
      notifyAssociate,
      notifyJuniorFlic,
      notifySeniorFlic,
      notifyIntern,
      notifyBCWorkingAttorney,
    } = req.body;

    // Get or create settings
    let settings = await prisma.emailSettings.findFirst();

    if (!settings) {
      settings = await prisma.emailSettings.create({
        data: {
          emailNotificationsEnabled: true,
          notifyPartner: true,
          notifyAssociate: true,
          notifyJuniorFlic: true,
          notifySeniorFlic: true,
          notifyIntern: true,
          notifyBCWorkingAttorney: true,
        },
      });
    }

    // Update settings
    const updatedSettings = await prisma.emailSettings.update({
      where: { id: settings.id },
      data: {
        emailNotificationsEnabled: emailNotificationsEnabled ?? settings.emailNotificationsEnabled,
        notifyPartner: notifyPartner ?? settings.notifyPartner,
        notifyAssociate: notifyAssociate ?? settings.notifyAssociate,
        notifyJuniorFlic: notifyJuniorFlic ?? settings.notifyJuniorFlic,
        notifySeniorFlic: notifySeniorFlic ?? settings.notifySeniorFlic,
        notifyIntern: notifyIntern ?? settings.notifyIntern,
        notifyBCWorkingAttorney: notifyBCWorkingAttorney ?? settings.notifyBCWorkingAttorney,
        updatedBy: req.user?.userId,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'update',
        entityType: 'email_settings',
        entityId: updatedSettings.id,
        description: `Updated email notification settings`,
      },
    });

    res.json(updatedSettings);
  } catch (error) {
    console.error('Update email settings error:', error);
    res.status(500).json({ error: 'Failed to update email settings' });
  }
};
