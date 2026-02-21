/**
 * Billing Excel Sync Service
 *
 * Parses the finance department's HKCM Project List Excel and syncs
 * billing data (financials, milestones, completion status) to the DB.
 */

import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedMilestone {
  ordinal: string;
  title: string;
  description: string;
  triggerText: string;
  rawFragment: string;
  amountValue: number | null;
  amountCurrency: 'USD' | 'CNY';
  isPercent: boolean;
  percentValue: number | null;
  sortOrder: number;
  isCompleted: boolean;
}

interface ExcelEngagement {
  engagementTitle: string;
  feesUsd: number | null;
  milestones: ParsedMilestone[];
  lsdDate: Date | null;
  lsdRaw: string | null;
  rawMilestoneText: string;
}

interface ExcelRow {
  rowNum: number;
  projectName: string;
  clientName: string;
  cmNo: string; // resolved (inherited from parent if empty)
  attorneyInCharge: string;
  sca: string;
  billingUsd: number | null;
  collectionUsd: number | null;
  billingCreditUsd: number | null;
  ubtUsd: number | null;
  arUsd: number | null;
  billingCreditCny: number | null;
  ubtCny: number | null;
  billedButUnpaid: number | null;
  unbilledPerEl: number | null;
  financeRemarks: string | null;
  matterNotes: string | null;
  engagements: ExcelEngagement[];
  isSubRow: boolean; // true if this row had empty C/M (inherited)
}

export interface SyncPreview {
  totalExcelRows: number;
  matchedCmNumbers: number;
  unmatchedCmNumbers: string[];
  projectsToUpdate: number;
  milestonesToCreate: number;
  milestonesToMarkCompleted: number;
  financialsToUpdate: number;
  matched: MatchedPreview[];
}

interface MatchedPreview {
  cmNo: string;
  projectName: string;
  engagementCount: number;
  milestoneCount: number;
  completedCount: number;
  financialChanges: string[];
}

export interface SyncResult {
  projectsUpdated: number;
  financialsUpdated: number;
  engagementsUpserted: number;
  milestonesCreated: number;
  milestonesUpdated: number;
  milestonesMarkedCompleted: number;
  unmatchedCmNumbers: string[];
}

// ---------------------------------------------------------------------------
// Regex (reused from backfill script)
// ---------------------------------------------------------------------------

const MILESTONE_LINE_REGEX = /^\s*(?:\(([a-zA-Z0-9]+)\)|([0-9]+)[.)]|([a-zA-Z])[.)])\s*(.+)$/;
const AMOUNT_AT_END_REGEX = /[-–—]\s*(?:US\$|USD|RMB|CNY|¥|人民币|元)?\s*([0-9][0-9,]*(?:\.\d+)?)(?:\s*[)])?\s*$/i;
const PERCENT_REGEX = /\(?\d+(?:\.\d+)?%\)?/;
const LSD_REGEX = /\(LSD\s*:\s*([^)]+)\)/gi;

// ---------------------------------------------------------------------------
// Excel preprocessing (x: namespace fix)
// ---------------------------------------------------------------------------

export async function preprocessExcelBuffer(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);

  for (const [name, file] of Object.entries(zip.files)) {
    if (name.endsWith('.xml') || name.endsWith('.rels')) {
      let content = await file.async('string');
      content = content.replace(/<x:/g, '<').replace(/<\/x:/g, '</');
      zip.file(name, content);
    }
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}

// ---------------------------------------------------------------------------
// Cell value helpers
// ---------------------------------------------------------------------------

function getCellNumber(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && 'result' in v) {
    const r = (v as { result?: unknown }).result;
    if (typeof r === 'number') return r;
    if (typeof r === 'string') {
      const n = Number(r.replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    }
  }
  if (typeof v === 'string') {
    const cleaned = v.replace(/[$,\s]/g, '');
    if (cleaned === '' || cleaned === '-') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getCellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'richText' in v) {
    const rt = (v as { richText: Array<{ text: string }> }).richText;
    return rt.map((r) => r.text).join('');
  }
  if (typeof v === 'object' && 'result' in v) {
    return String((v as { result?: unknown }).result ?? '');
  }
  return String(v);
}

