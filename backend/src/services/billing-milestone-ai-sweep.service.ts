import OpenAI from 'openai';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import config from '../config';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { withSweepLock } from '../utils/sweep-lock';

const AI_TRIGGER_STATUS = 'MILESTONE_AI_DATE_PASSED';
const AI_MATCH_METHOD = 'ai_due_sweep';
const AI_COMPLETION_SOURCE = 'ai_due_sweep_auto';
const AI_ACTION_TYPE = 'issue_invoice';
const DEFAULT_LIMIT = 300;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MIN_CONFIDENCE = 0.75;
const DEFAULT_AUTO_CONFIRM_CONFIDENCE = 0.92;
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

const AIResultSchema = z.object({
  results: z.array(z.object({
    index: z.number().int().min(0),
    due: z.boolean(),
    confidence: z.number().min(0).max(1),
    reason: z.string().optional().default(''),
    parsedDate: z.string().nullable().optional().default(null),
  })),
});

interface SweepCandidate {
  milestone_id: bigint;
  billing_project_id: bigint;
  project_name: string | null;
  cm_no: string | null;
  title: string | null;
  trigger_text: string | null;
  raw_fragment: string | null;
  amount_value: Decimal | null;
  amount_currency: string | null;
  rule_id: number | null;
  rule_auto_confirm: boolean | null;
  rule_manual_confirm_required: boolean | null;
}

interface AIDueEvaluation {
  due: boolean;
  confidence: number;
  reason: string;
  parsedDate: string | null;
}

export interface BillingMilestoneAISweepOptions {
  dryRun?: boolean;
  limit?: number;
  batchSize?: number;
  minConfidence?: number;
  autoConfirmConfidence?: number;
}

export interface BillingMilestoneAISweepResult {
  dryRun: boolean;
  aiEnabled: boolean;
  scanned: number;
  aiFlaggedDue: number;
  processed: number;
  confirmed: number;
  pendingReview: number;
  autoLinked: number;
  skippedNoStaffingProject: number;
  skippedAlreadyTriggered: number;
  skippedLowConfidence: number;
  errors: number;
}

interface CandidateProcessResult {
  processed: boolean;
  confirmed: boolean;
  pendingReview: boolean;
  autoLinked: boolean;
  skippedNoStaffingProject: boolean;
  skippedAlreadyTriggered: boolean;
}

interface AIResultRecord {
  index: number;
  due: boolean;
  confidence: number;
  reason: string;
  parsedDate: string | null;
}

const SYSTEM_PROMPT = `You analyze Chinese/English law-firm billing milestones to determine if a fee installment is due as of a supplied reference date.

Each milestone has: title (short label), triggerText (parsed condition), rawFragment (original engagement-letter text). These often overlap — use whichever is most complete.

## Rules

1. EXPLICIT DATE PASSED: If the text contains a full calendar date (year+month+day, e.g. "2025年11月30日", "2026-03-31") and that date ≤ asOfDate → due=true.

2. "或" (OR) / "以较早者为准" (whichever is earlier): The milestone is due at the EARLIER of an event or a date. If the explicit date has passed, the date leg has triggered regardless of whether the event occurred → due=true, confidence ≥ 0.90.
   Example: "于通过上市聆讯或2026年3月31日" → if asOfDate ≥ 2026-03-31, due=true.

3. "且" (AND) / both-required: The milestone requires BOTH an event AND a date/condition. If the date has passed but the event is unknowable from text → due=true but with LOWER confidence (0.75–0.85), because the event condition may not yet be satisfied.
   Example: "通过上市聆讯且收到账单后的20个工作日内, 2025年11月30日前" → date passed, but hearing+invoice unknown → due=true, confidence ~0.78.

4. PURELY EVENT-BASED (no date at all): Triggers like "上市完成后20日内", "upon listing", "A1申请后30日内" with no calendar date → due=false. We cannot determine if the event has occurred.

5. CONDITIONAL / HYPOTHETICAL clauses: Text like "假如未能于...完成" (if the project fails to complete by...) describes a contingency, not a payment trigger. Treat the date as a deadline whose passing makes the contingent payment due → due=true, confidence ~0.80.

6. PARTIAL DATES: "于8月8日后" with no year — if the year is ambiguous and cannot be inferred from surrounding text, return due=false, confidence=0.

7. "收到账单后" / "收到发票后" (after receiving invoice): This is an invoice prerequisite we track separately. Ignore it for due-date purposes — focus only on whether the calendar date has passed.

## Confidence calibration

- 0.95: Unambiguous standalone date, clearly passed ("于2025年12月31日之前")
- 0.90: "或"/earlier-of with clear date passed
- 0.80: "且"/both-required with date passed but event unknown; or conditional clause
- 0.75: Ambiguous phrasing but date likely passed
- 0.00: No date found, purely event-based, or year unclear

## Response format — strict JSON, one entry per input milestone:
{
  "results": [
    { "index": 0, "due": true, "confidence": 0.93, "parsedDate": "2025-12-31", "reason": "standalone date passed" },
    { "index": 1, "due": false, "confidence": 0, "parsedDate": null, "reason": "purely event-based, no calendar date" }
  ]
}`;

