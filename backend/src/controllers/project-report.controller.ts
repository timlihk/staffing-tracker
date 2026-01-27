import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { getProjectReport, ProjectReportQuery } from '../services/project-report.service';
import { buildProjectReportWorkbook } from '../services/project-report.excel';
import { isAppError } from '../utils/errors';
import { ControllerError } from '../types/prisma';
import { logger } from '../utils/logger';

const ProjectReportQuerySchema = z.object({
  categories: z.string().optional(),
  statuses: z.string().optional(),
  priorities: z.string().optional(),
  staffId: z.string().regex(/^\d+$/).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
}).partial();

export async function getProjectReportJson(req: AuthRequest, res: Response) {
  try {
    const parse = ProjectReportQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parse.error.flatten() });
    }
    const query: ProjectReportQuery = parse.data;

    const result = await getProjectReport(query);

    res.json({
      data: result.data,
      meta: {
        filters: query,
        pagination: result.pagination,
      },
    });
  } catch (error: ControllerError) {
    logger.error('Get project report error', { error: error instanceof Error ? error.message : String(error) });
    if (isAppError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getProjectReportExcel(req: AuthRequest, res: Response) {
  try {
    const parse = ProjectReportQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parse.error.flatten() });
    }
    const query: ProjectReportQuery = {
      ...parse.data,
      // For Excel export, don't use pagination to get all data
      page: undefined,
      limit: undefined,
    };

    const result = await getProjectReport(query);
    const wb = await buildProjectReportWorkbook(result.data, query);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="project-report-${new Date().toISOString().split('T')[0]}.xlsx"`
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (error: ControllerError) {
    logger.error('Get project report Excel error', { error: error instanceof Error ? error.message : String(error) });
    if (isAppError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
