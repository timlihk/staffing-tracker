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
import { validateParsedData, type ValidationIssue } from './ai-validation.service';

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
  newCmNumbers: string[];
  projectsToUpdate: number;
  milestonesToCreate: number;
  milestonesToMarkCompleted: number;
  financialsToUpdate: number;
  matched: MatchedPreview[];
  aiValidation?: {
    validated: boolean;
    issues: ValidationIssue[];
  };
}

interface MatchedPreview {
  cmNo: string;
  projectName: string;
  engagementCount: number;
  milestoneCount: number;
  completedCount: number;
  financialChanges: string[];
}

export interface SyncRunChanges {
  updatedCms: Array<{
    cmNo: string;
    projectName: string;
    financialChanges: Array<{ field: string; oldValue: string | null; newValue: string | null }>;
    engagements: Array<{ title: string; milestoneCount: number; completedCount: number }>;
  }>;
  newCms: Array<{
    cmNo: string;
    projectName: string;
    clientName: string;
    engagements: Array<{ title: string; milestoneCount: number }>;
  }>;
  staffingLinks: Array<{
    cmNo: string;
    billingProjectName: string;
    staffingProjectId: number;
    staffingProjectName: string;
    matchMethod: string;
    cmNumberSet: boolean;
  }>;
  unmatchedNewCms: Array<{ cmNo: string; projectName: string }>;
  skippedCms: string[];
}

export interface SyncResult {
  projectsUpdated: number;
  financialsUpdated: number;
  engagementsUpserted: number;
  milestonesCreated: number;
  milestonesUpdated: number;
  milestonesMarkedCompleted: number;
  unmatchedCmNumbers: string[];
  syncRunData: SyncRunChanges;
}

// ---------------------------------------------------------------------------
// Regex (reused from backfill script)
// ---------------------------------------------------------------------------

const MILESTONE_LINE_REGEX = /^\s*(?:\(([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\)|([0-9]+)[.)]|([a-zA-Z])[.)])\s*(.+)$/;
// Match amount after a dash/en-dash/em-dash, allowing trailing text (dates, bonus notes, semicolons, brackets, etc.)
// Require whitespace or punctuation before the dash to avoid matching "F-1", "A-1" etc.
const AMOUNT_AT_END_REGEX = /(?:^|[\s)）\]】])[-–—]\s*(?:US\$|USD|RMB|CNY|¥|人民币|元)?\s*([0-9][0-9,]*(?:\.\d+)?)(?:\s*[)\]]?)(?:\s*(?:$|[;；\s\]]))/i;

// Fallback: match inline amounts like "(US$300,000)" or "US$450,000" or "USD 300,000"
const AMOUNT_INLINE_REGEX = /(?:\(?\s*(?:US\$|USD)\s*([0-9][0-9,]*(?:\.\d+)?)\s*\)?)|(?:(?:RMB|CNY)\s*([0-9][0-9,]*(?:\.\d+)?))/i;
// Fallback: match amounts that are the primary content (e.g. "(1) 250,000" or "(a) 100,000 July 2025")
const AMOUNT_BARE_REGEX = /^\s*([0-9][0-9,]*(?:\.\d+)?)\s*(?:$|[A-Za-z\s])/;
const PERCENT_REGEX = /\(?\d+(?:\.\d+)?%\)?/;
const LSD_REGEX = /\(LSD\s*:?\s*([^)]+)\)/gi;

// Regex to detect EL (Engagement Letter) section headers within a milestone cell.
// Each EL section becomes a separate engagement under the same C/M number.
const EL_HEADER_REGEX = /^(?:(?:Original|Supplemental|Supplementary|Suppl\.?|Updated|Revised|Additional|New|Second|Third|1st|2nd|3rd)\s+)?EL\s*(?:\d+)?\s*(?:[-–—]\s*\w.*)?:/i;

