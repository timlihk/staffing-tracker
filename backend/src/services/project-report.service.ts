import prisma from '../utils/prisma';

export interface ProjectReportQuery {
  categories?: string;
  statuses?: string;
  priorities?: string;
}

export interface ProjectReportRow {
  name: string;
  projectName: string;
  category: string;
  status: string;
  priority: string | null;

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

  // Build where filter for projects
  const where: any = {};
  if (categories?.length) where.category = { in: categories };
  if (statuses?.length) where.status = { in: statuses };
  if (priorities?.length) where.priority = { in: priorities };

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
              role: true,
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

    // Helper to get staff names by jurisdiction and role
    const getStaffByJurisdictionAndRole = (jurisdiction: string, role: string): string | null => {
      const matches = assignments.filter(
        a => a.jurisdiction === jurisdiction && a.roleInProject === role
      );
      if (matches.length === 0) return null;
      return matches.map(m => m.staff.name).join(', ');
    };

    return {
      name: project.name,
      projectName: project.name, // Using name as name now
      category: project.category,
      status: project.status,
      priority: project.priority,

      // US Law team
      usLawPartner: getStaffByJurisdictionAndRole('US Law', 'Income Partner'),
      usLawAssociate: getStaffByJurisdictionAndRole('US Law', 'Associate'),
      usLawSeniorFlic: getStaffByJurisdictionAndRole('US Law', 'Senior FLIC'),
      usLawJuniorFlic: getStaffByJurisdictionAndRole('US Law', 'Junior FLIC'),
      usLawIntern: getStaffByJurisdictionAndRole('US Law', 'Intern'),

      // HK Law team
      hkLawPartner: getStaffByJurisdictionAndRole('HK Law', 'Income Partner'),
      hkLawAssociate: getStaffByJurisdictionAndRole('HK Law', 'Associate'),
      hkLawSeniorFlic: getStaffByJurisdictionAndRole('HK Law', 'Senior FLIC'),
      hkLawJuniorFlic: getStaffByJurisdictionAndRole('HK Law', 'Junior FLIC'),
      hkLawIntern: getStaffByJurisdictionAndRole('HK Law', 'Intern'),

      // B&C attorney - use direct field or fallback to assignments
      bcAttorney:
        project.bcAttorney ||
        getStaffByJurisdictionAndRole('B&C', 'B&C Working Attorney'),

      // Milestone and notes
      milestone: project.timetable,
      notes: project.notes,
    };
  });

  return rows;
}
