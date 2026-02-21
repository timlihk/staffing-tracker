/**
 * Billing Excel Sync Controller
 *
 * Handles upload, preview, and apply of finance department Excel files.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  preprocessExcelBuffer,
  parseExcelFile,
  generatePreview,
  applyChanges,
} from '../services/billing-excel-sync.service';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

export async function previewExcelSync(req: AuthRequest, res: Response): Promise<any> {
  try {
    const { file } = req.body;
    if (!file || typeof file !== 'string') {
      return res.status(400).json({ error: 'File data is required (base64 string)' });
    }

    const buffer = Buffer.from(file, 'base64');
    const cleanBuffer = await preprocessExcelBuffer(buffer);
    const rows = await parseExcelFile(cleanBuffer);
    const preview = await generatePreview(rows);

    return res.json(preview);
  } catch (error) {
    logger.error('Error previewing Excel sync', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to preview Excel file',
    });
  }
}

export async function applyExcelSync(req: AuthRequest, res: Response): Promise<any> {
  try {
    const { file } = req.body;
    if (!file || typeof file !== 'string') {
      return res.status(400).json({ error: 'File data is required (base64 string)' });
    }

    const buffer = Buffer.from(file, 'base64');
    const cleanBuffer = await preprocessExcelBuffer(buffer);
    const rows = await parseExcelFile(cleanBuffer);
    const result = await applyChanges(rows, req.user?.userId);

    // Log activity
    if (req.user?.userId) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          actionType: 'import',
          entityType: 'billing_excel_sync',
          entityId: 0,
          description: `Excel sync: ${result.projectsUpdated} projects, ${result.milestonesCreated} milestones created, ${result.milestonesMarkedCompleted} marked completed`,
        },
      });
    }

    return res.json(result);
  } catch (error) {
    logger.error('Error applying Excel sync', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to apply Excel sync',
    });
  }
}
