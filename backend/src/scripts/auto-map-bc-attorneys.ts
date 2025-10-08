/**
 * Auto-map B&C Attorneys from Billing to Staff Table
 *
 * Uses fuzzy name matching to automatically map billing attorney names
 * to staff records in the staffing system.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score (0.0 - 1.0)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalize = (s: string) =>
    s.toLowerCase()
      .trim()
      .replace(/[.,\s]+/g, ' ')
      .replace(/\s+/g, ' ');

  const s1 = normalize(str1);
  const s2 = normalize(str2);

  // Exact match
  if (s1 === s2) return 1.0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const longerLength = Math.max(s1.length, s2.length);
    const shorterLength = Math.min(s1.length, s2.length);
    return shorterLength / longerLength * 0.95; // Slightly less than perfect match
  }

  // Check individual name parts (handles "FirstName LastName" vs "LastName, FirstName")
  const parts1 = s1.split(' ').filter(p => p.length > 0);
  const parts2 = s2.split(' ').filter(p => p.length > 0);

  let matchingParts = 0;
  for (const part1 of parts1) {
    for (const part2 of parts2) {
      if (part1 === part2 || part1.includes(part2) || part2.includes(part1)) {
        matchingParts++;
        break;
      }
    }
  }

  if (matchingParts > 0) {
    const avgParts = (parts1.length + parts2.length) / 2;
    const partScore = matchingParts / avgParts;
    if (partScore > 0.5) return partScore * 0.9;
  }

  // Levenshtein-based similarity
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 0.0;

  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLength);
}

async function autoMapAttorneys() {
  console.log('🔗 Starting B&C Attorney Auto-Mapping...\n');

  // Get all unique attorney names from billing projects
  const billingAttorneys = await prisma.$queryRaw<{ attorney_in_charge: string }[]>`
    SELECT DISTINCT attorney_in_charge
    FROM billing_project
    WHERE attorney_in_charge IS NOT NULL
    AND attorney_in_charge != ''
    ORDER BY attorney_in_charge
  `;

  console.log(`Found ${billingAttorneys.length} unique billing attorneys\n`);

  // Get all active staff (Partners, Associates, etc.)
  const bcStaff = await prisma.staff.findMany({
    where: {
      status: 'active',
      position: {
        in: ['Partner', 'Associate', 'B&C Working Attorney'],
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      position: true,
    },
  });

  console.log(`Found ${bcStaff.length} active attorneys in staff table\n`);

  if (bcStaff.length === 0) {
    console.log('⚠️  No active attorneys found in staff table.');
    console.log('   Please ensure staff records exist.');
    return;
  }

  let autoMapped = 0;
  let needsReview = 0;
  const CONFIDENCE_THRESHOLD = 0.70; // 70% similarity threshold

  for (const { attorney_in_charge } of billingAttorneys) {
    let bestMatch = null;
    let bestScore = 0;

    // Find best matching staff member
    for (const staff of bcStaff) {
      const score = calculateSimilarity(attorney_in_charge, staff.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = staff;
      }
    }

    if (bestMatch && bestScore >= CONFIDENCE_THRESHOLD) {
      // Auto-map with confidence
      await prisma.$executeRaw`
        INSERT INTO billing_bc_attorney_staff_map
        (billing_attorney_name, staff_id, match_confidence, is_auto_mapped)
        VALUES (
          ${attorney_in_charge},
          ${bestMatch.id},
          ${bestScore}::NUMERIC,
          true
        )
        ON CONFLICT (billing_attorney_name) DO NOTHING
      `;

      console.log(`✅ "${attorney_in_charge}" → "${bestMatch.name}" (${Math.round(bestScore * 100)}%)`);
      autoMapped++;

    } else {
      // No confident match - insert with null for manual review
      await prisma.$executeRaw`
        INSERT INTO billing_bc_attorney_staff_map
        (billing_attorney_name, staff_id, match_confidence, is_auto_mapped)
        VALUES (
          ${attorney_in_charge},
          NULL,
          ${bestScore}::NUMERIC,
          false
        )
        ON CONFLICT (billing_attorney_name) DO NOTHING
      `;

      if (bestMatch) {
        console.log(`⚠️  "${attorney_in_charge}" → best: "${bestMatch.name}" (${Math.round(bestScore * 100)}%) - below threshold, needs manual review`);
      } else {
        console.log(`❌ "${attorney_in_charge}" → no match found`);
      }
      needsReview++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Auto-mapped: ${autoMapped}`);
  console.log(`⚠️  Needs manual review: ${needsReview}`);
  console.log('='.repeat(60));

  if (needsReview > 0) {
    console.log('\n📝 Next steps:');
    console.log('   1. Review unmapped attorneys in the admin panel');
    console.log('   2. Manually assign staff members to billing attorneys');
    console.log('   3. Or add missing B&C attorneys to the staff table first');
  }
}

async function main() {
  try {
    await autoMapAttorneys();
  } catch (error) {
    console.error('❌ Error during auto-mapping:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