// Regex to strip EL prefix from a milestone line so the ordinal can be matched.
// e.g., "Original EL: (a) ..." → "(a) ..."
const EL_PREFIX_REGEX = /^(?:(?:Original|Supplemental|Supplementary|Suppl\.?|Updated|Revised|Additional|New|Second|Third|1st|2nd|3rd)\s+)?EL\s*(?:\d+)?\s*(?:[-–—]\s*\w.*)?:\s*/i;

// Period/commencement engagement section headers.
// These indicate the start of a new engagement period within a single cell.

// Period range: (自2023年9月至2024年9月) or (自2022年12月30日至2023年12月29日止)
const PERIOD_RANGE_REGEX = /^[\s(（]*自\d{4}年\d{1,2}月(?:\d{1,2}日)?(?:起?至)\d{4}\s*年?\d{1,2}月(?:\d{1,2}\s*日)?(?:止)?[)）]?/;

// Period start-only: (自2021年2月26日計) or (自2023年6月27日起計)
const PERIOD_START_REGEX = /^[\s(（]*自\d{4}年\d{1,2}月\d{1,2}日(?:起)?計[)）]/;

// English commencement: (Commencement date: Nov 9, 2021)
const COMMENCEMENT_REGEX = /^\s*\(Commencement\s+date\s*:/i;

// "NEW EL signed on <date>" or "Supplementary signed on <date>"
const SIGNED_ON_REGEX = /^(?:NEW\s+EL|Supplementary|Supplemental)\s+signed\s+on\s+/i;

// Narrative: 本协议的有效期限自...至...
const NARRATIVE_PERIOD_REGEX = /^本协议的有效期限自\d{4}年/;

// ---------------------------------------------------------------------------
// Excel preprocessing (x: namespace fix)
// ---------------------------------------------------------------------------

export async function preprocessExcelBuffer(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);

  // Map of files/paths to the namespace prefixes that need stripping.
  // Only strip prefixes that ExcelJS can't handle; leave docProps alone
  // (ExcelJS natively handles dc:, dcterms:, cp: etc. in core.xml).
  const fileRules: Record<string, string[]> = {
    'xl/workbook.xml': ['x'],
    'xl/worksheets/sheet1.xml': ['x'],
    'xl/calcChain.xml': ['x'],
    'docProps/app.xml': ['ap', 'vt'],
  };

  for (const [name, prefixes] of Object.entries(fileRules)) {
    const file = zip.files[name];
    if (!file) continue;

    let content = await file.async('string');
    for (const p of prefixes) {
      content = content
        .replace(new RegExp(`<${p}:`, 'g'), '<')
        .replace(new RegExp(`</${p}:`, 'g'), '</');
      // Remove the namespace declaration to avoid confusion
      content = content.replace(new RegExp(`\\s*xmlns:${p}="[^"]*"`, 'g'), '');
    }
    zip.file(name, content);
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

    // The capture may contain multiple dates (e.g. "30 Sept 2026 31 Mar 2027").
    // Try parsing the full string first; if it fails, split by date-like boundaries
    // and try each fragment.
    const parsed = parseDateString(raw);
    if (parsed && (!latestDate || parsed > latestDate)) {
      latestDate = parsed;
      latestRaw = raw;
    }

    // Also try splitting on multiple date fragments (for dual-LSD cases)
    const dateFragments = raw.match(/\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}/g);
    if (dateFragments) {
      for (const frag of dateFragments) {
        const fragDate = parseDateString(frag);
        if (fragDate && (!latestDate || fragDate > latestDate)) {
          latestDate = fragDate;
          latestRaw = frag;
        }
      }
    }
  }

  return { lsdDate: latestDate, lsdRaw: latestRaw };
}

