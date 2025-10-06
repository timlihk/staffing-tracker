import prisma from '../utils/prisma';
import { AppError } from '../utils/errors';

export interface ProjectReportQuery {
  categories?: string;
  statuses?: string;
  priorities?: string;
  staffId?: string;
}

export interface ProjectReportRow {
  projectId: number;
  name: string;
  projectName: string;
  category: string;
  status: string;
  priority: string | null;
  filingDate: string | null;
  listingDate: string | null;

  // US Law team members by role
  usLawPartner: string | null;
  usLawAssociate: string | null;
  usLawSeniorFlic: string | null;
  usLawJuniorFlic: string | null;
  usLawIntern: string | null;

  // HK Law team members by role
  hkLawPartner: string | null;
  hkLawAssociate: string | null;
  hkLawSeniorFlic: string | null;
  hkLawJuniorFlic: string | null;
  hkLawIntern: string | null;

  // B&C attorney
  bcAttorney: string | null;

  // Milestone and notes
  milestone: string | null;
  notes: string | null;
}

const csvToArray = (v?: string) =>
  v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined;

export async function getProjectReport(q: ProjectReportQuery): Promise<ProjectReportRow[]> {
  const categories = csvToArray(q.categories);
  const statuses = csvToArray(q.statuses);
  const priorities = csvToArray(q.priorities);

  let staffId: number | undefined;
  if (q.staffId) {
    const parsed = parseInt(q.staffId, 10);
    if (Number.isNaN(parsed)) {
      throw AppError.badRequest('Invalid staffId parameter');
    }
    staffId = parsed;
  }

  // Build where filter for projects
  const where: any = {};
  if (categories?.length) where.category = { in: categories };
  if (statuses?.length) where.status = { in: statuses };
  if (priorities?.length) where.priority = { in: priorities };

  // Filter by staff member
  if (staffId) {
    where.assignments = {
      some: {
        staffId: staffId,
      },
    };
  }

  console.log('[Project Report] Filter WHERE:', JSON.stringify(where, null, 2));

  // Fetch all projects with their assignments
  const projects = await prisma.project.findMany({
    where,
    include: {
      assignments: {
        include: {
          staff: {
            select: {
              name: true,
              position: true,
            },
          },
        },
      },
    },
    orderBy: [
      { name: 'asc' },
    ],
  });

  console.log(`[Project Report] Found ${projects.length} projects`);

  // Transform to report rows
  const rows: ProjectReportRow[] = projects.map(project => {
    const assignments = project.assignments || [];

    // Helper to get staff names by jurisdiction and position
    const getStaffByJurisdictionAndPosition = (jurisdiction: string, position: string): string | null => {
      const matches = assignments.filter(
        a => a.jurisdiction === jurisdiction && a.staff.position === position
      );
      if (matches.length === 0) return null;
      return matches.map(m => m.staff.name).join(', ');
    };

    return {
      projectId: project.id,
      name: project.name,
      projectName: project.name, // Using name as name now
      category: project.category,
      status: project.status,
      priority: project.priority,
      filingDate: project.filingDate ? project.filingDate.toISOString() : null,
      listingDate: project.listingDate ? project.listingDate.toISOString() : null,

      // US Law team
      usLawPartner: getStaffByJurisdictionAndPosition('US Law', 'Partner'),
      usLawAssociate: getStaffByJurisdictionAndPosition('US Law', 'Associate'),
      usLawSeniorFlic: getStaffByJurisdictionAndPosition('US Law', 'Senior FLIC'),
      usLawJuniorFlic: getStaffByJurisdictionAndPosition('US Law', 'Junior FLIC'),
      usLawIntern: getStaffByJurisdictionAndPosition('US Law', 'Intern'),

      // HK Law team
      hkLawPartner: getStaffByJurisdictionAndPosition('HK Law', 'Partner'),
      hkLawAssociate: getStaffByJurisdictionAndPosition('HK Law', 'Associate'),
      hkLawSeniorFlic: getStaffByJurisdictionAndPosition('HK Law', 'Senior FLIC'),
      hkLawJuniorFlic: getStaffByJurisdictionAndPosition('HK Law', 'Junior FLIC'),
      hkLawIntern: getStaffByJurisdictionAndPosition('HK Law', 'Intern'),

      // B&C attorney - use direct field or fallback to assignments
      bcAttorney:
        project.bcAttorney ||
        getStaffByJurisdictionAndPosition('B&C', 'B&C Working Attorney'),

      // Milestone and notes
      milestone: project.timetable,
      notes: project.notes,
    };
  });

  return rows;
}
