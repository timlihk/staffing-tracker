/**
 * Billing Attorney Mapping Service
 *
 * Handles the relationship between billing system attorney names
 * and staffing system Staff records through the mapping table.
 */

import prisma from '../utils/prisma';
import { parseAttorneyNames, normalizeAttorneyName } from '../utils/billing-attorney-parser';

interface AttorneyStaffMapping {
  attorneyName: string;
  staff: {
    id: number;
    name: string;
    email: string | null;
    position: string;
  } | null;
  matchConfidence: number | null;
  isAutoMapped: boolean;
  isManuallyConfirmed: boolean;
}

/**
 * Get staff members mapped to attorneys for a billing project
 *
 * @param projectId - Billing project ID
 * @returns Array of attorney-to-staff mappings
 */
export async function getBillingProjectAttorneys(projectId: bigint): Promise<AttorneyStaffMapping[]> {
  // Get the billing project
  const project = await prisma.billing_project.findUnique({
    where: { project_id: projectId },
    select: { attorney_in_charge: true }
  });

  if (!project || !project.attorney_in_charge) {
    return [];
  }

  // Parse attorney names from the string field
  const attorneyNames = parseAttorneyNames(project.attorney_in_charge);

  // Get mappings for these attorneys
  const mappings = await prisma.billing_bc_attorney_staff_map.findMany({
    where: {
      billing_attorney_name: { in: attorneyNames }
    },
    include: {
      staff: {
        select: {
          id: true,
          name: true,
          email: true,
          position: true
        }
      }
    }
  });

  // Create a map for quick lookup
  const mappingMap = new Map(
    mappings.map(m => [m.billing_attorney_name, m])
  );

  // Return results for all attorneys (even unmapped ones)
  return attorneyNames.map(attorneyName => {
    const mapping = mappingMap.get(attorneyName);

    return {
      attorneyName,
      staff: mapping?.staff || null,
      matchConfidence: mapping?.match_confidence ? Number(mapping.match_confidence) : null,
      isAutoMapped: mapping?.is_auto_mapped || false,
      isManuallyConfirmed: !!mapping?.manually_confirmed_by
    };
  });
}

/**
 * Get all billing projects for a specific staff member
 * (where they are mapped as B&C attorney)
 *
 * @param staffId - Staff ID
 * @returns Array of billing projects
 */
export async function getBillingProjectsForStaff(staffId: number) {
  // Get all attorney names mapped to this staff member
  const mappings = await prisma.billing_bc_attorney_staff_map.findMany({
    where: { staff_id: staffId },
    select: { billing_attorney_name: true }
  });

  const attorneyNames = mappings.map(m => m.billing_attorney_name);

  if (attorneyNames.length === 0) {
    return [];
  }

  // Find all billing projects where attorney_in_charge contains any of these names
  // Note: This requires a SQL LIKE query for each name
  const projects = await prisma.billing_project.findMany({
    where: {
      OR: attorneyNames.map(name => ({
        attorney_in_charge: { contains: name }
      }))
    },
    include: {
      billing_engagement: {
        select: {
          engagement_id: true,
          engagement_code: true,
          billing_milestone: {
            where: { completed: false },
            select: {
              milestone_id: true,
              title: true,
              amount_value: true,
              amount_currency: true,
              due_date: true
            }
          }
        }
      },
      billing_staffing_project_link: {
        include: {
          projects: {
            select: {
              id: true,
              name: true,
              status: true
            }
          }
        }
      }
    }
  });

  return projects;
}

/**
 * Get unmapped attorney names from billing projects
 * These are attorneys in the billing system that haven't been linked to staff
 *
 * @returns Array of unmapped attorney names with project counts
 */
export async function getUnmappedAttorneys() {
  // Get all billing projects
  const projects = await prisma.billing_project.findMany({
    select: {
      project_id: true,
      project_name: true,
      attorney_in_charge: true
    }
  });

  // Get all mapped attorney names
  const mappedAttorneys = await prisma.billing_bc_attorney_staff_map.findMany({
    select: { billing_attorney_name: true }
  });

  const mappedSet = new Set(mappedAttorneys.map(m => m.billing_attorney_name));

  // Parse all attorney names and find unmapped ones
  const attorneyProjectCount = new Map<string, { count: number; projectIds: bigint[] }>();

  for (const project of projects) {
    const names = parseAttorneyNames(project.attorney_in_charge);

    for (const name of names) {
      if (!mappedSet.has(name)) {
        const existing = attorneyProjectCount.get(name) || { count: 0, projectIds: [] };
        existing.count++;
        existing.projectIds.push(project.project_id);
        attorneyProjectCount.set(name, existing);
      }
    }
  }

  // Convert to array and sort by count
  return Array.from(attorneyProjectCount.entries())
    .map(([attorneyName, data]) => ({
      attorneyName,
      projectCount: data.count,
      sampleProjectIds: data.projectIds.slice(0, 3) // First 3 projects
    }))
    .sort((a, b) => b.projectCount - a.projectCount);
}

/**
 * Create a manual mapping between a billing attorney name and staff member
 *
 * @param attorneyName - Attorney name from billing system
 * @param staffId - Staff ID to map to
 * @param userId - User ID creating the mapping
 * @param confidence - Optional confidence score (0.00-1.00)
 * @param notes - Optional notes
 */
export async function createAttorneyMapping(
  attorneyName: string,
  staffId: number,
  userId: number,
  confidence: number = 1.0,
  notes?: string
) {
  // Normalize the attorney name
  const normalized = normalizeAttorneyName(attorneyName);

  // Check if staff exists
  const staff = await prisma.staff.findUnique({
    where: { id: staffId }
  });

  if (!staff) {
    throw new Error(`Staff member with ID ${staffId} not found`);
  }

  // Create or update mapping
  const mapping = await prisma.billing_bc_attorney_staff_map.upsert({
    where: { billing_attorney_name: normalized },
    update: {
      staff_id: staffId,
      match_confidence: confidence,
      is_auto_mapped: false,
      manually_confirmed_by: userId,
      confirmed_at: new Date(),
      notes: notes || null
    },
    create: {
      billing_attorney_name: normalized,
      staff_id: staffId,
      match_confidence: confidence,
      is_auto_mapped: false,
      manually_confirmed_by: userId,
      confirmed_at: new Date(),
      notes: notes || null
    }
  });

  return mapping;
}

/**
 * Get suggested staff matches for an unmapped attorney name
 * Uses fuzzy string matching
 *
 * @param attorneyName - Attorney name from billing system
 * @returns Array of potential staff matches with confidence scores
 */
export async function getSuggestedStaffMatches(attorneyName: string) {
  const normalized = normalizeAttorneyName(attorneyName);

  // Get all active staff
  const staff = await prisma.staff.findMany({
    where: {
      status: 'active',
      position: {
        in: ['Partner', 'Counsel', 'Of Counsel'] // B&C attorneys are typically senior
      }
    },
    select: {
      id: true,
      name: true,
      email: true,
      position: true
    }
  });

  // Simple fuzzy matching - calculate similarity scores
  const matches = staff.map(s => ({
    staff: s,
    confidence: calculateNameSimilarity(normalized, s.name)
  }))
    .filter(m => m.confidence > 0.5) // Only return matches above 50%
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5); // Top 5 matches

  return matches;
}

/**
 * Simple string similarity calculation (Levenshtein-based)
 * Returns a value between 0 and 1
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const s1 = name1.toLowerCase().trim();
  const s2 = name2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.9;
  }

  // Levenshtein distance
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  const similarity = 1 - (distance / maxLength);

  return Math.max(0, similarity);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}