function parseDateString(text: string): Date | null {
  const monthLookup: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, sept: 8, september: 8, seo: 8,
    oct: 9, october: 9,
    nov: 10, november: 10, dec: 11, december: 11, decmeber: 11,
  };

  // English day-first: "31 Mar 2025", "15 July 2023"
  const dayFirstMatch = text.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (dayFirstMatch) {
    const month = monthLookup[dayFirstMatch[2].toLowerCase()];
    if (month !== undefined) {
      return new Date(Date.UTC(Number(dayFirstMatch[3]), month, Number(dayFirstMatch[1])));
    }
  }

  // English month-first: "Dec 31, 2021", "Mar 31, 2024", "Jan 15, 2023"
  const monthFirstMatch = text.match(/([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})/);
  if (monthFirstMatch) {
    const month = monthLookup[monthFirstMatch[1].toLowerCase()];
    if (month !== undefined) {
      return new Date(Date.UTC(Number(monthFirstMatch[3]), month, Number(monthFirstMatch[2])));
    }
  }

  // Chinese: "2024年1月31日"
  const cnMatch = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (cnMatch) {
    return new Date(Date.UTC(Number(cnMatch[1]), Number(cnMatch[2]) - 1, Number(cnMatch[3])));
  }

  // ISO-ish: "2024-01-31"
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));
  }

  return null;
}

// ---------------------------------------------------------------------------
// Full-width character normalization
// ---------------------------------------------------------------------------

/**
 * Normalize full-width CJK punctuation to ASCII equivalents.
 * This fixes parsing issues where Chinese input uses （）％；etc.
 */
function normalizeFullWidth(text: string): string {
  return text
    .replace(/\uff08/g, '(')   // （ → (
    .replace(/\uff09/g, ')')   // ） → )
    .replace(/\uff05/g, '%')   // ％ → %
    .replace(/\uff1b/g, ';')   // ； → ;
    .replace(/\uff1a/g, ':')   // ： → :
    .replace(/\u2013/g, '-')   // – (en dash) → -
    .replace(/\u2014/g, '-');  // — (em dash) → -
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

/**
 * Describes one EL (Engagement Letter) section within a single cell.
 * A cell may contain multiple EL sections: "Original EL: ...", "Supplemental EL: ...".
 */
interface ElSection {
  label: string; // e.g. "Original EL", "Supplemental EL", or "" for default
  lineIndices: number[]; // indices into the split-lines array
}

/**
 * Check if a line is a period/commencement section header.
 * Returns the label string if matched, or null if not.
 */
function matchPeriodHeader(trimmed: string): string | null {
  if (PERIOD_RANGE_REGEX.test(trimmed)) {
    // Extract the period text, e.g. "自2023年9月至2024年9月"
    const m = trimmed.match(/自[\d年月日起至止\s]*/);
    return m ? m[0].replace(/[()（）\s]+$/g, '').trim() : trimmed.slice(0, 40);
  }
  if (PERIOD_START_REGEX.test(trimmed)) {
    const m = trimmed.match(/自[\d年月日起計计\s]*/);
    return m ? m[0].replace(/[()（）\s]+$/g, '').trim() : trimmed.slice(0, 40);
  }
  if (COMMENCEMENT_REGEX.test(trimmed)) {
    // Extract "(Commencement date: Nov 9, 2021)"
    const m = trimmed.match(/\(Commencement\s+date\s*:\s*([^)]+)\)/i);
    return m ? `Commencement date: ${m[1].trim()}` : 'Commencement';
  }
  if (SIGNED_ON_REGEX.test(trimmed)) {
    // Use the full line as the label, e.g. "NEW EL signed on Nov 8, 2022"
    return trimmed.replace(/:\s*$/, '').trim();
  }
  if (NARRATIVE_PERIOD_REGEX.test(trimmed)) {
    // Extract the date range from the narrative
    const m = trimmed.match(/自(\d{4}年\d{1,2}月\d{1,2}日)至(\d{4}年\d{1,2}月\d{1,2}日)/);
    return m ? `自${m[1]}至${m[2]}` : trimmed.slice(0, 40);
  }
  return null;
}