export class BillingMilestoneAISweepService {
  private static client: OpenAI | null = null;

  static async runDailySweep(
    options: BillingMilestoneAISweepOptions = {}
  ): Promise<BillingMilestoneAISweepResult> {
    return withSweepLock('billing_ai_sweep', () => this.runDailySweepInner(options));
  }

  private static async runDailySweepInner(
    options: BillingMilestoneAISweepOptions
  ): Promise<BillingMilestoneAISweepResult> {
    const dryRun = options.dryRun === true;
    const client = this.getClient();
    const limit = this.normalizeLimit(options.limit);
    const batchSize = this.normalizeBatchSize(options.batchSize);
    const minConfidence = this.normalizeConfidence(options.minConfidence, DEFAULT_MIN_CONFIDENCE);
    const autoConfirmConfidence = this.normalizeConfidence(
      options.autoConfirmConfidence,
      DEFAULT_AUTO_CONFIRM_CONFIDENCE
    );

    const result: BillingMilestoneAISweepResult = {
      dryRun,
      aiEnabled: !!client,
      scanned: 0,
      aiFlaggedDue: 0,
      processed: 0,
      confirmed: 0,
      pendingReview: 0,
      autoLinked: 0,
      skippedNoStaffingProject: 0,
      skippedAlreadyTriggered: 0,
      skippedLowConfidence: 0,
      errors: 0,
    };

    if (!client) {
      logger.info('[BillingAISweep] AI not configured; sweep skipped');
      return result;
    }

    const candidates = await this.fetchCandidates(limit);
    result.scanned = candidates.length;
    if (candidates.length === 0) {
      return result;
    }

    const asOfDate = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      let evaluationsByIndex = new Map<number, AIDueEvaluation>();

      try {
        evaluationsByIndex = await this.evaluateBatch(client, batch, asOfDate);
      } catch (error) {
        logger.error('[BillingAISweep] Batch evaluation failed', {
          batchStart: i,
          error: error instanceof Error ? error.message : String(error),
        });
        result.errors += batch.length;
        continue;
      }

      for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
        const candidate = batch[batchIndex];
        const evaluation = evaluationsByIndex.get(batchIndex);

        if (!evaluation || !evaluation.due) {
          continue;
        }

        result.aiFlaggedDue += 1;

        if (evaluation.confidence < minConfidence) {
          result.skippedLowConfidence += 1;
          continue;
        }

        try {
          const processed = await this.processCandidate(
            candidate,
            evaluation,
            {
              dryRun,
              autoConfirmConfidence,
            }
          );

          if (processed.processed) result.processed += 1;
          if (processed.confirmed) result.confirmed += 1;
          if (processed.pendingReview) result.pendingReview += 1;
          if (processed.autoLinked) result.autoLinked += 1;
          if (processed.skippedNoStaffingProject) result.skippedNoStaffingProject += 1;
          if (processed.skippedAlreadyTriggered) result.skippedAlreadyTriggered += 1;
        } catch (error) {
          result.errors += 1;
          logger.error('[BillingAISweep] Failed processing milestone', {
            milestoneId: Number(candidate.milestone_id),
            cmNo: candidate.cm_no,
            projectName: candidate.project_name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return result;
  }

  private static getClient(): OpenAI | null {
    if (!config.ai.enabled || !config.ai.apiKey) return null;
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: config.ai.apiKey,
        baseURL: config.ai.baseUrl,
      });
    }
    return this.client;
  }

