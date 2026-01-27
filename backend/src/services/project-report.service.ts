import prisma, { getCached, setCached, invalidateCache, CACHE_KEYS } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { parseQueryInt } from '../utils/queryParsing';
import logger from '../utils/logger';

export interface ProjectReportQuery {
  categories?: string;
  statuses?: string;
  priorities?: string;
  staffId?: string;
  page?: string;
  limit?: string;
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

export async function getProjectReport(q: ProjectReportQuery): Promise<{
  data: ProjectReportRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
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

  // Add pagination with reasonable defaults
  const pageNum = parseQueryInt(q.page || '1', { default: 1, min: 1 });
  const limitNum = parseQueryInt(q.limit || '50', { default: 50, min: 1, max: 200 });
  const skip = (pageNum - 1) * limitNum;

  // Generate cache key based on query parameters including pagination
  const cacheKey = CACHE_KEYS.PROJECT_REPORT(
    `categories=${categories}&statuses=${statuses}&priorities=${priorities}&staffId=${staffId}&page=${pageNum}&limit=${limitNum}`
  );

  // Try to get from cache first
  const cached = getCached(cacheKey);
  if (cached && typeof cached === 'object' && 'data' in cached && 'pagination' in cached) {
    logger.debug('[Project Report] Cache hit');
    return cached as {
      data: ProjectReportRow[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };
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

  logger.debug('[Project Report] Filter WHERE', { where });

  // Fetch projects with their assignments - optimized with selective fields and pagination
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        category: true,
        status: true,
        priority: true,
        filingDate: true,
        listingDate: true,
        bcAttorney: true,
        timetable: true,
        notes: true,
        assignments: {
          select: {
            jurisdiction: true,
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
      skip,
      take: limitNum,
    }),
    prisma.project.count({ where }),
  ]);

  logger.debug('[Project Report] Found projects', {
    count: projects.length,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });

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

  const response = {
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };

  // Cache the response
  setCached(cacheKey, response);

  return response;
}