/**
 * Splits the lines of a milestone cell into EL-based sections.
 * Lines that match EL_HEADER_REGEX or period/commencement headers start a new section.
 * If no headers are found, everything is one section (default engagement).
 */
function splitIntoElSections(lines: string[]): ElSection[] {
  const sections: ElSection[] = [];
  let current: ElSection = { label: '', lineIndices: [] };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = normalizeFullWidth(lines[i].trim());

    // Check if this line is an EL header (with or without ordinals after it)
    const headerMatch = trimmed.match(EL_HEADER_REGEX);
    if (headerMatch) {
      // Save previous section if it has content
      if (current.lineIndices.length > 0) {
        sections.push(current);
      }
      const colonIdx = trimmed.indexOf(':');
      const elLabel = trimmed.slice(0, colonIdx).trim();
      // The rest of the line after "EL:" may contain a milestone like "(a) ..."
      current = { label: elLabel, lineIndices: [i] };
      continue;
    }

    // Check if this line is a period/commencement header
    const periodLabel = matchPeriodHeader(trimmed);
    if (periodLabel) {
      // Save previous section if it has content
      if (current.lineIndices.length > 0) {
        sections.push(current);
      }
      // The period header line itself may also contain milestones on subsequent lines
      current = { label: periodLabel, lineIndices: [i] };
      continue;
    }

    current.lineIndices.push(i);
  }

  // Push final section
  if (current.lineIndices.length > 0) {
    sections.push(current);
  }

  return sections;
}


/**
 * Parse milestone lines from given line indices into ParsedMilestone[].
 * Handles EL prefix stripping so lines like "Original EL: (a) ..." are matched.
 */
