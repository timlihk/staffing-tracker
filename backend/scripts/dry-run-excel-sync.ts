/**
 * Dry-run script: Parse the HKCM Excel and output parsed data for verification.
 * Does NOT write to DB.
 *
 * Usage: npx ts-node scripts/dry-run-excel-sync.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { preprocessExcelBuffer, parseExcelFile, generatePreview } from '../src/services/billing-excel-sync.service';

const EXCEL_PATH = path.resolve(
  __dirname,
  '../../Billing/HKCM Project List (2026.02.12).xlsx'
);

async function main() {
  console.log(`Reading: ${EXCEL_PATH}`);
  const raw = fs.readFileSync(EXCEL_PATH);
  const buffer = await preprocessExcelBuffer(raw);
  const rows = await parseExcelFile(buffer);
  const preview = await generatePreview(rows);

  // Build markdown report
  const lines: string[] = [];
  lines.push('# HKCM Excel Dry-Run Report');
  lines.push('');
  lines.push(`**File:** ${path.basename(EXCEL_PATH)}`);
  lines.push(`**Date:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`**Total Excel rows parsed:** ${rows.length}`);
  lines.push(`**Matched C/M numbers (in DB):** ${preview.matchedCmNumbers}`);
  lines.push(`**Unmatched C/M numbers:** ${preview.unmatchedCmNumbers.length}`);
  if (preview.unmatchedCmNumbers.length > 0) {
    lines.push('');
    lines.push('## Unmatched C/M Numbers');
    lines.push('');
    for (const cm of preview.unmatchedCmNumbers) {
      lines.push(`- \`${cm}\``);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // Output every row grouped by C/M
  for (const row of rows) {
    lines.push(`## C/M: \`${row.cmNo}\` (Row ${row.rowNum})`);
    lines.push('');
    lines.push(`- **Project Name:** ${row.projectName}`);
    lines.push(`- **Client Name:** ${row.clientName}`);
    lines.push(`- **Attorney in Charge:** ${row.attorneyInCharge}`);
    lines.push(`- **SCA:** ${row.sca || '(empty)'}`);
    lines.push(`- **Is Sub-Row:** ${row.isSubRow ? 'Yes (inherited C/M)' : 'No'}`);
    lines.push('');

    // Financials
    lines.push('### Financials');
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    lines.push(`| Billing USD | ${fmtNum(row.billingUsd)} |`);
    lines.push(`| Collection USD | ${fmtNum(row.collectionUsd)} |`);
    lines.push(`| Billing Credit USD | ${fmtNum(row.billingCreditUsd)} |`);
    lines.push(`| UBT USD | ${fmtNum(row.ubtUsd)} |`);
    lines.push(`| AR USD | ${fmtNum(row.arUsd)} |`);
    lines.push(`| Billing Credit CNY | ${fmtNum(row.billingCreditCny)} |`);
    lines.push(`| UBT CNY | ${fmtNum(row.ubtCny)} |`);
    lines.push(`| Billed but Unpaid | ${fmtNum(row.billedButUnpaid)} |`);
    lines.push(`| Unbilled per EL | ${fmtNum(row.unbilledPerEl)} |`);
    lines.push(`| Finance Remarks | ${row.financeRemarks || '(empty)'} |`);
    lines.push(`| Matter Notes | ${row.matterNotes || '(empty)'} |`);
    lines.push('');

    // Engagements + Milestones
    for (let i = 0; i < row.engagements.length; i++) {
      const eng = row.engagements[i];
      lines.push(`### Engagement ${i + 1}: ${eng.engagementTitle}`);
      lines.push('');
      lines.push(`- **Fees USD:** ${fmtNum(eng.feesUsd)}`);
      lines.push(`- **LSD Date:** ${eng.lsdDate ? eng.lsdDate.toISOString().slice(0, 10) : '(none)'}`);
      lines.push(`- **LSD Raw:** ${eng.lsdRaw || '(none)'}`);
      lines.push(`- **Raw Milestone Text:** ${eng.rawMilestoneText ? truncate(eng.rawMilestoneText, 200) : '(empty)'}`);
      lines.push('');

      if (eng.milestones.length === 0) {
        lines.push('_No milestones parsed._');
        lines.push('');
      } else {
        lines.push('| # | Ordinal | Title | Amount | Currency | % | Completed |');
        lines.push('|---|---------|-------|--------|----------|---|-----------|');
        for (let j = 0; j < eng.milestones.length; j++) {
          const m = eng.milestones[j];
          lines.push(
            `| ${j + 1} | ${m.ordinal} | ${escapeMd(truncate(m.title, 80))} | ${fmtNum(m.amountValue)} | ${m.amountCurrency} | ${m.isPercent ? m.percentValue + '%' : '-'} | ${m.isCompleted ? '~~YES~~' : 'No'} |`
          );
        }
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }

  // AI Validation section
  if (preview.aiValidation) {
    lines.push('');
    lines.push('# AI Validation Results');
    lines.push('');
    if (!preview.aiValidation.validated) {
      lines.push('_AI validation was not available (no API key configured)._');
    } else if (preview.aiValidation.issues.length === 0) {
      lines.push('_AI validation passed — no issues detected._');
    } else {
      lines.push(`**${preview.aiValidation.issues.length} issue(s) found:**`);
      lines.push('');
      for (const issue of preview.aiValidation.issues) {
        const icon = issue.severity === 'error' ? 'ERROR' : 'WARNING';
        lines.push(`### [${icon}] ${issue.cmNo} — ${issue.engagementTitle}`);
        lines.push('');
        lines.push(`- **Issue:** ${issue.issue}`);
        lines.push(`- **Suggestion:** ${issue.suggestion}`);
        lines.push('');
      }
    }
  }

  const outPath = path.resolve(__dirname, '../../Billing/dry-run-report.md');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`\nReport written to: ${outPath}`);
  console.log(`Total rows: ${rows.length}`);
  console.log(`Matched: ${preview.matchedCmNumbers}, Unmatched: ${preview.unmatchedCmNumbers.length}`);
  if (preview.aiValidation?.validated) {
    console.log(`AI validation: ${preview.aiValidation.issues.length} issues found`);
  }
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