  private static normalizeLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
    return Math.min(Math.max(Math.floor(limit), 1), 3000);
  }

  private static normalizeBatchSize(batchSize?: number): number {
    if (!batchSize || !Number.isFinite(batchSize)) return DEFAULT_BATCH_SIZE;
    return Math.min(Math.max(Math.floor(batchSize), 1), 50);
  }

  private static normalizeConfidence(value: number | undefined, fallback: number): number {
    if (!Number.isFinite(value)) return fallback;
    const normalized = Math.min(Math.max(value!, 0), 1);
    return Math.round(normalized * 100) / 100;
  }

  private static async fetchCandidates(limit: number): Promise<SweepCandidate[]> {
    return prisma.$queryRaw<SweepCandidate[]>(Prisma.sql`
      SELECT
        m.milestone_id,
        bp.project_id AS billing_project_id,
        bp.project_name,
        cm.cm_no,
        m.title,
        m.trigger_text,
        m.raw_fragment,
        m.amount_value,
        m.amount_currency,
        rule_meta.id AS rule_id,
        rule_meta.auto_confirm AS rule_auto_confirm,
        rule_meta.manual_confirm_required AS rule_manual_confirm_required
      FROM billing_milestone m
      JOIN billing_engagement e ON e.engagement_id = m.engagement_id
      JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
      JOIN billing_project bp ON bp.project_id = cm.project_id
      LEFT JOIN LATERAL (
        SELECT
          r.id,
          r.auto_confirm,
          r.manual_confirm_required
        FROM billing_milestone_trigger_rule r
        WHERE r.milestone_id = m.milestone_id
        ORDER BY r.updated_at DESC, r.id DESC
        LIMIT 1
      ) rule_meta ON TRUE
      WHERE m.completed IS NOT TRUE
        AND m.due_date IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM billing_milestone_trigger_rule r_due
          WHERE r_due.milestone_id = m.milestone_id
            AND r_due.fallback_due_date IS NOT NULL
        )
        AND COALESCE(
          NULLIF(BTRIM(m.trigger_text), ''),
          NULLIF(BTRIM(m.title), ''),
          NULLIF(BTRIM(m.raw_fragment), '')
        ) IS NOT NULL
      ORDER BY m.updated_at DESC, m.milestone_id ASC
      LIMIT ${limit}
    `);
  }

  private static async evaluateBatch(
    client: OpenAI,
    batch: SweepCandidate[],
    asOfDate: string
  ): Promise<Map<number, AIDueEvaluation>> {
    const rows = batch.map((candidate, index) => ({
      index,
      milestoneId: Number(candidate.milestone_id),
      projectName: candidate.project_name ?? '',
      cmNo: candidate.cm_no ?? '',
      title: this.trimForPrompt(candidate.title, 240),
      triggerText: this.trimForPrompt(candidate.trigger_text, 700),
      rawFragment: this.trimForPrompt(candidate.raw_fragment, 900),
    }));

    const content = await this.callAIWithRetry(client, rows, asOfDate);
    if (!content) {
      return new Map<number, AIDueEvaluation>();
    }

    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(content);
    } catch {
      logger.error('[BillingAISweep] Failed to parse AI response as JSON', {
        preview: content.slice(0, 240),
      });
      return new Map<number, AIDueEvaluation>();
    }

    const validated = AIResultSchema.safeParse(rawParsed);
    if (!validated.success) {
      logger.error('[BillingAISweep] AI response failed schema validation', {
        errors: validated.error.issues.slice(0, 5),
        preview: content.slice(0, 240),
      });
      return new Map<number, AIDueEvaluation>();
    }

    const result = new Map<number, AIDueEvaluation>();
    for (const item of validated.data.results) {
      if (item.index >= batch.length) continue;

      const confidence = this.normalizeConfidence(item.confidence, 0);
      result.set(item.index, {
        due: item.due,
        confidence,
        reason: this.trimForPrompt(item.reason || 'AI flagged due-date condition', 240),
        parsedDate: item.parsedDate || null,
      });
    }

    return result;
  }

  private static async callAIWithRetry(
    client: OpenAI,
    rows: Array<Record<string, unknown>>,
    asOfDate: string,
  ): Promise<string | null> {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: config.ai.model || 'deepseek-chat',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: JSON.stringify({ asOfDate, milestones: rows }),
            },
          ],
        });
        return response.choices[0]?.message?.content ?? null;
      } catch (error) {
        const isLast = attempt === RETRY_ATTEMPTS;
        logger.warn(`[BillingAISweep] AI call attempt ${attempt}/${RETRY_ATTEMPTS} failed`, {
          error: error instanceof Error ? error.message : String(error),
          willRetry: !isLast,
        });
        if (isLast) throw error;
        await this.sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
      }
    }
    return null; // unreachable but satisfies TS
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static async processCandidate(
    candidate: SweepCandidate,
    evaluation: AIDueEvaluation,
    options: { dryRun: boolean; autoConfirmConfidence: number }
  ): Promise<CandidateProcessResult> {
    const milestoneId = this.toBigInt(candidate.milestone_id);
    const billingProjectId = this.toBigInt(candidate.billing_project_id);
    const shouldAutoConfirm = this.shouldAutoConfirm(candidate, evaluation.confidence, options.autoConfirmConfidence);

    const existingTrigger = await prisma.billing_milestone_trigger_queue.findFirst({
      where: {
        milestone_id: milestoneId,
        event_type: AI_TRIGGER_STATUS,
        status: {
          in: ['pending', 'confirmed'],
        },
      },
      select: { id: true },
    });

    if (existingTrigger) {
      return {
        processed: false,
        confirmed: false,
        pendingReview: false,
        autoLinked: false,
        skippedNoStaffingProject: false,
        skippedAlreadyTriggered: true,
      };
    }

    const projectResolution = await this.resolveStaffingProjectId(
      billingProjectId,
      candidate.cm_no,
      options.dryRun
    );
    if (!projectResolution.staffingProjectId) {
      return {
        processed: false,
        confirmed: false,
        pendingReview: false,
        autoLinked: false,
        skippedNoStaffingProject: true,
        skippedAlreadyTriggered: false,
      };
    }

    if (options.dryRun) {
      return {
        processed: true,
        confirmed: shouldAutoConfirm,
        pendingReview: !shouldAutoConfirm,
        autoLinked: projectResolution.autoLinked,
        skippedNoStaffingProject: false,
        skippedAlreadyTriggered: false,
      };
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const triggerStatus = shouldAutoConfirm ? 'confirmed' : 'pending';

      const trigger = await tx.billing_milestone_trigger_queue.create({
        data: {
          milestone_id: milestoneId,
          staffing_project_id: projectResolution.staffingProjectId!,
          old_status: 'pending',
          new_status: AI_TRIGGER_STATUS,
          event_type: AI_TRIGGER_STATUS,
          match_confidence: new Decimal(evaluation.confidence.toFixed(2)),
          trigger_reason: this.buildTriggerReason(candidate, evaluation),
          status: triggerStatus,
          confirmed_at: shouldAutoConfirm ? now : null,
          action_taken: shouldAutoConfirm ? AI_ACTION_TYPE : null,
          rule_id: candidate.rule_id ?? null,
          match_method: AI_MATCH_METHOD,
        },
      });

      if (!shouldAutoConfirm) {
        return;
      }

      await tx.billing_milestone.update({
        where: { milestone_id: milestoneId },
        data: {
          completed: true,
          completion_date: now,
          completion_source: AI_COMPLETION_SOURCE,
        },
      });

      const existingActionItem = await tx.billing_action_item.findFirst({
        where: { trigger_queue_id: trigger.id },
        orderBy: { id: 'desc' },
      });

      if (!existingActionItem) {
        await tx.billing_action_item.create({
          data: {
            trigger_queue_id: trigger.id,
            milestone_id: milestoneId,
            action_type: AI_ACTION_TYPE,
            description: this.buildActionDescription(candidate),
            due_date: this.defaultActionDueDate(now),
            status: 'pending',
          },
        });
      }
    });

    return {
      processed: true,
      confirmed: shouldAutoConfirm,
      pendingReview: !shouldAutoConfirm,
      autoLinked: projectResolution.autoLinked,
      skippedNoStaffingProject: false,
      skippedAlreadyTriggered: false,
    };
  }

  private static shouldAutoConfirm(
    candidate: SweepCandidate,
    confidence: number,
    autoConfirmConfidence: number
  ): boolean {
    if (candidate.rule_auto_confirm === true) {
      return true;
    }
    return confidence >= autoConfirmConfidence;
  }

  private static async resolveStaffingProjectId(
    billingProjectId: bigint,
    cmNo: string | null,
    dryRun: boolean
  ): Promise<{ staffingProjectId: number | null; autoLinked: boolean }> {
    const existingLink = await prisma.billing_staffing_project_link.findFirst({
      where: {
        billing_project_id: billingProjectId,
        staffing_project_id: { not: null },
      },
      orderBy: { link_id: 'asc' },
      select: { staffing_project_id: true },
    });

    if (existingLink?.staffing_project_id) {
      return { staffingProjectId: existingLink.staffing_project_id, autoLinked: false };
    }

    if (!cmNo) {
      return { staffingProjectId: null, autoLinked: false };
    }

    const matchedProject = await prisma.project.findFirst({
      where: { cmNumber: cmNo.trim() },
      select: { id: true },
    });

    if (!matchedProject) {
      return { staffingProjectId: null, autoLinked: false };
    }

    if (!dryRun) {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO billing_staffing_project_link (
          billing_project_id,
          staffing_project_id,
          auto_match_score,
          linked_at,
          notes
        )
        VALUES (
          ${billingProjectId},
          ${matchedProject.id},
          ${0.95},
          NOW(),
          ${'Auto-linked by AI milestone sweep via C/M number'}
        )
        ON CONFLICT (billing_project_id, staffing_project_id) DO NOTHING
      `);
    }

    return { staffingProjectId: matchedProject.id, autoLinked: true };
  }

  private static toBigInt(value: bigint | number | string): bigint {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(Math.trunc(value));
    return BigInt(value);
  }

  private static buildTriggerReason(candidate: SweepCandidate, evaluation: AIDueEvaluation): string {
    const dateLabel = evaluation.parsedDate ? ` Parsed date: ${evaluation.parsedDate}.` : '';
    return `AI daily sweep flagged milestone as due.${dateLabel} ${evaluation.reason}`.trim();
  }

  private static buildActionDescription(candidate: SweepCandidate): string {
    const title = candidate.title?.trim() || `Milestone ${Number(candidate.milestone_id)}`;
    const amountLabel = candidate.amount_value
      ? ` (${candidate.amount_value.toString()} ${candidate.amount_currency || 'USD'})`
      : '';
    return `Issue invoice for AI-confirmed milestone: ${title}${amountLabel}`;
  }

  private static defaultActionDueDate(base: Date): Date {
    const due = new Date(base);
    due.setDate(due.getDate() + 1);
    return due;
  }

  private static trimForPrompt(value: string | null | undefined, maxLength: number): string {
    const text = (value || '').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3)}...`;
  }
}
