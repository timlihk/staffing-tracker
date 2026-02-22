/**
 * Billing Excel Sync Controller
 *
 * Handles upload, preview, and apply of finance department Excel files.
 * Stores each sync run with the Excel file, changes, and summary for audit trail.
 */

import { Response } from 'express';
import { Prisma } from '@prisma/client';
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
    const { file, filename } = req.body;
    if (!file || typeof file !== 'string') {
      return res.status(400).json({ error: 'File data is required (base64 string)' });
    }

    const buffer = Buffer.from(file, 'base64');
    const cleanBuffer = await preprocessExcelBuffer(buffer);
    const rows = await parseExcelFile(cleanBuffer);
    const result = await applyChanges(rows, req.user?.userId);

    // Store sync run in billing_sync_run table
    const summaryJson = {
      projectsUpdated: result.projectsUpdated,
      financialsUpdated: result.financialsUpdated,
      engagementsUpserted: result.engagementsUpserted,
      milestonesCreated: result.milestonesCreated,
      milestonesUpdated: result.milestonesUpdated,
      milestonesMarkedCompleted: result.milestonesMarkedCompleted,
      newCmCount: result.syncRunData.newCms.length,
      updatedCmCount: result.syncRunData.updatedCms.length,
      staffingLinksCount: result.syncRunData.staffingLinks.length,
      unmatchedCount: result.syncRunData.unmatchedNewCms.length,
      skippedCount: result.syncRunData.skippedCms.length,
    };

    const syncRun = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      INSERT INTO billing_sync_run (
        uploaded_by, excel_filename, excel_file, status,
        summary_json, changes_json, staffing_links_json
      ) VALUES (
        ${req.user?.userId ?? null},
        ${filename || 'unknown.xlsx'},
        ${buffer},
        'completed',
        ${JSON.stringify(summaryJson)}::jsonb,
        ${JSON.stringify(result.syncRunData)}::jsonb,
        ${JSON.stringify(result.syncRunData.staffingLinks)}::jsonb
      )
      RETURNING id
    `);

    const syncRunId = syncRun[0].id;

    // Log activity
    if (req.user?.userId) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          actionType: 'import',
          entityType: 'billing_excel_sync',
          entityId: syncRunId,
          description: `Excel sync: ${result.projectsUpdated} projects, ${result.milestonesCreated} milestones created, ${result.milestonesMarkedCompleted} marked completed`,
        },
      });
    }

    return res.json({ ...result, syncRunId });
  } catch (error) {
    logger.error('Error applying Excel sync', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to apply Excel sync',
    });
  }
}

/**
 * GET /billing/excel-sync/history
 * List all sync runs (without Excel file binary).
 */
export async function getSyncHistory(_req: AuthRequest, res: Response): Promise<any> {
  try {
    const runs = await prisma.$queryRaw<Array<{
      id: number;
      uploaded_at: Date;
      uploaded_by: number | null;
      excel_filename: string;
      status: string;
      summary_json: unknown;
      username: string | null;
    }>>(Prisma.sql`
      SELECT s.id, s.uploaded_at, s.uploaded_by, s.excel_filename,
             s.status, s.summary_json, u.username
      FROM billing_sync_run s
      LEFT JOIN users u ON u.id = s.uploaded_by
      ORDER BY s.uploaded_at DESC
      LIMIT 50
    `);

    return res.json(runs);
  } catch (error) {
    logger.error('Error fetching sync history', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to fetch sync history' });
  }
}

/**
 * GET /billing/excel-sync/history/:id
 * Full sync run detail (changes JSON, without the Excel file binary).
 */
export async function getSyncRunDetail(req: AuthRequest, res: Response): Promise<any> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid sync run ID' });
    }

    const runs = await prisma.$queryRaw<Array<{
      id: number;
      uploaded_at: Date;
      uploaded_by: number | null;
      excel_filename: string;
      status: string;
      summary_json: unknown;
      changes_json: unknown;
      staffing_links_json: unknown;
      error_message: string | null;
      username: string | null;
    }>>(Prisma.sql`
      SELECT s.id, s.uploaded_at, s.uploaded_by, s.excel_filename,
             s.status, s.summary_json, s.changes_json, s.staffing_links_json,
             s.error_message, u.username
      FROM billing_sync_run s
      LEFT JOIN users u ON u.id = s.uploaded_by
      WHERE s.id = ${id}
      LIMIT 1
    `);

    if (runs.length === 0) {
      return res.status(404).json({ error: 'Sync run not found' });
    }

    return res.json(runs[0]);
  } catch (error) {
    logger.error('Error fetching sync run detail', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to fetch sync run detail' });
  }
}

/**
 * GET /billing/excel-sync/history/:id/download
 * Download the stored Excel file.
 */
export async function downloadSyncExcel(req: AuthRequest, res: Response): Promise<any> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid sync run ID' });
    }

    const runs = await prisma.$queryRaw<Array<{
      excel_filename: string;
      excel_file: Buffer;
    }>>(Prisma.sql`
      SELECT excel_filename, excel_file
      FROM billing_sync_run
      WHERE id = ${id}
      LIMIT 1
    `);

    if (runs.length === 0) {
      return res.status(404).json({ error: 'Sync run not found' });
    }

    const { excel_filename, excel_file } = runs[0];
    res.setHeader('Content-Disposition', `attachment; filename="${excel_filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(excel_file);
  } catch (error) {
    logger.error('Error downloading sync Excel', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to download Excel file' });
  }
}
