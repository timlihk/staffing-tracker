import 'dotenv/config';
import { Prisma } from '@prisma/client';
import prisma from '../src/utils/prisma';

type ParsedMilestone = {
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
};

type BackfillStats = {
  referLinksCreated: number;
  referLinksSkipped: number;
  feeRowsChecked: number;
  milestonesCreated: number;
  feeRowsParsed: number;
  feeRowsUnparseable: number;
  projectIdsImproved: Set<number>;
};

const REFER_TO_REGEX = /^\s*refer\s+to\s+([0-9]{5}-[0-9]{1,5})\s*$/i;
const MILESTONE_LINE_REGEX = /^\s*(?:\(([a-zA-Z0-9]+)\)|([0-9]+)[.)]|([a-zA-Z])[.)])\s*(.+)$/;
const AMOUNT_AT_END_REGEX = /[-–—]\s*(?:US\$|USD|RMB|CNY|¥|人民币|元)?\s*([0-9][0-9,]*(?:\.\d+)?)(?:\s*[)])?\s*$/i;
const PERCENT_REGEX = /\(?(\d+(?:\.\d+)?)%\)?/;
const NO_MILESTONE_HINTS = [
  'our charges are based principally on the amount of time spent on the matter',
  'billing on a quarterly basis',
];

const normalizeCmReference = (value: string): string | null => {
  const match = value.match(/([0-9]{5})-([0-9]{1,5})/);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(5, '0')}`;
};

const parseLsd = (rawText: string): { lsdDate: Date | null; lsdRaw: string | null } => {
  const lsdMatch = rawText.match(/\(LSD:\s*([^)]+)\)/i);
  if (!lsdMatch) return { lsdDate: null, lsdRaw: null };

  const lsdRaw = lsdMatch[1]?.trim() ?? null;
  if (!lsdRaw) return { lsdDate: null, lsdRaw: null };

  const englishDate = lsdRaw.match(/([0-9]{1,2})\s+([A-Za-z]{3,})\s+([0-9]{4})/);
  if (englishDate) {
    const [, dayText, monthText, yearText] = englishDate;
    const monthLookup: Record<string, number> = {
      jan: 0, january: 0,
      feb: 1, february: 1,
      mar: 2, march: 2,
      apr: 3, april: 3,
      may: 4,
      jun: 5, june: 5,
      jul: 6, july: 6,
      aug: 7, august: 7,
      sep: 8, september: 8,
      oct: 9, october: 9,
      nov: 10, november: 10,
      dec: 11, december: 11,
    };
    const month = monthLookup[monthText.toLowerCase()];
    if (month !== undefined) {
      const day = Number(dayText);
      const year = Number(yearText);
      return { lsdDate: new Date(year, month, day), lsdRaw };
    }
  }

  const chineseDate = lsdRaw.match(/([0-9]{4})\s*年\s*([0-9]{1,2})\s*月\s*([0-9]{1,2})\s*日/);
  if (chineseDate) {
    const [, yearText, monthText, dayText] = chineseDate;
    const year = Number(yearText);
    const month = Number(monthText) - 1;
    const day = Number(dayText);
    return { lsdDate: new Date(year, month, day), lsdRaw };
  }

  return { lsdDate: null, lsdRaw };
};

const parseMilestonesFromRawText = (rawText: string): ParsedMilestone[] => {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const lower = normalized.toLowerCase();
  if (NO_MILESTONE_HINTS.some((hint) => lower.includes(hint))) {
    return [];
  }
  if (REFER_TO_REGEX.test(normalized)) {
    return [];
  }

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const parsed: ParsedMilestone[] = [];

  for (const line of lines) {
    const match = line.match(MILESTONE_LINE_REGEX);
    if (!match) continue;

    const label = (match[1] ?? match[2] ?? match[3] ?? '').toLowerCase().trim();
    const content = (match[4] ?? '').trim();
    if (!label || !content) continue;

    const percentMatch = content.match(PERCENT_REGEX);
    const percentValue = percentMatch ? Number(percentMatch[1]) : null;
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
      rawFragment: line,
      amountValue: Number.isFinite(amountValue ?? NaN) ? amountValue : null,
      amountCurrency,
      isPercent,
      percentValue: Number.isFinite(percentValue ?? NaN) ? percentValue : null,
      sortOrder: parsed.length + 1,
    });
  }

  // Disambiguate repeated ordinals by appending a suffix (e.g. "(c)" → "(c)", "(c-2)")
  // instead of dropping duplicates, since repeated labels can be distinct milestones.
  const seen = new Map<string, number>();
  for (const m of parsed) {
    const count = (seen.get(m.ordinal) ?? 0) + 1;
    seen.set(m.ordinal, count);
    if (count > 1) {
      m.ordinal = `${m.ordinal.replace(/\)$/, '')}-${count})`;
    }
  }

  return parsed;
};

async function linkReferencedCmNumbers(stats: BackfillStats): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{
    project_id: number;
    raw_text: string;
  }>>(Prisma.sql`
    SELECT DISTINCT
      p.id AS project_id,
      fa.raw_text
    FROM projects p
    JOIN billing_project_cm_no cm ON cm.cm_no = p.cm_number
    JOIN billing_engagement e ON e.cm_id = cm.cm_id
    JOIN billing_fee_arrangement fa ON fa.engagement_id = e.engagement_id
    WHERE fa.raw_text ~* '^\\s*refer\\s+to\\s+[0-9]{5}-[0-9]{1,5}\\s*$'
  `);

  for (const row of rows) {
    const raw = (row.raw_text ?? '').trim();
    const refMatch = raw.match(REFER_TO_REGEX);
    if (!refMatch?.[1]) {
      stats.referLinksSkipped += 1;
      continue;
    }

    const normalized = normalizeCmReference(refMatch[1]);
    if (!normalized) {
      stats.referLinksSkipped += 1;
      continue;
    }

    const target = await prisma.$queryRaw<Array<{
      billing_project_id: bigint;
      milestone_count: number;
    }>>(Prisma.sql`
      SELECT
        cm.project_id AS billing_project_id,
        COUNT(m.milestone_id)::int AS milestone_count
      FROM billing_project_cm_no cm
      LEFT JOIN billing_engagement e ON e.cm_id = cm.cm_id
      LEFT JOIN billing_milestone m ON m.engagement_id = e.engagement_id
      WHERE cm.cm_no = ${normalized}
      GROUP BY cm.project_id
      ORDER BY COUNT(m.milestone_id) DESC, cm.project_id ASC
    `);

    const billingProject = target[0];
    if (!billingProject || Number(billingProject.milestone_count) <= 0) {
      stats.referLinksSkipped += 1;
      continue;
    }

    const inserted = await prisma.$executeRaw(Prisma.sql`
      INSERT INTO billing_staffing_project_link (billing_project_id, staffing_project_id)
      VALUES (${billingProject.billing_project_id}, ${row.project_id})
      ON CONFLICT (billing_project_id, staffing_project_id) DO NOTHING
    `);

    if (inserted > 0) {
      stats.referLinksCreated += 1;
      stats.projectIdsImproved.add(Number(row.project_id));
    } else {
      stats.referLinksSkipped += 1;
    }
  }
}

async function backfillStructuredMilestones(stats: BackfillStats): Promise<void> {
  const feeRows = await prisma.$queryRaw<Array<{
    project_id: number;
    engagement_id: bigint;
    fee_id: bigint;
    raw_text: string;
  }>>(Prisma.sql`
    WITH no_milestone_engagements AS (
      SELECT
        p.id AS project_id,
        e.engagement_id,
        fa.fee_id,
        fa.raw_text
      FROM projects p
      JOIN billing_project_cm_no cm ON cm.cm_no = p.cm_number
      JOIN billing_engagement e ON e.cm_id = cm.cm_id
      JOIN billing_fee_arrangement fa ON fa.engagement_id = e.engagement_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM billing_milestone m
        WHERE m.engagement_id = e.engagement_id
      )
        AND fa.raw_text IS NOT NULL
        AND TRIM(fa.raw_text) <> ''
    )
    SELECT DISTINCT project_id, engagement_id, fee_id, raw_text
    FROM no_milestone_engagements
    ORDER BY project_id, engagement_id
  `);

  for (const row of feeRows) {
    stats.feeRowsChecked += 1;
    const parsed = parseMilestonesFromRawText(row.raw_text);
    if (parsed.length === 0) {
      stats.feeRowsUnparseable += 1;
      continue;
    }

    const { lsdDate, lsdRaw } = parseLsd(row.raw_text);

    await prisma.$transaction(async (tx) => {
      for (const milestone of parsed) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO billing_milestone (
            fee_id,
            engagement_id,
            ordinal,
            title,
            description,
            trigger_type,
            trigger_text,
            amount_value,
            amount_currency,
            is_percent,
            percent_value,
            completed,
            raw_fragment,
            sort_order
          )
          VALUES (
            ${row.fee_id},
            ${row.engagement_id},
            ${milestone.ordinal},
            ${milestone.title},
            ${milestone.description},
            'legacy_text',
            ${milestone.triggerText},
            ${milestone.amountValue},
            ${milestone.amountCurrency},
            ${milestone.isPercent},
            ${milestone.percentValue},
            false,
            ${milestone.rawFragment},
            ${milestone.sortOrder}
          )
          ON CONFLICT (engagement_id, ordinal) DO UPDATE
          SET
            fee_id = EXCLUDED.fee_id,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            trigger_type = EXCLUDED.trigger_type,
            trigger_text = EXCLUDED.trigger_text,
            amount_value = EXCLUDED.amount_value,
            amount_currency = EXCLUDED.amount_currency,
            is_percent = EXCLUDED.is_percent,
            percent_value = EXCLUDED.percent_value,
            raw_fragment = EXCLUDED.raw_fragment,
            sort_order = EXCLUDED.sort_order,
            updated_at = NOW()
        `);
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE billing_fee_arrangement
        SET
          parsed_json = ${JSON.stringify({ milestones: parsed })}::jsonb,
          parser_version = 'backfill_structured_v1',
          parsed_at = NOW(),
          lsd_date = COALESCE(${lsdDate}, lsd_date),
          lsd_raw = COALESCE(${lsdRaw}, lsd_raw),
          updated_at = NOW()
        WHERE fee_id = ${row.fee_id}
      `);
    });

    stats.feeRowsParsed += 1;
    stats.milestonesCreated += parsed.length;
    stats.projectIdsImproved.add(Number(row.project_id));
  }
}

async function main(): Promise<void> {
  const dryRun = !process.argv.includes('--apply');

  if (dryRun) {
    console.log('=== DRY RUN MODE (pass --apply to write changes) ===\n');
  }

  const stats: BackfillStats = {
    referLinksCreated: 0,
    referLinksSkipped: 0,
    feeRowsChecked: 0,
    milestonesCreated: 0,
    feeRowsParsed: 0,
    feeRowsUnparseable: 0,
    projectIdsImproved: new Set<number>(),
  };

  if (dryRun) {
    // In dry-run mode, run everything inside a transaction that we roll back
    await prisma.$transaction(async (tx) => {
      // Temporarily swap prisma references to use transaction client
      const originalQueryRaw = prisma.$queryRaw.bind(prisma);
      const originalExecuteRaw = prisma.$executeRaw.bind(prisma);
      Object.assign(prisma, {
        $queryRaw: tx.$queryRaw.bind(tx),
        $executeRaw: tx.$executeRaw.bind(tx),
        $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx),
      });

      try {
        await linkReferencedCmNumbers(stats);
        await backfillStructuredMilestones(stats);
      } finally {
        Object.assign(prisma, {
          $queryRaw: originalQueryRaw,
          $executeRaw: originalExecuteRaw,
        });
      }

      // Roll back the transaction
      throw new Error('DRY_RUN_ROLLBACK');
    }).catch((error) => {
      if (error instanceof Error && error.message === 'DRY_RUN_ROLLBACK') return;
      throw error;
    });
  } else {
    await linkReferencedCmNumbers(stats);
    await backfillStructuredMilestones(stats);
  }

  const summary = {
    mode: dryRun ? 'dry-run' : 'applied',
    referLinksCreated: stats.referLinksCreated,
    referLinksSkipped: stats.referLinksSkipped,
    feeRowsChecked: stats.feeRowsChecked,
    feeRowsParsed: stats.feeRowsParsed,
    feeRowsUnparseable: stats.feeRowsUnparseable,
    milestonesCreated: stats.milestonesCreated,
    projectsImproved: stats.projectIdsImproved.size,
    improvedProjectIds: Array.from(stats.projectIdsImproved).sort((a, b) => a - b),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
