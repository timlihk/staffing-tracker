import prisma from '../utils/prisma';
import type { ReportRow, ReportQuery } from '../types/reports.types';

// Helper: parse comma-separated query into string[]
const csvToArray = (v?: string) =>
  v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined;

export async function getStaffingReport(q: ReportQuery): Promise<ReportRow[]> {
  const categories = csvToArray(q.categories);
  const staffRoles = csvToArray(q.staffRoles);
  const priorities = csvToArray(q.priorities);
  const statuses = csvToArray(q.statuses);
  const jurisdictions = csvToArray(q.jurisdictions);

  const dateFrom = q.dateFrom ? new Date(q.dateFrom) : undefined;
  const dateTo = q.dateTo ? new Date(q.dateTo) : undefined;

  // Build Prisma "where" filters
  const where: any = {};

  // Date range filter (assignments that overlap the date range)
  if (dateFrom && dateTo) {
    where.OR = [
      {
        AND: [
          { startDate: { lte: dateTo } },
          {
            OR: [
              { endDate: { gte: dateFrom } },
              { endDate: null }, // ongoing assignments
            ],
          },
        ],
      },
    ];
  }

  // Project filters
  if (categories?.length || priorities?.length || statuses?.length) {
    where.project = {};
    if (categories?.length) where.project.category = { in: categories };
    if (priorities?.length) where.project.priority = { in: priorities };
    if (statuses?.length) where.project.status = { in: statuses };
  }

  // Staff filters
  if (staffRoles?.length) {
    where.staff = { role: { in: staffRoles } };
  }

  // Jurisdiction filter
  if (jurisdictions?.length) {
    where.jurisdiction = { in: jurisdictions };
  }

  console.log('[Reports Service] Filter WHERE:', JSON.stringify(where, null, 2));

  const assignments = await prisma.projectAssignment.findMany({
    where,
    include: {
      project: {
        select: {
          name: true,
          category: true,
          priority: true,
          status: true,
          elStatus: true,
          timetable: true,
        },
      },
      staff: {
        select: {
          name: true,
          role: true,
          department: true,
        },
      },
    },
    orderBy: [
      { project: { name: 'asc' } },
      { staff: { name: 'asc' } },
      { startDate: 'asc' },
    ],
    take: 10000, // Safety limit
  });

  console.log(`[Reports Service] Found ${assignments.length} assignments`);

  // Map DB → report row
  const rows: ReportRow[] = assignments.map(a => ({
    name: a.project.name,
    projectName: a.project.name,
    category: a.project.category,
    priority: a.project.priority,
    status: a.project.status,
    elStatus: a.project.elStatus,
    timetable: a.project.timetable || null,
    staffName: a.staff.name,
    staffRole: a.staff.role,
    staffDepartment: a.staff.department,
    roleInProject: a.roleInProject,
    jurisdiction: a.jurisdiction,
    allocationPct: a.allocationPercentage,
    isLead: a.isLead,
    startDate: a.startDate?.toISOString() || null,
    endDate: a.endDate?.toISOString() || null,
  }));

  return rows;
}
