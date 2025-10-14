import { promises as fs } from 'fs';
import path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';

type AmountEntry = {
  raw?: string;
  value?: number | null;
  currency?: string | null;
};

type PercentageEntry = {
  value?: number | null;
};

type SubMilestoneEntry = {
  ordinal?: string | null;
  description?: string | null;
  raw_text?: string | null;
  amounts?: AmountEntry[] | null;
  percentages?: PercentageEntry[] | null;
};

type MilestoneEntry = {
  ordinal?: string | null;
  sequence?: number | null;
  title?: string | null;
  description?: string | null;
  body_text?: string | null;
  completed?: boolean | null;
  raw_text?: string | null;
  raw_html?: string | null;
  amounts?: AmountEntry[] | null;
  percentages?: PercentageEntry[] | null;
  sub_milestones?: SubMilestoneEntry[] | null;
};

type FeeArrangementEntry = {
  raw_text?: string | null;
  raw_html?: string | null;
  lsd_raw?: string | null;
  lsd_date_iso?: string | null;
  milestones?: MilestoneEntry[] | null;
};

type ProjectEntry = {
  cm_number?: string | null;
  project_name?: string | null;
  remarks?: string | null;
  fee_arrangement?: FeeArrangementEntry | null;
};

type ParsedPayload = {
  projects?: ProjectEntry[];
};

const prisma = new PrismaClient();

function toDecimal(value: number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return new Prisma.Decimal(value);
}

function inferEngagementCode(project: ProjectEntry): string {
  const name = (project.project_name || '').toLowerCase();
  const remarks = (project.remarks || '').toLowerCase();

  if (name.includes('2nd supplemental') || remarks.includes('2nd supplemental') || name.includes('second supplemental')) {
    return '2nd_supplemental';
  }
  if (name.includes('supplemental') || remarks.includes('supplemental')) {
    return 'supplemental';
  }
  if (name.includes('extension') || remarks.includes('extension')) {
    return 'extension';
  }
  return 'original';
}

async function ensureFeeArrangement(engagementId: bigint, project: ProjectEntry, fee: FeeArrangementEntry | null | undefined) {
  const existing = await prisma.billing_fee_arrangement.findFirst({
    where: { engagement_id: engagementId },
    orderBy: { created_at: 'desc' },
  });

  const rawText = fee?.raw_text || null;
  const rawHtml = fee?.raw_html || null;
  const parsedJson = fee ? fee : null;
  const lsdIso = fee?.lsd_date_iso || null;
  const lsdDate = lsdIso ? new Date(lsdIso) : null;
  const lsdRaw = fee?.lsd_raw || null;

  if (existing) {
    await prisma.billing_fee_arrangement.update({
      where: { fee_id: existing.fee_id },
      data: {
        raw_text: rawText ?? existing.raw_text,
        original_markup_html: rawHtml,
        parsed_json: parsedJson ?? Prisma.JsonNull,
        lsd_date: lsdDate,
        lsd_raw: lsdRaw,
        parser_version: 'html_parser_v2',
        parsed_at: new Date(),
        updated_at: new Date(),
      },
    });
    return existing.fee_id;
  }

  const created = await prisma.billing_fee_arrangement.create({
    data: {
      engagement_id: engagementId,
      raw_text: rawText ?? '',
      original_markup_html: rawHtml,
      parsed_json: parsedJson ?? Prisma.JsonNull,
      lsd_date: lsdDate,
      lsd_raw: lsdRaw,
      parser_version: 'html_parser_v2',
      parsed_at: new Date(),
    },
  });

  return created.fee_id;
}

function firstAmount(amounts: AmountEntry[] | null | undefined): AmountEntry | null {
  if (!amounts || amounts.length === 0) {
    return null;
  }
  for (const entry of amounts) {
    if (!entry) continue;
    const value = entry.value;
    if (value !== null && value !== undefined) {
      return entry;
    }
  }
  return amounts[0] ?? null;
}

function firstPercentage(percentages: PercentageEntry[] | null | undefined): PercentageEntry | null {
  if (!percentages || percentages.length === 0) {
    return null;
  }
  for (const entry of percentages) {
    if (!entry) continue;
    const value = entry.value;
    if (value !== null && value !== undefined) {
      return entry;
    }
  }
  return percentages[0] ?? null;
}

