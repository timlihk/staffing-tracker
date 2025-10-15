/**
 * Quick test script to verify attorney parsing works
 *
 * Run: npx ts-node src/scripts/test-attorney-parser.ts
 */

import { parseAttorneyNames, normalizeAttorneyName, getPrimaryAttorney } from '../utils/billing-attorney-parser';
import { getUnmappedAttorneys, getSuggestedStaffMatches } from '../services/billing-attorney.service';
import prisma from '../utils/prisma';

async function testParser() {
  console.log('🧪 Testing Attorney Name Parser\n');

  // Test 1: Parse single name
  console.log('Test 1: Single name');
  const single = parseAttorneyNames("John Doe");
  console.log(`  Input:  "John Doe"`);
  console.log(`  Output: [${single.map(n => `"${n}"`).join(', ')}]`);
  console.log(`  ✅ ${single.length === 1 ? 'PASS' : 'FAIL'}\n`);

  // Test 2: Parse comma-separated
  console.log('Test 2: Comma-separated');
  const comma = parseAttorneyNames("John Doe, Jane Smith");
  console.log(`  Input:  "John Doe, Jane Smith"`);
  console.log(`  Output: [${comma.map(n => `"${n}"`).join(', ')}]`);
  console.log(`  ✅ ${comma.length === 2 ? 'PASS' : 'FAIL'}\n`);

  // Test 3: Parse "and" separated
  console.log('Test 3: "and" separated');
  const and = parseAttorneyNames("John Doe and Jane Smith");
  console.log(`  Input:  "John Doe and Jane Smith"`);
  console.log(`  Output: [${and.map(n => `"${n}"`).join(', ')}]`);
  console.log(`  ✅ ${and.length === 2 ? 'PASS' : 'FAIL'}\n`);

  // Test 4: Normalize name
  console.log('Test 4: Normalize "LastName, FirstName"');
  const normalized = normalizeAttorneyName("Doe, John");
  console.log(`  Input:  "Doe, John"`);
  console.log(`  Output: "${normalized}"`);
  console.log(`  ✅ ${normalized === 'John Doe' ? 'PASS' : 'FAIL'}\n`);

  // Test 5: Get primary attorney
  console.log('Test 5: Get primary attorney');
  const primary = getPrimaryAttorney("John Doe, Jane Smith, Bob Johnson");
  console.log(`  Input:  "John Doe, Jane Smith, Bob Johnson"`);
  console.log(`  Output: "${primary}"`);
  console.log(`  ✅ ${primary === 'John Doe' ? 'PASS' : 'FAIL'}\n`);
}

async function testRealData() {
  console.log('\n📊 Testing with Real Database Data\n');

  try {
    // Get a sample billing project
    const project = await prisma.billing_project.findFirst({
      where: {
        attorney_in_charge: { not: null }
      },
      select: {
        project_id: true,
        project_name: true,
        attorney_in_charge: true
      }
    });

    if (project) {
      console.log('Sample Billing Project:');
      console.log(`  ID: ${project.project_id}`);
      console.log(`  Name: ${project.project_name}`);
      console.log(`  Attorney Field: "${project.attorney_in_charge}"`);

      const parsed = parseAttorneyNames(project.attorney_in_charge);
      console.log(`  Parsed Names: [${parsed.map(n => `"${n}"`).join(', ')}]`);
      console.log(`  Count: ${parsed.length} attorney(s)\n`);
    } else {
      console.log('  ⚠️  No billing projects found with attorney_in_charge\n');
    }

    // Show unmapped attorneys
    console.log('Unmapped Attorneys:');
    const unmapped = await getUnmappedAttorneys();

    if (unmapped.length === 0) {
      console.log('  ✅ All attorneys are mapped!\n');
    } else {
      console.log(`  Found ${unmapped.length} unmapped attorney names:\n`);
      unmapped.slice(0, 5).forEach((u, i) => {
        console.log(`  ${i + 1}. "${u.attorneyName}" - ${u.projectCount} project(s)`);
      });

      if (unmapped.length > 5) {
        console.log(`  ... and ${unmapped.length - 5} more\n`);
      }

      // Show suggestions for first unmapped attorney
      if (unmapped.length > 0) {
        console.log(`\nSuggested Matches for "${unmapped[0].attorneyName}":`);
        const suggestions = await getSuggestedStaffMatches(unmapped[0].attorneyName);

        if (suggestions.length === 0) {
          console.log('  ⚠️  No matches found (confidence < 0.5)\n');
        } else {
          suggestions.forEach((s, i) => {
            console.log(`  ${i + 1}. ${s.staff.name} (${s.staff.position}) - ${(s.confidence * 100).toFixed(1)}% match`);
          });
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  Attorney Name Parser & Mapper - Test Script');
  console.log('═'.repeat(60) + '\n');

  await testParser();
  await testRealData();

  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ Tests Complete!');
  console.log('═'.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