function parseMilestoneLines(
  lines: string[],
  lineIndices: number[],
  fullText: string,
  strikeMap: boolean[],
  lineCharOffsets: number[],
  globalSortStart: number,
): ParsedMilestone[] {
  const parsed: ParsedMilestone[] = [];

  for (const idx of lineIndices) {
    const line = lines[idx];
    let trimmed = line.trim();
    if (!trimmed) continue;

    // Normalize full-width characters before parsing
    trimmed = normalizeFullWidth(trimmed);

    // Strip EL prefix if present so the ordinal can be found
    trimmed = trimmed.replace(EL_PREFIX_REGEX, '').trim();

    const match = trimmed.match(MILESTONE_LINE_REGEX);
    if (!match) continue;

    const label = (match[1] ?? match[2] ?? match[3] ?? '').toLowerCase().trim();
    const content = (match[4] ?? '').trim();
    if (!label || !content) continue;

    // Check if the majority of this line is struck through
    const lineStart = lineCharOffsets[idx];
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

    // Try primary amount regex (after dash), then fallback to inline format
    let amountMatch = content.match(AMOUNT_AT_END_REGEX);
    let amountValue: number | null = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : null;

    if (amountValue === null || !Number.isFinite(amountValue)) {
      const inlineMatch = content.match(AMOUNT_INLINE_REGEX);
      if (inlineMatch) {
        const rawVal = (inlineMatch[1] ?? inlineMatch[2] ?? '').replace(/,/g, '');
        amountValue = Number(rawVal);
        if (!Number.isFinite(amountValue)) amountValue = null;
      }
    }

    // Third fallback: bare amount as first token (e.g. "250,000" or "100,000 July 2025")
    if (amountValue === null || !Number.isFinite(amountValue)) {
      const bareMatch = content.match(AMOUNT_BARE_REGEX);
      if (bareMatch) {
        const rawVal = bareMatch[1].replace(/,/g, '');
        const val = Number(rawVal);
        // Only accept bare amounts >= 1000 to avoid false positives on short numbers
        if (Number.isFinite(val) && val >= 1000) {
          amountValue = val;
        }
      }
    }

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
      sortOrder: globalSortStart + parsed.length + 1,
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

/**
 * Parse a milestone cell's rich text runs into one or more engagement blocks.
 * Multiple EL sections (e.g. "Original EL:", "Supplemental EL:") produce
 * separate engagement entries, each with its own milestones and LSD.
 */
interface ParsedEngagementBlock {
  elLabel: string; // e.g. "Original EL", "Supplemental EL", or ""
  milestones: ParsedMilestone[];
  lsdDate: Date | null;
  lsdRaw: string | null;
  rawText: string;
}

function parseEngagementBlocksFromRuns(runs: RichTextRun[]): ParsedEngagementBlock[] {
  const fullText = runs.map((r) => r.text).join('');
  if (!fullText.trim()) return [];

  // Build character-level strike map
  const strikeMap: boolean[] = [];
  for (const run of runs) {
    for (let i = 0; i < run.text.length; i++) {
      strikeMap.push(run.strike);
    }
  }

  // Split into lines and compute character offsets per line
  const lines = fullText.split('\n');
  const lineCharOffsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineCharOffsets.push(offset);
    offset += line.length + 1; // +1 for \n
  }

  // Split lines into EL sections
  const elSections = splitIntoElSections(lines);

  // If only one section with no EL label, return it as a single block
  if (elSections.length <= 1) {
    const allIndices = lines.map((_, i) => i);
    const milestones = parseMilestoneLines(lines, allIndices, fullText, strikeMap, lineCharOffsets, 0);
    const { lsdDate, lsdRaw } = parseLsdDates(fullText);
    return [{
      elLabel: elSections[0]?.label ?? '',
      milestones,
      lsdDate,
      lsdRaw,
      rawText: fullText,
    }];
  }

  // Multiple EL sections → separate engagement blocks
  const blocks: ParsedEngagementBlock[] = [];
  let globalSortStart = 0;

  for (const section of elSections) {
    const sectionText = section.lineIndices.map((i) => lines[i]).join('\n');
    const milestones = parseMilestoneLines(
      lines, section.lineIndices, fullText, strikeMap, lineCharOffsets, globalSortStart
    );
    globalSortStart += milestones.length;

    const { lsdDate, lsdRaw } = parseLsdDates(sectionText);

    // Skip empty default sections (no EL label, no milestones, no LSD)
    // These are stray preamble lines before the first real EL header
    if (!section.label && milestones.length === 0 && !lsdDate) continue;

    blocks.push({
      elLabel: section.label,
      milestones,
      lsdDate,
      lsdRaw,
      rawText: sectionText,
    });
  }

  return blocks;
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

    // Parse milestone column — may produce multiple EL-based engagement blocks
    const milestoneCell = row.getCell(9);
    const runs = extractRuns(milestoneCell.value);
    const milestoneText = runs.map((r) => r.text).join('');
    const engBlocks = parseEngagementBlocksFromRuns(runs);
    const feesUsd = getCellNumber(row.getCell(8));

    // Build engagements: one per EL block (or one default if no EL headers)
    const engagements: ExcelEngagement[] = engBlocks.map((block) => ({
      engagementTitle: block.elLabel
        ? `${projectName} - ${block.elLabel}`
        : projectName,
      feesUsd: engBlocks.length === 1 ? feesUsd : null, // fees only on single-engagement rows
      milestones: block.milestones,
      lsdDate: block.lsdDate,
      lsdRaw: block.lsdRaw,
      rawMilestoneText: block.rawText,
    }));

    // If no blocks were produced (empty cell), create a single empty engagement
    if (engagements.length === 0) {
      engagements.push({
        engagementTitle: projectName,
        feesUsd,
        milestones: [],
        lsdDate: null,
        lsdRaw: null,
        rawMilestoneText: milestoneText,
      });
    }

    // For single-engagement rows, ensure feesUsd is set
    if (engagements.length === 1) {
      engagements[0].feesUsd = feesUsd;
    }

    if (isSubRow) {
      // Attach as additional engagement(s) to previous row with same C/M
      const parent = [...rows].reverse().find((r: ExcelRow) => r.cmNo === cmNo);
      if (parent) {
        parent.engagements.push(...engagements);
        // Financial values belong to the parent C/M (not additive — sub-rows don't have separate financials)
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
      engagements,
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
  const newCmNumbers: string[] = [];
  let milestonesToCreate = 0;
  let milestonesToMarkCompleted = 0;
  let financialsToUpdate = 0;

  for (const row of rows) {
    if (!existingSet.has(row.cmNo)) {
      // TBC is a placeholder — skip it entirely
      if (row.cmNo.toUpperCase() === 'TBC' || !row.cmNo.trim()) {
        if (!unmatched.includes(row.cmNo)) unmatched.push(row.cmNo);
        continue;
      }
      // Will be newly created
      if (!newCmNumbers.includes(row.cmNo)) newCmNumbers.push(row.cmNo);
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

  // Run AI validation on all engagements
  const engagementsForValidation = rows.flatMap((row) =>
    row.engagements.map((eng) => ({
      cmNo: row.cmNo,
      engagementTitle: eng.engagementTitle,
      rawMilestoneText: eng.rawMilestoneText,
      parsedMilestones: eng.milestones.map((m) => ({
        ordinal: m.ordinal,
        title: m.title,
        amountValue: m.amountValue,
        isCompleted: m.isCompleted,
      })),
      agreedFee: eng.feesUsd,
      lsdDate: eng.lsdDate ? eng.lsdDate.toISOString().slice(0, 10) : null,
    }))
  );

  let aiValidation: SyncPreview['aiValidation'];
  try {
    const validationResult = await validateParsedData(engagementsForValidation);
    aiValidation = {
      validated: validationResult.validated,
      issues: validationResult.issues,
    };
  } catch (error) {
    logger.error('AI validation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    aiValidation = { validated: false, issues: [] };
  }

  return {
    totalExcelRows: rows.length,
    matchedCmNumbers: matched.length,
    unmatchedCmNumbers: unmatched,
    newCmNumbers,
    projectsToUpdate: matched.length,
    milestonesToCreate,
    milestonesToMarkCompleted,
    financialsToUpdate,
    matched,
    aiValidation,
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
    syncRunData: {
      updatedCms: [],
      newCms: [],
      staffingLinks: [],
      unmatchedNewCms: [],
      skippedCms: [],
    },
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

/**
 * Try to match a newly created billing project to an existing staffing project.
 * Strategy: 1) Match by C/M number prefix (same base matter number)
 *           2) Fallback to name similarity
 * If matched: create billing_staffing_project_link and fill cm_number on the staffing project.
 */
interface StaffingLinkResult {
  staffingProjectId: number;
  staffingProjectName: string;
  matchMethod: string;
  cmNumberSet: boolean;
}

async function autoLinkToStaffingProject(
  billingProjectId: bigint,
  cmNo: string,
  projectName: string,
): Promise<StaffingLinkResult | null> {
  try {
    // Extract C/M base prefix (e.g. "51251" from "51251-00002")
    const cmBase = cmNo.split('-')[0];

    let staffingProject: { id: number; name: string; cm_number: string | null } | null = null;
    let matchMethod = '';

    // Strategy 1: exact cm_number match
    const exactMatch = await prisma.$queryRaw<Array<{
      id: number; name: string; cm_number: string | null;
    }>>(Prisma.sql`
      SELECT id, name, cm_number FROM projects
      WHERE cm_number = ${cmNo}
      LIMIT 1
    `);
    if (exactMatch.length > 0) {
      staffingProject = exactMatch[0];
      matchMethod = 'exact cm_number';
    }

    // Strategy 2: C/M prefix match (same base matter number)
    if (!staffingProject && cmBase) {
      const prefixMatch = await prisma.$queryRaw<Array<{
        id: number; name: string; cm_number: string | null;
      }>>(Prisma.sql`
        SELECT id, name, cm_number FROM projects
        WHERE cm_number LIKE ${cmBase + '-%'}
        LIMIT 1
      `);
      if (prefixMatch.length > 0) {
        staffingProject = prefixMatch[0];
        matchMethod = `cm_number prefix (${cmBase})`;
      }
    }

    // Strategy 3: name similarity (fallback, requires pg_trgm extension)
    if (!staffingProject && projectName) {
      try {
        const nameMatch = await prisma.$queryRaw<Array<{
          id: number; name: string; cm_number: string | null; score: number;
        }>>(Prisma.sql`
          SELECT id, name, cm_number, similarity(name, ${projectName}) as score
          FROM projects
          WHERE similarity(name, ${projectName}) > 0.4
          ORDER BY score DESC
          LIMIT 1
        `);
        if (nameMatch.length > 0) {
          staffingProject = nameMatch[0];
          matchMethod = `name similarity (${Number(nameMatch[0].score).toFixed(2)})`;
        }
      } catch {
        // pg_trgm extension not available — skip name similarity matching
      }
    }

    if (!staffingProject) return null;

    // Create link (skip if already exists)
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO billing_staffing_project_link (billing_project_id, staffing_project_id, auto_match_score, linked_at, notes)
      VALUES (${billingProjectId}, ${staffingProject.id}, ${1.0}, NOW(), ${`Auto-linked by Excel sync (${matchMethod}: "${staffingProject.name}")`})
      ON CONFLICT (billing_project_id, staffing_project_id) DO NOTHING
    `);

    // Fill cm_number on staffing project if not already set
    const cmNumberSet = !staffingProject.cm_number;
    if (cmNumberSet) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE projects
        SET cm_number = ${cmNo}, updated_at = NOW()
        WHERE id = ${staffingProject.id} AND cm_number IS NULL
      `);
    }

    logger.info(`Auto-linked billing project ${billingProjectId} (${cmNo}) → staffing project ${staffingProject.id} (${staffingProject.name}) [${matchMethod}]`);
    return {
      staffingProjectId: staffingProject.id,
      staffingProjectName: staffingProject.name,
      matchMethod,
      cmNumberSet,
    };
  } catch (error) {
    // Don't fail the sync if linking fails
    logger.warn(`Auto-link failed for ${cmNo}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
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

  let cmId: bigint;
  let projectId: bigint;

  if (cmRecords.length === 0) {
    // Skip placeholder C/M values
    if (row.cmNo.toUpperCase() === 'TBC' || !row.cmNo.trim()) {
      if (!result.unmatchedCmNumbers.includes(row.cmNo)) {
        result.unmatchedCmNumbers.push(row.cmNo);
        result.syncRunData.skippedCms.push(row.cmNo);
      }
      return;
    }

    // Create new billing_project + billing_project_cm_no
    const newProject = await prisma.$queryRaw<Array<{ project_id: bigint }>>(Prisma.sql`
      INSERT INTO billing_project (project_name, client_name, attorney_in_charge, sca, created_at, updated_at)
      VALUES (${row.projectName || 'Unnamed'}, ${row.clientName || null}, ${row.attorneyInCharge || null}, ${row.sca || null}, NOW(), NOW())
      RETURNING project_id
    `);
    projectId = newProject[0].project_id;

    const newCm = await prisma.$queryRaw<Array<{ cm_id: bigint }>>(Prisma.sql`
      INSERT INTO billing_project_cm_no (project_id, cm_no, is_primary, status)
      VALUES (${projectId}, ${row.cmNo}, true, 'active')
      RETURNING cm_id
    `);
    cmId = newCm[0].cm_id;
    result.projectsUpdated++;

    // Auto-link to staffing project by name match
    const linkResult = await autoLinkToStaffingProject(projectId, row.cmNo, row.projectName);

    // Record new CM in syncRunData
    const newCmEntry: SyncRunChanges['newCms'][0] = {
      cmNo: row.cmNo,
      projectName: row.projectName || 'Unnamed',
      clientName: row.clientName || '',
      engagements: row.engagements.map(e => ({
        title: e.engagementTitle,
        milestoneCount: e.milestones.length,
      })),
    };
    result.syncRunData.newCms.push(newCmEntry);

    if (linkResult) {
      result.syncRunData.staffingLinks.push({
        cmNo: row.cmNo,
        billingProjectName: row.projectName || 'Unnamed',
        staffingProjectId: linkResult.staffingProjectId,
        staffingProjectName: linkResult.staffingProjectName,
        matchMethod: linkResult.matchMethod,
        cmNumberSet: linkResult.cmNumberSet,
      });
    } else {
      result.syncRunData.unmatchedNewCms.push({
        cmNo: row.cmNo,
        projectName: row.projectName || 'Unnamed',
      });
    }
  } else {
    cmId = cmRecords[0].cm_id;
    projectId = cmRecords[0].project_id;

    // Query current financial values BEFORE update for diff tracking
    const currentFinancials = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT agreed_fee_usd, billing_to_date_usd, collected_to_date_usd,
             billing_credit_usd, ubt_usd, ar_usd, billing_credit_cny, ubt_cny,
             billed_but_unpaid, unbilled_per_el, finance_remarks, matter_notes
      FROM billing_project_cm_no
      WHERE cm_id = ${cmId}
      LIMIT 1
    `);

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

    // Build financial diffs
    const financialChanges: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
    if (currentFinancials.length > 0) {
      const old = currentFinancials[0];
      const fieldMap: Array<{ dbCol: string; label: string; newVal: unknown }> = [
        { dbCol: 'agreed_fee_usd', label: 'Agreed Fee (USD)', newVal: row.engagements[0]?.feesUsd ?? null },
        { dbCol: 'billing_to_date_usd', label: 'Billing (USD)', newVal: row.billingUsd },
        { dbCol: 'collected_to_date_usd', label: 'Collection (USD)', newVal: row.collectionUsd },
        { dbCol: 'billing_credit_usd', label: 'Billing Credit (USD)', newVal: row.billingCreditUsd },
        { dbCol: 'ubt_usd', label: 'UBT (USD)', newVal: row.ubtUsd },
        { dbCol: 'ar_usd', label: 'AR (USD)', newVal: row.arUsd },
        { dbCol: 'billing_credit_cny', label: 'Billing Credit (CNY)', newVal: row.billingCreditCny },
        { dbCol: 'ubt_cny', label: 'UBT (CNY)', newVal: row.ubtCny },
        { dbCol: 'billed_but_unpaid', label: 'Billed but Unpaid', newVal: row.billedButUnpaid },
        { dbCol: 'unbilled_per_el', label: 'Unbilled per EL', newVal: row.unbilledPerEl },
        { dbCol: 'finance_remarks', label: 'Remarks', newVal: row.financeRemarks },
        { dbCol: 'matter_notes', label: 'Matter Notes', newVal: row.matterNotes },
      ];
      for (const f of fieldMap) {
        const oldStr = old[f.dbCol] != null ? String(old[f.dbCol]) : null;
        const newStr = f.newVal != null ? String(f.newVal) : null;
        if (oldStr !== newStr) {
          financialChanges.push({ field: f.label, oldValue: oldStr, newValue: newStr });
        }
      }
    }

    result.syncRunData.updatedCms.push({
      cmNo: row.cmNo,
      projectName: row.projectName || '',
      financialChanges,
      engagements: row.engagements.map(e => ({
        title: e.engagementTitle,
        milestoneCount: e.milestones.length,
        completedCount: e.milestones.filter(m => m.isCompleted).length,
      })),
    });
  }

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