// ---------------------------------------------------------------------------
// LSD parsing
// ---------------------------------------------------------------------------

function parseLsdDates(text: string): { lsdDate: Date | null; lsdRaw: string | null } {
  const matches = [...text.matchAll(LSD_REGEX)];
  if (matches.length === 0) return { lsdDate: null, lsdRaw: null };

  let latestDate: Date | null = null;
  let latestRaw: string | null = null;

  for (const match of matches) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    const parsed = parseDateString(raw);
    if (parsed && (!latestDate || parsed > latestDate)) {
      latestDate = parsed;
      latestRaw = raw;
    }
  }

  return { lsdDate: latestDate, lsdRaw: latestRaw };
}

function parseDateString(text: string): Date | null {
  // English: "31 Mar 2025", "15 July 2023"
  const engMatch = text.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (engMatch) {
    const monthLookup: Record<string, number> = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
      aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
      nov: 10, november: 10, dec: 11, december: 11,
    };
    const month = monthLookup[engMatch[2].toLowerCase()];
    if (month !== undefined) {
      return new Date(Number(engMatch[3]), month, Number(engMatch[1]));
    }
  }

  // Chinese: "2024年1月31日"
  const cnMatch = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (cnMatch) {
    return new Date(Number(cnMatch[1]), Number(cnMatch[2]) - 1, Number(cnMatch[3]));
  }

  // ISO-ish: "2024-01-31"
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  return null;
}

// ---------------------------------------------------------------------------
// Milestone parsing from rich text
// ---------------------------------------------------------------------------

interface RichTextRun {
  text: string;
  strike: boolean;
}

function extractRuns(cellValue: ExcelJS.CellValue): RichTextRun[] {
  if (cellValue === null || cellValue === undefined) return [];

  if (typeof cellValue === 'object' && 'richText' in cellValue) {
    const rt = (cellValue as { richText: Array<{ text?: string; font?: { strike?: boolean } }> }).richText;
    return rt.map((r) => ({
      text: r.text ?? '',
      strike: !!r.font?.strike,
    }));
  }

  // Plain text — check cell-level strike not available here, treat as no strike
  return [{ text: String(cellValue), strike: false }];
}