async function importMilestone(
  feeId: bigint,
  engagementId: bigint,
  milestone: MilestoneEntry,
  parsedAt: Date,
): Promise<bigint> {
  const ordinal = (milestone.ordinal || '').trim();
  if (!ordinal) {
    throw new Error('Milestone missing ordinal');
  }

  const sequence = milestone.sequence ?? null;
  const bodyText = milestone.body_text || milestone.description || null;
  const title = milestone.title || null;
  const completed = Boolean(milestone.completed);
  const rawText = milestone.raw_text || bodyText || '';
  const rawHtml = milestone.raw_html || null;

  const primaryAmount = firstAmount(milestone.amounts);
  const primaryPercentage = firstPercentage(milestone.percentages);

  const amountValue = primaryAmount?.value ?? null;
  const amountCurrency = primaryAmount?.currency ?? null;
  const percentValue = primaryPercentage?.value ?? null;

  const data = {
    fee_id: feeId,
    description: bodyText,
    title,
    trigger_text: bodyText,
    sort_order: sequence ?? undefined,
    completed,
    completion_source: completed ? 'html_parser' : null,
    raw_fragment: rawText,
    raw_html: rawHtml,
    amount_value: amountValue !== null ? toDecimal(amountValue) : null,
    amount_currency: amountCurrency ?? null,
    is_percent: percentValue !== null,
    percent_value: percentValue !== null ? toDecimal(percentValue) : null,
    updated_at: parsedAt,
  } satisfies Prisma.billing_milestoneUncheckedUpdateInput;

  const record = await prisma.billing_milestone.upsert({
    where: {
      engagement_id_ordinal: {
        engagement_id: engagementId,
        ordinal,
      },
    },
    create: {
      engagement_id: engagementId,
      ordinal,
      ...data,
      created_at: parsedAt,
    },
    update: data,
  });

  await prisma.billing_milestone_amount.deleteMany({
    where: { milestone_id: record.milestone_id },
  });

  const amounts = milestone.amounts ?? [];
  for (const [index, amt] of amounts.entries()) {
    if (!amt) continue;
    const raw = amt.raw ?? amt.value?.toString() ?? null;
    if (!raw) continue;

    await prisma.billing_milestone_amount.create({
      data: {
        milestone_id: record.milestone_id,
        display_order: index + 1,
        raw_value: raw,
        amount_value: amt.value !== null && amt.value !== undefined ? toDecimal(amt.value) : null,
        amount_currency: amt.currency ?? null,
      },
    });
  }

  await prisma.billing_sub_milestone.deleteMany({
    where: { milestone_id: record.milestone_id },
  });

  const subMilestones = milestone.sub_milestones ?? [];
  for (const [index, sub] of subMilestones.entries()) {
    if (!sub || !sub.ordinal) continue;
    const subRecord = await prisma.billing_sub_milestone.create({
      data: {
        milestone_id: record.milestone_id,
        ordinal: sub.ordinal,
        description: sub.description || null,
        raw_text: sub.raw_text || sub.description || null,
        sort_order: index + 1,
        completed,
      },
    });

    const subAmounts = sub.amounts ?? [];
    for (const [amountIndex, amt] of subAmounts.entries()) {
      if (!amt) continue;
      const raw = amt.raw ?? amt.value?.toString() ?? null;
      if (!raw) continue;

      await prisma.billing_milestone_amount.create({
        data: {
          milestone_id: record.milestone_id,
          sub_milestone_id: subRecord.sub_milestone_id,
          display_order: amountIndex + 1,
          raw_value: raw,
          amount_value: amt.value !== null && amt.value !== undefined ? toDecimal(amt.value) : null,
          amount_currency: amt.currency ?? null,
        },
      });
    }
  }

  return record.milestone_id;
}

async function importProject(project: ProjectEntry, parsedAt: Date) {
  const cmNumber = project.cm_number?.trim();
  if (!cmNumber) {
    console.warn('⚠️  Skipping project without CM number');
    return;
  }

  const cmRecord = await prisma.billing_project_cm_no.findFirst({
    where: { cm_no: cmNumber },
    include: {
      billing_project: true,
      billing_engagement: true,
    },
    orderBy: [
      { is_primary: 'desc' },
      { cm_id: 'asc' },
    ],
  });

  if (!cmRecord) {
    console.warn(`⚠️  No billing_project_cm_no found for CM ${cmNumber}`);
    return;
  }

  const engagements = cmRecord.billing_engagement;
  if (!engagements || engagements.length === 0) {
    console.warn(`⚠️  No billing_engagement records linked to CM ${cmNumber}`);
    return;
  }

  const targetCode = inferEngagementCode(project);
  const engagement =
    engagements.find((item) => (item.engagement_code || 'original') === targetCode) ||
    engagements[0];

  const feeId = await ensureFeeArrangement(engagement.engagement_id, project, project.fee_arrangement);

  const milestones = project.fee_arrangement?.milestones ?? [];
  for (const milestone of milestones) {
    try {
      await importMilestone(feeId, engagement.engagement_id, milestone, parsedAt);
    } catch (error) {
      console.error(`❌ Failed to import milestone ${milestone.ordinal} for CM ${cmNumber}:`, error);
    }
  }
}

async function main() {
  try {
    const repoRoot = path.resolve(__dirname, '../../..');
    const jsonPath = path.join(repoRoot, 'Billing', 'fee_arrangements_structured.json');
    const raw = await fs.readFile(jsonPath, 'utf-8');
    const payload = JSON.parse(raw) as ParsedPayload | ProjectEntry[];

    const projects = Array.isArray(payload) ? payload : payload.projects ?? [];
    const parsedAt = new Date();

    for (const project of projects) {
      await importProject(project, parsedAt);
    }

    console.log(`✅ Imported fee arrangements for ${projects.length} projects.`);
  } catch (error) {
    console.error('❌ Failed to import fee arrangements', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
