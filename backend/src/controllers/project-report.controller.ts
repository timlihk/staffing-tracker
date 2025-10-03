import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getProjectReport, ProjectReportQuery } from '../services/project-report.service';

export async function getProjectReportJson(req: AuthRequest, res: Response) {
  try {
    const query: ProjectReportQuery = {
      categories: req.query.categories as string | undefined,
      statuses: req.query.statuses as string | undefined,
      priorities: req.query.priorities as string | undefined,
      staffId: req.query.staffId as string | undefined,
    };

    const rows = await getProjectReport(query);

    res.json({
      data: rows,
      meta: {
        filters: query,
        totalProjects: rows.length,
      },
    });
  } catch (error) {
    console.error('Get project report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