function parseMilestonesFromRuns(runs: RichTextRun[]): ParsedMilestone[] {
  // Combine runs into full text, tracking strike per character range
  const fullText = runs.map((r) => r.text).join('');
  if (!fullText.trim()) return [];

  // Build character-level strike map
  const strikeMap: boolean[] = [];
  for (const run of runs) {
    for (let i = 0; i < run.text.length; i++) {
      strikeMap.push(run.strike);
    }
  }

  // Split into lines
  const lines = fullText.split('\n');
  let charOffset = 0;
  const parsed: ParsedMilestone[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const lineStart = charOffset;
    charOffset += line.length + 1; // +1 for \n

    if (!trimmed) continue;

    const match = trimmed.match(MILESTONE_LINE_REGEX);
    if (!match) continue;

    const label = (match[1] ?? match[2] ?? match[3] ?? '').toLowerCase().trim();
    const content = (match[4] ?? '').trim();
    if (!label || !content) continue;

    // Check if the majority of this line is struck through
    const lineEnd = lineStart + line.length;
    let struckChars = 0;
    let totalChars = 0;
    for (let i = lineStart; i < lineEnd && i < strikeMap.length; i++) {
      const c = fullText[i];
      if (c && c.trim()) {
        totalChars++;
        if (strikeMap[i]) struckChars++;
      }
    }
    const isCompleted = totalChars > 0 && struckChars / totalChars > 0.5;

    // Parse amounts
    const percentMatch = content.match(PERCENT_REGEX);
    const percentValue = percentMatch ? Number(percentMatch[0].replace(/[()%]/g, '')) : null;
    const isPercent = Number.isFinite(percentValue ?? NaN);

    const amountMatch = content.match(AMOUNT_AT_END_REGEX);
    const amountValue = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : null;
    const amountCurrency: 'USD' | 'CNY' = /人民币|RMB|CNY|¥/i.test(content) ? 'CNY' : 'USD';

    const strippedTitle = content.replace(AMOUNT_AT_END_REGEX, '').trim().replace(/[-–—]\s*$/, '').trim();
    const title = strippedTitle.slice(0, 120) || `Milestone ${label}`;

    parsed.push({
      ordinal: `(${label})`,
      title,
      description: content,
      triggerText: content,
      rawFragment: line.trim(),
      amountValue: Number.isFinite(amountValue ?? NaN) ? amountValue : null,
      amountCurrency,
      isPercent,
      percentValue: Number.isFinite(percentValue ?? NaN) ? percentValue : null,
      sortOrder: parsed.length + 1,
      isCompleted,
    });
  }

  // Disambiguate repeated ordinals
  const seen = new Map<string, number>();
  for (const m of parsed) {
    const count = (seen.get(m.ordinal) ?? 0) + 1;
    seen.set(m.ordinal, count);
    if (count > 1) {
      m.ordinal = `${m.ordinal.replace(/\)$/, '')}-${count})`;
    }
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Excel file parsing
// ---------------------------------------------------------------------------

export async function parseExcelFile(buffer: Buffer): Promise<ExcelRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error('No worksheets found in Excel file');

  const rows: ExcelRow[] = [];
  let lastCmNo = '';

  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);

    // Skip completely empty rows
    const projectName = getCellText(row.getCell(3)).trim();
    const cmNoRaw = getCellText(row.getCell(5)).trim();
    if (!projectName && !cmNoRaw) continue;

    const isSubRow = !cmNoRaw;
    const cmNo = cmNoRaw || lastCmNo;
    if (!cmNo) continue; // no C/M context at all

    if (cmNoRaw) lastCmNo = cmNoRaw;

    // Parse milestone column
    const milestoneCell = row.getCell(9);
    const runs = extractRuns(milestoneCell.value);
    const milestoneText = runs.map((r) => r.text).join('');
    const milestones = parseMilestonesFromRuns(runs);
    const { lsdDate, lsdRaw } = parseLsdDates(milestoneText);

    const engagement: ExcelEngagement = {
      engagementTitle: projectName,
      feesUsd: getCellNumber(row.getCell(8)),
      milestones,
      lsdDate,
      lsdRaw,
      rawMilestoneText: milestoneText,
    };

    if (isSubRow) {
      // Attach as additional engagement to previous row with same C/M
      const parent = [...rows].reverse().find((r: ExcelRow) => r.cmNo === cmNo);
      if (parent) {
        parent.engagements.push(engagement);
        // Add sub-row financial values to parent totals
        const addNum = (a: number | null, b: number | null) =>
          a !== null || b !== null ? (a ?? 0) + (b ?? 0) : null;
        parent.billingUsd = addNum(parent.billingUsd, getCellNumber(row.getCell(10)));
        parent.collectionUsd = addNum(parent.collectionUsd, getCellNumber(row.getCell(11)));
        parent.billingCreditUsd = addNum(parent.billingCreditUsd, getCellNumber(row.getCell(12)));
        parent.ubtUsd = addNum(parent.ubtUsd, getCellNumber(row.getCell(13)));
        parent.arUsd = addNum(parent.arUsd, getCellNumber(row.getCell(14)));
        parent.billingCreditCny = addNum(parent.billingCreditCny, getCellNumber(row.getCell(16)));
        parent.ubtCny = addNum(parent.ubtCny, getCellNumber(row.getCell(17)));
        parent.billedButUnpaid = addNum(parent.billedButUnpaid, getCellNumber(row.getCell(19)));
        parent.unbilledPerEl = addNum(parent.unbilledPerEl, getCellNumber(row.getCell(20)));
        continue;
      }
    }

    rows.push({
      rowNum: r,
      projectName,
      clientName: getCellText(row.getCell(4)).trim(),
      cmNo,
      attorneyInCharge: getCellText(row.getCell(6)).trim(),
      sca: getCellText(row.getCell(7)).trim(),
      billingUsd: getCellNumber(row.getCell(10)),
      collectionUsd: getCellNumber(row.getCell(11)),
      billingCreditUsd: getCellNumber(row.getCell(12)),
      ubtUsd: getCellNumber(row.getCell(13)),
      arUsd: getCellNumber(row.getCell(14)),
      billingCreditCny: getCellNumber(row.getCell(16)),
      ubtCny: getCellNumber(row.getCell(17)),
      billedButUnpaid: getCellNumber(row.getCell(19)),
      unbilledPerEl: getCellNumber(row.getCell(20)),
      financeRemarks: getCellText(row.getCell(21)).trim() || null,
      matterNotes: getCellText(row.getCell(22)).trim() || null,
      engagements: [engagement],
      isSubRow: false,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export async function generatePreview(rows: ExcelRow[]): Promise<SyncPreview> {
  const cmNumbers = [...new Set(rows.map((r) => r.cmNo))];

  // Check which C/M numbers exist in DB
  const existing = await prisma.$queryRaw<Array<{ cm_no: string }>>(Prisma.sql`
    SELECT DISTINCT cm_no FROM billing_project_cm_no
    WHERE cm_no IN (${Prisma.join(cmNumbers.map((c) => Prisma.sql`${c}`))})
  `);
  const existingSet = new Set(existing.map((r) => r.cm_no));

  const matched: MatchedPreview[] = [];
  const unmatched: string[] = [];
  let milestonesToCreate = 0;
  let milestonesToMarkCompleted = 0;
  let financialsToUpdate = 0;

  for (const row of rows) {
    if (!existingSet.has(row.cmNo)) {
      if (!unmatched.includes(row.cmNo)) unmatched.push(row.cmNo);
      continue;
    }

    const totalMilestones = row.engagements.reduce((sum, e) => sum + e.milestones.length, 0);
    const completedMilestones = row.engagements.reduce(
      (sum, e) => sum + e.milestones.filter((m) => m.isCompleted).length, 0
    );

    milestonesToCreate += totalMilestones;
    milestonesToMarkCompleted += completedMilestones;
    financialsToUpdate++;

    matched.push({
      cmNo: row.cmNo,
      projectName: row.projectName,
      engagementCount: row.engagements.length,
      milestoneCount: totalMilestones,
      completedCount: completedMilestones,
      financialChanges: [
        row.billingUsd != null ? `Billing: $${row.billingUsd.toLocaleString()}` : '',
        row.collectionUsd != null ? `Collection: $${row.collectionUsd.toLocaleString()}` : '',
      ].filter(Boolean),
    });
  }

  return {
    totalExcelRows: rows.length,
    matchedCmNumbers: matched.length,
    unmatchedCmNumbers: unmatched,
    projectsToUpdate: matched.length,
    milestonesToCreate,
    milestonesToMarkCompleted,
    financialsToUpdate,
    matched,
  };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export async function applyChanges(rows: ExcelRow[], userId?: number): Promise<SyncResult> {
  const result: SyncResult = {
    projectsUpdated: 0,
    financialsUpdated: 0,
    engagementsUpserted: 0,
    milestonesCreated: 0,
    milestonesUpdated: 0,
    milestonesMarkedCompleted: 0,
    unmatchedCmNumbers: [],
  };

  for (const row of rows) {
    try {
      await processRow(row, userId, result);
    } catch (error) {
      logger.error(`Error processing C/M ${row.cmNo} (row ${row.rowNum})`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

async function processRow(row: ExcelRow, userId: number | undefined, result: SyncResult): Promise<void> {
  // Find the C/M record
  const cmRecords = await prisma.$queryRaw<Array<{
    cm_id: bigint;
    project_id: bigint;
  }>>(Prisma.sql`
    SELECT cm_id, project_id
    FROM billing_project_cm_no
    WHERE cm_no = ${row.cmNo}
    LIMIT 1
  `);

  if (cmRecords.length === 0) {
    if (!result.unmatchedCmNumbers.includes(row.cmNo)) {
      result.unmatchedCmNumbers.push(row.cmNo);
    }
    return;
  }

  const { cm_id: cmId, project_id: projectId } = cmRecords[0];

  // Update billing_project metadata
  await prisma.$executeRaw(Prisma.sql`
    UPDATE billing_project
    SET
      project_name = ${row.projectName || null},
      client_name = ${row.clientName || null},
      attorney_in_charge = ${row.attorneyInCharge || null},
      sca = ${row.sca || null},
      updated_at = NOW()
    WHERE project_id = ${projectId}
  `);
  result.projectsUpdated++;

  // Update billing_project_cm_no financials (verbatim from Excel)
  await prisma.$executeRaw(Prisma.sql`
    UPDATE billing_project_cm_no
    SET
      agreed_fee_usd = ${row.engagements[0]?.feesUsd ?? null},
      billing_to_date_usd = ${row.billingUsd},
      collected_to_date_usd = ${row.collectionUsd},
      billing_credit_usd = ${row.billingCreditUsd},
      ubt_usd = ${row.ubtUsd},
      ar_usd = ${row.arUsd},
      billing_credit_cny = ${row.billingCreditCny},
      ubt_cny = ${row.ubtCny},
      billed_but_unpaid = ${row.billedButUnpaid},
      unbilled_per_el = ${row.unbilledPerEl},
      finance_remarks = ${row.financeRemarks},
      matter_notes = ${row.matterNotes},
      financials_updated_at = NOW(),
      financials_updated_by = ${userId ?? null}
    WHERE cm_id = ${cmId}
  `);
  result.financialsUpdated++;

  // Process each engagement
  for (let engIdx = 0; engIdx < row.engagements.length; engIdx++) {
    const eng = row.engagements[engIdx];
    await processEngagement(eng, cmId, projectId, engIdx, result);
  }
}

async function processEngagement(
  eng: ExcelEngagement,
  cmId: bigint,
  projectId: bigint,
  engIdx: number,
  result: SyncResult,
): Promise<void> {
  // Find or create engagement
  const engCode = `excel_${engIdx}`;
  const existingEng = await prisma.$queryRaw<Array<{ engagement_id: bigint }>>(Prisma.sql`
    SELECT engagement_id
    FROM billing_engagement
    WHERE cm_id = ${cmId} AND engagement_code = ${engCode}
    LIMIT 1
  `);

  let engagementId: bigint;

  if (existingEng.length > 0) {
    engagementId = existingEng[0].engagement_id;
    await prisma.$executeRaw(Prisma.sql`
      UPDATE billing_engagement
      SET engagement_title = ${eng.engagementTitle || null},
          updated_at = NOW()
      WHERE engagement_id = ${engagementId}
    `);
  } else {
    // If engIdx === 0, try to reuse existing first engagement for this C/M
    if (engIdx === 0) {
      const firstEng = await prisma.$queryRaw<Array<{ engagement_id: bigint }>>(Prisma.sql`
        SELECT engagement_id
        FROM billing_engagement
        WHERE cm_id = ${cmId}
        ORDER BY engagement_id ASC
        LIMIT 1
      `);
      if (firstEng.length > 0) {
        engagementId = firstEng[0].engagement_id;
        await prisma.$executeRaw(Prisma.sql`
          UPDATE billing_engagement
          SET engagement_title = ${eng.engagementTitle || null},
              engagement_code = ${engCode},
              updated_at = NOW()
          WHERE engagement_id = ${engagementId}
        `);
        result.engagementsUpserted++;
        await processEngagementData(eng, engagementId, result);
        return;
      }
    }

    const inserted = await prisma.$queryRaw<Array<{ engagement_id: bigint }>>(Prisma.sql`
      INSERT INTO billing_engagement (project_id, cm_id, engagement_code, engagement_title, created_at, updated_at)
      VALUES (${projectId}, ${cmId}, ${engCode}, ${eng.engagementTitle || null}, NOW(), NOW())
      RETURNING engagement_id
    `);
    engagementId = inserted[0].engagement_id;
  }

  result.engagementsUpserted++;
  await processEngagementData(eng, engagementId, result);
}

async function processEngagementData(
  eng: ExcelEngagement,
  engagementId: bigint,
  result: SyncResult,
): Promise<void> {
  // Update or create fee arrangement
  const existingFa = await prisma.$queryRaw<Array<{ fee_id: bigint }>>(Prisma.sql`
    SELECT fee_id
    FROM billing_fee_arrangement
    WHERE engagement_id = ${engagementId}
    ORDER BY fee_id ASC
    LIMIT 1
  `);

  let feeId: bigint;

  if (existingFa.length > 0) {
    feeId = existingFa[0].fee_id;
    await prisma.$executeRaw(Prisma.sql`
      UPDATE billing_fee_arrangement
      SET
        raw_text = ${eng.rawMilestoneText || ''},
        lsd_date = COALESCE(${eng.lsdDate}, lsd_date),
        lsd_raw = COALESCE(${eng.lsdRaw}, lsd_raw),
        parser_version = 'excel_sync_v1',
        parsed_at = NOW(),
        updated_at = NOW()
      WHERE fee_id = ${feeId}
    `);
  } else {
    const inserted = await prisma.$queryRaw<Array<{ fee_id: bigint }>>(Prisma.sql`
      INSERT INTO billing_fee_arrangement (engagement_id, raw_text, lsd_date, lsd_raw, parser_version, parsed_at, created_at, updated_at)
      VALUES (${engagementId}, ${eng.rawMilestoneText || ''}, ${eng.lsdDate}, ${eng.lsdRaw}, 'excel_sync_v1', NOW(), NOW(), NOW())
      RETURNING fee_id
    `);
    feeId = inserted[0].fee_id;
  }

  // Upsert milestones
  for (const milestone of eng.milestones) {
    const upserted = await prisma.$executeRaw(Prisma.sql`
      INSERT INTO billing_milestone (
        fee_id, engagement_id, ordinal, title, description,
        trigger_type, trigger_text, amount_value, amount_currency,
        is_percent, percent_value, completed, completion_source,
        completion_date, raw_fragment, sort_order, created_at, updated_at
      ) VALUES (
        ${feeId}, ${engagementId}, ${milestone.ordinal}, ${milestone.title},
        ${milestone.description}, 'excel_import', ${milestone.triggerText},
        ${milestone.amountValue}, ${milestone.amountCurrency},
        ${milestone.isPercent}, ${milestone.percentValue},
        ${milestone.isCompleted},
        ${milestone.isCompleted ? 'excel_strikethrough' : null},
        ${milestone.isCompleted ? Prisma.sql`CURRENT_DATE` : Prisma.sql`NULL`},
        ${milestone.rawFragment}, ${milestone.sortOrder}, NOW(), NOW()
      )
      ON CONFLICT (engagement_id, ordinal) DO UPDATE SET
        fee_id = EXCLUDED.fee_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        trigger_text = EXCLUDED.trigger_text,
        amount_value = EXCLUDED.amount_value,
        amount_currency = EXCLUDED.amount_currency,
        is_percent = EXCLUDED.is_percent,
        percent_value = EXCLUDED.percent_value,
        completed = CASE WHEN EXCLUDED.completed THEN true ELSE billing_milestone.completed END,
        completion_source = CASE
          WHEN EXCLUDED.completed AND NOT billing_milestone.completed THEN 'excel_strikethrough'
          ELSE billing_milestone.completion_source
        END,
        completion_date = CASE
          WHEN EXCLUDED.completed AND NOT billing_milestone.completed THEN CURRENT_DATE
          ELSE billing_milestone.completion_date
        END,
        raw_fragment = EXCLUDED.raw_fragment,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `);

    if (upserted > 0) {
      if (milestone.isCompleted) result.milestonesMarkedCompleted++;
      else result.milestonesCreated++;
    }
  }
}
