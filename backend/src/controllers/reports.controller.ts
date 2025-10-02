import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ReportQuerySchema } from '../types/reports.types';
import { getStaffingReport } from '../services/reports.service';
import { buildStaffingWorkbook } from '../services/reports.excel';

export async function getStaffingReportJson(req: AuthRequest, res: Response) {
  try {
    const parse = ReportQuerySchema.safeParse(req.query);

    if (!parse.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: parse.error.flatten(),
      });
    }

    const rows = await getStaffingReport(parse.data);

    // Calculate totals
    const uniqueProjects = new Set(rows.map(r => r.projectCode)).size;
    const uniqueStaff = new Set(rows.map(r => r.staffName)).size;
    const avgAllocation = rows.length > 0
      ? rows.reduce((acc, r) => acc + r.allocationPct, 0) / rows.length
      : null;

    res.json({
      data: rows,
      meta: {
        filters: parse.data,
        totals: {
          rows: rows.length,
          projects: uniqueProjects,
          staff: uniqueStaff,
          avgAllocationPct: avgAllocation,
        },
      },
    });
  } catch (error) {
    console.error('Get staffing report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getStaffingReportExcel(req: AuthRequest, res: Response) {
  try {
    const parse = ReportQuerySchema.safeParse(req.query);

    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }

    const rows = await getStaffingReport(parse.data);
    const wb = await buildStaffingWorkbook(rows, parse.data);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="staffing-report-${new Date().toISOString().split('T')[0]}.xlsx"`
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Get staffing report Excel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
