/**
 * Dry-run: Show all database updates the Excel sync would produce.
 * Skips AI validation — just parse + show matched updates.
 *
 * Usage: npx ts-node scripts/dry-run-updates.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { preprocessExcelBuffer, parseExcelFile } from '../src/services/billing-excel-sync.service';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const EXCEL_PATH = path.resolve(
  __dirname,
  '../../Billing/HKCM Project List (2026.02.12).xlsx'
);

interface CmRecord {
  cm_id: bigint;
  project_id: bigint;
  cm_no: string;
  billing_to_date_usd: number | null;
  collected_to_date_usd: number | null;
  billing_credit_usd: number | null;
  ubt_usd: number | null;
  ar_usd: number | null;
  billing_credit_cny: number | null;
  ubt_cny: number | null;
  agreed_fee_usd: number | null;
  billed_but_unpaid: number | null;
  unbilled_per_el: number | null;
  finance_remarks: string | null;
  matter_notes: string | null;
}

interface ProjectRecord {
  project_id: bigint;
  project_name: string | null;
  client_name: string | null;
  attorney_in_charge: string | null;
  sca: string | null;
}

async function main() {
  console.log(`Reading: ${EXCEL_PATH}`);
  const raw = fs.readFileSync(EXCEL_PATH);
  const buffer = await preprocessExcelBuffer(raw);
  const rows = await parseExcelFile(buffer);

  const lines: string[] = [];
  lines.push('# HKCM Excel — Dry-Run Updates Report');
  lines.push('');
  lines.push(`**File:** ${path.basename(EXCEL_PATH)}`);
  lines.push(`**Date:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`**Total Excel rows:** ${rows.length}`);
  lines.push('');

  // Group rows by C/M number (sub-rows inherit from parent)
  const cmNumbers = [...new Set(rows.map((r) => r.cmNo))];

  // Fetch all matching C/M records from DB
  const existingCms = await prisma.$queryRaw<CmRecord[]>(Prisma.sql`
    SELECT cm_id, project_id, cm_no,
           billing_to_date_usd, collected_to_date_usd, billing_credit_usd,
           ubt_usd, ar_usd, billing_credit_cny, ubt_cny,
           agreed_fee_usd, billed_but_unpaid, unbilled_per_el,
           finance_remarks, matter_notes
    FROM billing_project_cm_no
    WHERE cm_no IN (${Prisma.join(cmNumbers.map((c) => Prisma.sql`${c}`))})
  `);
  const cmMap = new Map(existingCms.map((r) => [r.cm_no, r]));

  // Fetch project metadata
  const projectIds = [...new Set(existingCms.map((r) => r.project_id))];
  const existingProjects = projectIds.length > 0
    ? await prisma.$queryRaw<ProjectRecord[]>(Prisma.sql`
        SELECT project_id, project_name, client_name, attorney_in_charge, sca
        FROM billing_project
        WHERE project_id IN (${Prisma.join(projectIds.map((id) => Prisma.sql`${id}`))})
      `)
    : [];
  const projMap = new Map(existingProjects.map((r) => [r.project_id.toString(), r]));

  const matched: typeof rows = [];
  const newEntries: typeof rows = [];
  const skipped: string[] = [];

  for (const row of rows) {
    if (cmMap.has(row.cmNo)) {
      matched.push(row);
    } else if (row.cmNo.toUpperCase() === 'TBC' || !row.cmNo.trim()) {
      if (!skipped.includes(row.cmNo)) skipped.push(row.cmNo);
    } else {
      newEntries.push(row);
    }
  }

  const newCmNumbers = [...new Set(newEntries.map((r) => r.cmNo))];

  lines.push(`**Matched C/M numbers (update):** ${new Set(matched.map((r) => r.cmNo)).size}`);
  lines.push(`**New C/M numbers (create):** ${newCmNumbers.length}`);
  lines.push(`**Skipped C/M numbers:** ${skipped.length}`);
  lines.push('');

  if (skipped.length > 0) {
    lines.push('## Skipped C/M Numbers');
    lines.push('');
    for (const cm of skipped) {
      const row = rows.find((r) => r.cmNo === cm);
      lines.push(`- \`${cm}\` — ${row?.projectName || '(no name)'}`);
    }
    lines.push('');
  }

  // --- New C/M entries to be created ---
  // Pre-fetch staffing project matches (outside if-block for use in summary)
  const staffingMatchesByCmOuter = new Map<string, { id: number; name: string; cm_number: string | null; method: string }>();

  if (newEntries.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## New C/M Numbers (to create)');
    lines.push('');

    const groupedNewByCm = new Map<string, typeof rows>();
    for (const row of newEntries) {
      const arr = groupedNewByCm.get(row.cmNo) ?? [];
      arr.push(row);
      groupedNewByCm.set(row.cmNo, arr);
    }

    // Pre-fetch staffing project matches for all new entries using C/M prefix + name similarity
    for (const row of newEntries) {
      if (staffingMatchesByCmOuter.has(row.cmNo)) continue;
      const cmBase = row.cmNo.split('-')[0];
      try {
        // Strategy 1: exact cm_number match
        let found = await prisma.$queryRaw<Array<{ id: number; name: string; cm_number: string | null }>>(Prisma.sql`
          SELECT id, name, cm_number FROM projects WHERE cm_number = ${row.cmNo} LIMIT 1
        `);
        if (found.length > 0) {
          staffingMatchesByCmOuter.set(row.cmNo, { ...found[0], method: 'exact cm_number' });
          continue;
        }
        // Strategy 2: C/M prefix match
        if (cmBase) {
          found = await prisma.$queryRaw<Array<{ id: number; name: string; cm_number: string | null }>>(Prisma.sql`
            SELECT id, name, cm_number FROM projects WHERE cm_number LIKE ${cmBase + '-%'} LIMIT 1
          `);
          if (found.length > 0) {
            staffingMatchesByCmOuter.set(row.cmNo, { ...found[0], method: `cm prefix (${cmBase})` });
            continue;
          }
        }
        // Strategy 3: name similarity
        if (row.projectName) {
          const nameMatch = await prisma.$queryRaw<Array<{ id: number; name: string; cm_number: string | null; score: number }>>(Prisma.sql`
            SELECT id, name, cm_number, similarity(name, ${row.projectName}) as score
            FROM projects WHERE similarity(name, ${row.projectName}) > 0.4
            ORDER BY score DESC LIMIT 1
          `);
          if (nameMatch.length > 0) {
            staffingMatchesByCmOuter.set(row.cmNo, { ...nameMatch[0], method: `name similarity (${Number(nameMatch[0].score).toFixed(2)})` });
          }
        }
      } catch { /* similarity extension may not be available */ }
    }

    let newIdx = 0;
    for (const [cmNo, cmRows] of groupedNewByCm) {
      newIdx++;
      const mainRow = cmRows[0];
      lines.push(`### NEW ${newIdx}. C/M \`${cmNo}\` — ${mainRow.projectName}`);
      lines.push('');

      // Show staffing project match
      const staffMatch = staffingMatchesByCmOuter.get(cmNo);
      if (staffMatch) {
        lines.push(`- **Staffing project match:** #${staffMatch.id} "${staffMatch.name}" [${staffMatch.method}]${staffMatch.cm_number ? ` (cm: ${staffMatch.cm_number})` : ' [will set cm_number]'}`);
      } else {
        lines.push(`- **Staffing project match:** (none)`);
      }

      lines.push(`- **Client:** ${mainRow.clientName || '(none)'}`);
      lines.push(`- **Attorney:** ${mainRow.attorneyInCharge || '(none)'}`);
      lines.push(`- **SCA:** ${mainRow.sca || '(none)'}`);
      lines.push('');

      // Financial data
      lines.push('**Financial data:**');
      lines.push('');
      lines.push('| Field | Value |');
      lines.push('|-------|-------|');
      lines.push(`| agreed_fee_usd | ${fmtNum(mainRow.engagements[0]?.feesUsd ?? null)} |`);
      lines.push(`| billing_to_date_usd | ${fmtNum(mainRow.billingUsd)} |`);
      lines.push(`| collected_to_date_usd | ${fmtNum(mainRow.collectionUsd)} |`);
      lines.push(`| billing_credit_usd | ${fmtNum(mainRow.billingCreditUsd)} |`);
      lines.push(`| ubt_usd | ${fmtNum(mainRow.ubtUsd)} |`);
      lines.push(`| ar_usd | ${fmtNum(mainRow.arUsd)} |`);
      lines.push(`| billing_credit_cny | ${fmtNum(mainRow.billingCreditCny)} |`);
      lines.push(`| ubt_cny | ${fmtNum(mainRow.ubtCny)} |`);
      lines.push('');

      const allEngagements = cmRows.flatMap((r) => r.engagements);
      lines.push(`**Engagements:** ${allEngagements.length}`);
      lines.push('');

      for (let i = 0; i < allEngagements.length; i++) {
        const eng = allEngagements[i];
        lines.push(`**Engagement ${i + 1}:** ${eng.engagementTitle}`);
        lines.push(`- Fees USD: ${fmtNum(eng.feesUsd)}`);
        lines.push(`- LSD: ${eng.lsdDate ? eng.lsdDate.toISOString().slice(0, 10) : '(none)'} ${eng.lsdRaw ? `(raw: "${eng.lsdRaw}")` : ''}`);
        lines.push(`- Milestones: ${eng.milestones.length}`);

        if (eng.milestones.length > 0) {
          lines.push('');
          lines.push('| Ordinal | Title | Amount | Completed |');
          lines.push('|---------|-------|--------|-----------|');
          for (const m of eng.milestones) {
            const amt = m.amountValue != null ? `${fmtNum(m.amountValue)} ${m.amountCurrency}` : (m.isPercent ? `${m.percentValue}%` : '(null)');
            lines.push(`| ${m.ordinal} | ${escapeMd(truncate(m.title, 60))} | ${amt} | ${m.isCompleted ? 'YES' : 'No'} |`);
          }
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## Updates per C/M Number (existing)');
  lines.push('');

  // Group matched rows by C/M
  const groupedByCm = new Map<string, typeof rows>();
  for (const row of matched) {
    const arr = groupedByCm.get(row.cmNo) ?? [];
    arr.push(row);
    groupedByCm.set(row.cmNo, arr);
  }

  let cmIdx = 0;
  for (const [cmNo, cmRows] of groupedByCm) {
    cmIdx++;
    const mainRow = cmRows[0]; // Primary row (has the C/M)
    const db = cmMap.get(cmNo)!;
    const proj = projMap.get(db.project_id.toString());

    lines.push(`### ${cmIdx}. C/M \`${cmNo}\` — ${mainRow.projectName}`);
    lines.push('');

    // --- Project metadata updates ---
    const metaChanges: string[] = [];
    if (proj) {
      if (diff(proj.project_name, mainRow.projectName)) metaChanges.push(`project_name: "${proj.project_name}" → "${mainRow.projectName}"`);
      if (diff(proj.client_name, mainRow.clientName)) metaChanges.push(`client_name: "${proj.client_name}" → "${mainRow.clientName}"`);
      if (diff(proj.attorney_in_charge, mainRow.attorneyInCharge)) metaChanges.push(`attorney_in_charge: "${proj.attorney_in_charge}" → "${mainRow.attorneyInCharge}"`);
      if (diff(proj.sca, mainRow.sca)) metaChanges.push(`sca: "${proj.sca}" → "${mainRow.sca}"`);
    }

    if (metaChanges.length > 0) {
      lines.push('**Project metadata changes:**');
      for (const c of metaChanges) lines.push(`- ${c}`);
      lines.push('');
    }

    // --- Financial updates ---
    lines.push('**Financial updates (billing_project_cm_no):**');
    lines.push('');
    lines.push('| Field | DB Current | Excel New |');
    lines.push('|-------|-----------|-----------|');
    lines.push(`| agreed_fee_usd | ${fmtNum(numOrNull(db.agreed_fee_usd))} | ${fmtNum(mainRow.engagements[0]?.feesUsd ?? null)} |`);
    lines.push(`| billing_to_date_usd | ${fmtNum(numOrNull(db.billing_to_date_usd))} | ${fmtNum(mainRow.billingUsd)} |`);
    lines.push(`| collected_to_date_usd | ${fmtNum(numOrNull(db.collected_to_date_usd))} | ${fmtNum(mainRow.collectionUsd)} |`);
    lines.push(`| billing_credit_usd | ${fmtNum(numOrNull(db.billing_credit_usd))} | ${fmtNum(mainRow.billingCreditUsd)} |`);
    lines.push(`| ubt_usd | ${fmtNum(numOrNull(db.ubt_usd))} | ${fmtNum(mainRow.ubtUsd)} |`);
    lines.push(`| ar_usd | ${fmtNum(numOrNull(db.ar_usd))} | ${fmtNum(mainRow.arUsd)} |`);
    lines.push(`| billing_credit_cny | ${fmtNum(numOrNull(db.billing_credit_cny))} | ${fmtNum(mainRow.billingCreditCny)} |`);
    lines.push(`| ubt_cny | ${fmtNum(numOrNull(db.ubt_cny))} | ${fmtNum(mainRow.ubtCny)} |`);
    lines.push(`| billed_but_unpaid | ${fmtNum(numOrNull(db.billed_but_unpaid))} | ${fmtNum(mainRow.billedButUnpaid)} |`);
    lines.push(`| unbilled_per_el | ${fmtNum(numOrNull(db.unbilled_per_el))} | ${fmtNum(mainRow.unbilledPerEl)} |`);
    lines.push(`| finance_remarks | ${truncate(db.finance_remarks || '(null)', 60)} | ${truncate(mainRow.financeRemarks || '(null)', 60)} |`);
    lines.push(`| matter_notes | ${truncate(db.matter_notes || '(null)', 60)} | ${truncate(mainRow.matterNotes || '(null)', 60)} |`);
    lines.push('');

    // --- Engagement + Milestone upserts ---
    // Collect all engagements across all rows for this C/M
    const allEngagements = cmRows.flatMap((r) => r.engagements);
    lines.push(`**Engagements to upsert:** ${allEngagements.length}`);
    lines.push('');

    for (let i = 0; i < allEngagements.length; i++) {
      const eng = allEngagements[i];
      lines.push(`**Engagement ${i + 1}:** ${eng.engagementTitle}`);
      lines.push(`- Fees USD: ${fmtNum(eng.feesUsd)}`);
      lines.push(`- LSD: ${eng.lsdDate ? eng.lsdDate.toISOString().slice(0, 10) : '(none)'} ${eng.lsdRaw ? `(raw: "${eng.lsdRaw}")` : ''}`);
      lines.push(`- Milestones: ${eng.milestones.length}`);

      if (eng.milestones.length > 0) {
        lines.push('');
        lines.push('| Ordinal | Title | Amount | Completed |');
        lines.push('|---------|-------|--------|-----------|');
        for (const m of eng.milestones) {
          const amt = m.amountValue != null ? `${fmtNum(m.amountValue)} ${m.amountCurrency}` : (m.isPercent ? `${m.percentValue}%` : '(null)');
          lines.push(`| ${m.ordinal} | ${escapeMd(truncate(m.title, 60))} | ${amt} | ${m.isCompleted ? 'YES' : 'No'} |`);
        }
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // Summary
  lines.push('## Summary');
  lines.push('');
  const updatedEngagements = [...groupedByCm.values()].reduce((sum, cmRows) => sum + cmRows.flatMap((r) => r.engagements).length, 0);
  const newEngagements = newEntries.reduce((sum, r) => sum + r.engagements.length, 0);
  const totalEngagements = updatedEngagements + newEngagements;

  const updatedMilestones = [...groupedByCm.values()].reduce((sum, cmRows) =>
    sum + cmRows.flatMap((r) => r.engagements).reduce((s, e) => s + e.milestones.length, 0), 0);
  const newMilestones = newEntries.reduce((sum, r) =>
    sum + r.engagements.reduce((s, e) => s + e.milestones.length, 0), 0);
  const totalMilestones = updatedMilestones + newMilestones;

  const completedMilestones = [...groupedByCm.values()].reduce((sum, cmRows) =>
    sum + cmRows.flatMap((r) => r.engagements).reduce((s, e) => s + e.milestones.filter((m) => m.isCompleted).length, 0), 0)
    + newEntries.reduce((sum, r) =>
      sum + r.engagements.reduce((s, e) => s + e.milestones.filter((m) => m.isCompleted).length, 0), 0);

  lines.push(`- **C/M numbers updated (existing):** ${groupedByCm.size}`);
  lines.push(`- **C/M numbers created (new):** ${newCmNumbers.length}`);
  lines.push(`- **C/M numbers skipped:** ${skipped.length}`);
  lines.push(`- **Engagements total:** ${totalEngagements} (${updatedEngagements} updated + ${newEngagements} new)`);
  lines.push(`- **Milestones total:** ${totalMilestones} (${updatedMilestones} updated + ${newMilestones} new)`);
  lines.push(`- **Milestones marked completed (strikethrough):** ${completedMilestones}`);
  const staffingLinked = [...staffingMatchesByCmOuter.values()].length;
  const staffingUnlinked = newCmNumbers.length - staffingLinked;
  lines.push(`- **New C/M → staffing project links:** ${staffingLinked} matched, ${staffingUnlinked} unmatched`);

  const outPath = path.resolve(__dirname, '../../Billing/dry-run-updates.md');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`\nReport written to: ${outPath}`);
  console.log(`Updated: ${groupedByCm.size}, New: ${newCmNumbers.length}, Skipped: ${skipped.length}`);
  console.log(`Engagements: ${totalEngagements}, Milestones: ${totalMilestones} (${completedMilestones} completed)`);

  await prisma.$disconnect();
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'object' && 'toNumber' in (v as any) ? (v as any).toNumber() : Number(v);
  return Number.isFinite(n) ? n : null;
}

function diff(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a || '') !== (b || '');
}

function fmtNum(v: number | null): string {
  if (v === null || v === undefined) return '(null)';
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '...';
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
