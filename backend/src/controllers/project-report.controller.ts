import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getProjectReport, ProjectReportQuery } from '../services/project-report.service';
import { buildProjectReportWorkbook } from '../services/project-report.excel';

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
  } catch (error: any) {
    console.error('Get project report error:', error);
    if (error.statusCode === 400 && error.userFacing) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getProjectReportExcel(req: AuthRequest, res: Response) {
  try {
    const query: ProjectReportQuery = {
      categories: req.query.categories as string | undefined,
      statuses: req.query.statuses as string | undefined,
      priorities: req.query.priorities as string | undefined,
      staffId: req.query.staffId as string | undefined,
    };

    const rows = await getProjectReport(query);
    const wb = await buildProjectReportWorkbook(rows, query);

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
  } catch (error: any) {
    console.error('Get project report Excel error:', error);
    if (error.statusCode === 400 && error.userFacing) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
