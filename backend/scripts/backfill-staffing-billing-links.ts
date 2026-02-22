import 'dotenv/config';
import prisma from '../src/utils/prisma';
import { Prisma } from '@prisma/client';

/**
 * Idempotent backfill: links billing_project → staffing project via C/M number.
 *
 * Strategy 1 (exact):  billing_project_cm_no.cm_no === projects.cm_number
 * Strategy 2 (prefix): same client prefix (e.g. 15322-00024 ↔ 15322-00052)
 *
 * Uses ON CONFLICT DO NOTHING so it's safe to re-run.
 *
 * Env vars:
 *   DRY_RUN=true   — log what would happen without writing
 *   SKIP_PREFIX=true — skip prefix matching (exact only)
 */

interface LinkResult {
  billingProjectId: number;
  billingCmNo: string;
  staffingProjectId: number;
  staffingProjectName: string;
  matchMethod: 'exact' | 'prefix';
  linkCreated: boolean;
  cmNumberSet: boolean;
}

async function main() {
  const dryRun = process.env.DRY_RUN === 'true';
  const skipPrefix = process.env.SKIP_PREFIX === 'true';

  // 1. Load all billing C/M numbers
  const cmRecords = await prisma.billing_project_cm_no.findMany({
    select: { project_id: true, cm_no: true },
    orderBy: { project_id: 'asc' },
  });

  // 2. Load all staffing projects with cmNumber
  const staffingProjects = await prisma.project.findMany({
    where: { cmNumber: { not: null } },
    select: { id: true, name: true, cmNumber: true },
  });
  const staffingByCm = new Map(staffingProjects.map(p => [p.cmNumber!, p]));

  // Build prefix index: client prefix → staffing projects
  const staffingByPrefix = new Map<string, typeof staffingProjects>();
  for (const p of staffingProjects) {
    const prefix = p.cmNumber!.split('-')[0];
    if (!staffingByPrefix.has(prefix)) staffingByPrefix.set(prefix, []);
    staffingByPrefix.get(prefix)!.push(p);
  }

  // 3. Load existing links to skip
  const existingLinks = await prisma.billing_staffing_project_link.findMany({
    select: { billing_project_id: true, staffing_project_id: true },
  });
  const linkSet = new Set(
    existingLinks.map(l => `${l.billing_project_id}:${l.staffing_project_id}`)
  );

  const results: LinkResult[] = [];
  let linksCreated = 0;
  let linksSkipped = 0;
  let cmNumbersSet = 0;

  // 4. Process each billing C/M number
  for (const cm of cmRecords) {
    const billingProjectId = Number(cm.project_id);

    // Strategy 1: exact match
    const exactMatch = staffingByCm.get(cm.cm_no);
    if (exactMatch) {
      const key = `${billingProjectId}:${exactMatch.id}`;
      if (linkSet.has(key)) {
        linksSkipped++;
        continue;
      }

      if (!dryRun) {
        await prisma.$executeRaw(Prisma.sql`
          INSERT INTO billing_staffing_project_link
            (billing_project_id, staffing_project_id, auto_match_score, linked_at, notes)
          VALUES (${BigInt(billingProjectId)}, ${exactMatch.id}, ${1.0}, NOW(),
            ${`Backfill: exact C/M match (${cm.cm_no})`})
          ON CONFLICT (billing_project_id, staffing_project_id) DO NOTHING
        `);
        linkSet.add(key);
      }

      linksCreated++;
      results.push({
        billingProjectId,
        billingCmNo: cm.cm_no,
        staffingProjectId: exactMatch.id,
        staffingProjectName: exactMatch.name,
        matchMethod: 'exact',
        linkCreated: true,
        cmNumberSet: false,
      });
      continue;
    }

    // Strategy 2: prefix match
    if (skipPrefix) continue;

    const cmBase = cm.cm_no.split('-')[0];
    const prefixCandidates = staffingByPrefix.get(cmBase);
    if (!prefixCandidates || prefixCandidates.length === 0) continue;

    // Use first candidate (same as existing autoLink logic)
    const prefixMatch = prefixCandidates[0];
    const key = `${billingProjectId}:${prefixMatch.id}`;
    if (linkSet.has(key)) {
      linksSkipped++;
      continue;
    }

    if (!dryRun) {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO billing_staffing_project_link
          (billing_project_id, staffing_project_id, auto_match_score, linked_at, notes)
        VALUES (${BigInt(billingProjectId)}, ${prefixMatch.id}, ${0.8}, NOW(),
          ${`Backfill: C/M prefix match (${cm.cm_no} → ${prefixMatch.cmNumber})`})
        ON CONFLICT (billing_project_id, staffing_project_id) DO NOTHING
      `);
      linkSet.add(key);
    }

    linksCreated++;
    results.push({
      billingProjectId,
      billingCmNo: cm.cm_no,
      staffingProjectId: prefixMatch.id,
      staffingProjectName: prefixMatch.name,
      matchMethod: 'prefix',
      linkCreated: true,
      cmNumberSet: false,
    });
  }

  // 5. Summary
  const exactCount = results.filter(r => r.matchMethod === 'exact').length;
  const prefixCount = results.filter(r => r.matchMethod === 'prefix').length;

  console.log(JSON.stringify({
    dryRun,
    skipPrefix,
    billingCmRecords: cmRecords.length,
    staffingWithCm: staffingProjects.length,
    existingLinksBefore: existingLinks.length,
    linksCreated,
    linksSkippedExisting: linksSkipped,
    exactMatches: exactCount,
    prefixMatches: prefixCount,
    details: results,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
