import prisma from '../utils/prisma';

export type MissingField = 'filingDate' | 'listingDate' | 'elStatus' | 'bcAttorney';

export interface ProjectData {
  id: number;
  name: string;
  category: string | null;
  filingDate: Date | null;
  listingDate: Date | null;
  elStatus: string | null;
  bcAttorney: string | null;
}

export interface AssignmentData {
  staff: {
    id: number;
    name: string;
    email: string;
  };
  project: ProjectData;
}

export interface PartnerReminderPayload {
  partnerEmail: string;
  partnerName: string;
  projects: Array<{
    id: number;
    name: string;
    category: string;
    missingFields: MissingField[];
  }>;
}

/**
 * Pure function to identify which fields are missing from a project
 * No Prisma dependency - easily unit testable
 */
export function identifyMissingFields(project: ProjectData): MissingField[] {
  const missing: MissingField[] = [];

  if (!project.filingDate) missing.push('filingDate');
  if (!project.listingDate) missing.push('listingDate');
  if (!project.elStatus) missing.push('elStatus');
  if (!project.bcAttorney) missing.push('bcAttorney');

  return missing;
}

/**
 * Pure function to format field names for display
 */
export function formatFieldName(field: MissingField): string {
  const fieldNames: Record<MissingField, string> = {
    filingDate: 'Filing Date',
    listingDate: 'Listing Date',
    elStatus: 'EL Status',
    bcAttorney: 'B&C Attorney',
  };
  return fieldNames[field];
}

/**
 * Pure function to deduplicate projects by partner
 * Handles case where same partner is assigned to same project multiple times (different jurisdictions)
 */
export function deduplicateProjectsByPartner(
  assignments: AssignmentData[]
): Map<number, { email: string; name: string; projects: ProjectData[] }> {
  const partnerMap = new Map<
    number,
    { email: string; name: string; projects: ProjectData[] }
  >();
  const seen = new Set<string>();

  for (const assignment of assignments) {
    const partnerId = assignment.staff.id;
    const projectId = assignment.project.id;
    const key = `${partnerId}-${projectId}`;

    // Skip if we've already seen this partner-project pair
    if (seen.has(key)) continue;
    seen.add(key);

    // Get or create partner entry
    if (!partnerMap.has(partnerId)) {
      partnerMap.set(partnerId, {
        email: assignment.staff.email,
        name: assignment.staff.name,
        projects: [],
      });
    }

    // Add project to partner's list
    partnerMap.get(partnerId)!.projects.push(assignment.project);
  }

  return partnerMap;
}

/**
 * Main query function - gets all partners with projects that have missing information
 * Returns only partners that have at least one project with missing fields
 */
export async function getPartnersWithIncompleteProjects(): Promise<
  PartnerReminderPayload[]
> {
  // Query all partner assignments to Active/Slow-down projects
  // Only include HK Trx and US Trx categories
  // Only include active partners with email addresses
  const assignments = await prisma.projectAssignment.findMany({
    where: {
      project: {
        status: {
          in: ['Active', 'Slow-down'],
        },
        category: {
          in: ['HK Trx', 'US Trx'],
        },
      },
      staff: {
        position: 'Partner',
        status: 'active',
        email: {
          not: null,
        },
      },
    },
    select: {
      staff: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          category: true,
          filingDate: true,
          listingDate: true,
          elStatus: true,
          bcAttorney: true,
        },
      },
    },
  });

  // Deduplicate using pure function
  const partnerMap = deduplicateProjectsByPartner(assignments as AssignmentData[]);

  // Build result array
  const results: PartnerReminderPayload[] = [];

  for (const [partnerId, partnerData] of partnerMap) {
    // Process each project to identify missing fields
    const projectsWithMissing = partnerData.projects
      .map((project) => ({
        id: project.id,
        name: project.name || 'Untitled Project',
        category: project.category || '-',
        missingFields: identifyMissingFields(project),
      }))
      .filter((project) => project.missingFields.length > 0); // Only projects with missing info

    // Only include partner if they have projects with missing fields
    if (projectsWithMissing.length > 0) {
      results.push({
        partnerEmail: partnerData.email,
        partnerName: partnerData.name,
        projects: projectsWithMissing,
      });
    }
  }

  return results;
}
