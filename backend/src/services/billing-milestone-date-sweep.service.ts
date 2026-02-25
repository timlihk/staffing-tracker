import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { withSweepLock } from '../utils/sweep-lock';

const DATE_SWEEP_TRIGGER_STATUS = 'MILESTONE_DUE_DATE_PASSED';
const DATE_SWEEP_MATCH_METHOD = 'date_sweep';
const DATE_SWEEP_ACTION_TYPE = 'issue_invoice';
const DATE_SWEEP_DEFAULT_LIMIT = 2000;

interface SweepCandidate {
  milestone_id: bigint;
  billing_project_id: bigint;
  project_name: string | null;
  cm_no: string | null;
  title: string | null;
  amount_value: Decimal | null;
  amount_currency: string | null;
  effective_due_date: Date | null;
  rule_id: number | null;
}

export interface BillingMilestoneDateSweepOptions {
  dryRun?: boolean;
  limit?: number;
}

export interface BillingMilestoneDateSweepResult {
  dryRun: boolean;
  scanned: number;
  processed: number;
  autoLinked: number;
  skippedNoStaffingProject: number;
  skippedAlreadyTriggered: number;
  errors: number;
}

interface CandidateProcessResult {
  processed: boolean;
  autoLinked: boolean;
  skippedNoStaffingProject: boolean;
  skippedAlreadyTriggered: boolean;
}

export class BillingMilestoneDateSweepService {
  static async runDailySweep(options: BillingMilestoneDateSweepOptions = {}): Promise<BillingMilestoneDateSweepResult> {
    return withSweepLock('billing_date_sweep', () => this.runDailySweepInner(options));
  }

  private static async runDailySweepInner(options: BillingMilestoneDateSweepOptions): Promise<BillingMilestoneDateSweepResult> {
    const dryRun = options.dryRun === true;
    const limit = this.normalizeLimit(options.limit);
    const candidates = await this.fetchCandidates(limit);

    const result: BillingMilestoneDateSweepResult = {
      dryRun,
      scanned: candidates.length,
      processed: 0,
      autoLinked: 0,
      skippedNoStaffingProject: 0,
      skippedAlreadyTriggered: 0,
      errors: 0,
    };

    if (candidates.length === 0) return result;

    // Batch-prefetch dedup set and link map to eliminate per-candidate N+1 queries
    const milestoneIds = candidates.map((c) => this.toBigInt(c.milestone_id));
    const billingProjectIds = [...new Set(candidates.map((c) => this.toBigInt(c.billing_project_id)))];
    const cmNumbers = [...new Set(candidates.map((c) => c.cm_no).filter((v): v is string => v != null))];

    const [alreadyTriggeredRows, existingLinks, cmMatches] = await Promise.all([
      // 1. Dedup: which milestones already have pending/confirmed triggers?
      prisma.billing_milestone_trigger_queue.findMany({
        where: {
          milestone_id: { in: milestoneIds },
          event_type: DATE_SWEEP_TRIGGER_STATUS,
          status: { in: ['pending', 'confirmed'] },
        },
        select: { milestone_id: true },
      }),
      // 2. Link resolution: which billing projects already have staffing links?
      prisma.billing_staffing_project_link.findMany({
        where: {
          billing_project_id: { in: billingProjectIds },
          staffing_project_id: { not: null },
        },
        select: { billing_project_id: true, staffing_project_id: true },
        orderBy: { link_id: 'asc' },
        distinct: ['billing_project_id'],
      }),
      // 3. CM number → staffing project fallback
      cmNumbers.length > 0
        ? prisma.project.findMany({
            where: { cmNumber: { in: cmNumbers } },
            select: { id: true, cmNumber: true },
          })
        : Promise.resolve([]),
    ]);

    const triggeredSet = new Set(alreadyTriggeredRows.map((r) => r.milestone_id));
    const linkMap = new Map(existingLinks.map((r) => [r.billing_project_id!, r.staffing_project_id!]));
    const cmProjectMap = new Map(cmMatches.map((r) => [r.cmNumber!, r.id]));

    // Process candidates in parallel batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map((candidate) =>
          this.processCandidateWithMaps(candidate, dryRun, triggeredSet, linkMap, cmProjectMap)
        )
      );
      for (let j = 0; j < settled.length; j++) {
        const outcome = settled[j];
        if (outcome.status === 'fulfilled') {
          const processed = outcome.value;
          if (processed.processed) result.processed += 1;
          if (processed.autoLinked) result.autoLinked += 1;
          if (processed.skippedNoStaffingProject) result.skippedNoStaffingProject += 1;
          if (processed.skippedAlreadyTriggered) result.skippedAlreadyTriggered += 1;
        } else {
          result.errors += 1;
          const candidate = batch[j];
          logger.error('[BillingDateSweep] Failed processing milestone candidate', {
            milestoneId: Number(candidate.milestone_id),
            projectName: candidate.project_name,
            cmNo: candidate.cm_no,
            error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
          });
        }
      }
    }

    return result;
  }

  private static normalizeLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) {
      return DATE_SWEEP_DEFAULT_LIMIT;
    }
    return Math.min(Math.max(Math.floor(limit), 1), 10000);
  }

  private static async fetchCandidates(limit: number): Promise<SweepCandidate[]> {
    return prisma.$queryRaw<SweepCandidate[]>(Prisma.sql`
      SELECT
        m.milestone_id,
        bp.project_id AS billing_project_id,
        bp.project_name,
        cm.cm_no,
        m.title,
        m.amount_value,
        m.amount_currency,
        COALESCE(m.due_date, due_rule.fallback_due_date) AS effective_due_date,
        due_rule.id AS rule_id
      FROM billing_milestone m
      JOIN billing_engagement e ON e.engagement_id = m.engagement_id
      JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
      JOIN billing_project bp ON bp.project_id = cm.project_id
      LEFT JOIN LATERAL (
        SELECT r.id, r.fallback_due_date
        FROM billing_milestone_trigger_rule r
        WHERE r.milestone_id = m.milestone_id
          AND r.fallback_due_date IS NOT NULL
        ORDER BY r.fallback_due_date ASC, r.id ASC
        LIMIT 1
      ) due_rule ON TRUE
      WHERE m.completed IS NOT TRUE
        AND COALESCE(m.due_date, due_rule.fallback_due_date) IS NOT NULL
        AND COALESCE(m.due_date, due_rule.fallback_due_date) <= CURRENT_DATE
      ORDER BY COALESCE(m.due_date, due_rule.fallback_due_date) ASC, m.milestone_id ASC
      LIMIT ${limit}
    `);
  }

  /** Process a single candidate using pre-fetched dedup set and link maps (no per-candidate queries). */
  private static async processCandidateWithMaps(
    candidate: SweepCandidate,
    dryRun: boolean,
    triggeredSet: Set<bigint>,
    linkMap: Map<bigint, number>,
    cmProjectMap: Map<string, number>,
  ): Promise<CandidateProcessResult> {
    const milestoneId = this.toBigInt(candidate.milestone_id);
    const billingProjectId = this.toBigInt(candidate.billing_project_id);

    // Dedup check — O(1) Set lookup instead of per-candidate DB query
    if (triggeredSet.has(milestoneId)) {
      return { processed: false, autoLinked: false, skippedNoStaffingProject: false, skippedAlreadyTriggered: true };
    }

    // Link resolution — O(1) Map lookup instead of per-candidate DB query
    let staffingProjectId: number | null = linkMap.get(billingProjectId) ?? null;
    let autoLinked = false;

    if (!staffingProjectId && candidate.cm_no) {
      staffingProjectId = cmProjectMap.get(candidate.cm_no.trim()) ?? null;
      if (staffingProjectId && !dryRun) {
        // Persist the auto-link for future runs
        await prisma.$executeRaw(Prisma.sql`
          INSERT INTO billing_staffing_project_link (
            billing_project_id, staffing_project_id, auto_match_score, linked_at, notes
          ) VALUES (
            ${billingProjectId}, ${staffingProjectId}, ${1.0}, NOW(),
            ${'Auto-linked by milestone due-date sweep via C/M number'}
          ) ON CONFLICT (billing_project_id, staffing_project_id) DO NOTHING
        `);
        autoLinked = true;
      }
    }

    if (!staffingProjectId) {
      return { processed: false, autoLinked: false, skippedNoStaffingProject: true, skippedAlreadyTriggered: false };
    }

    if (dryRun) {
      return { processed: true, autoLinked, skippedNoStaffingProject: false, skippedAlreadyTriggered: false };
    }

    await prisma.$transaction(async (tx) => {
      const reason = this.buildTriggerReason(candidate);
      const now = new Date();
      const dueDate = this.defaultActionDueDate(now);

      const trigger = await tx.billing_milestone_trigger_queue.create({
        data: {
          milestone_id: milestoneId,
          staffing_project_id: staffingProjectId!,
          old_status: 'pending',
          new_status: DATE_SWEEP_TRIGGER_STATUS,
          event_type: DATE_SWEEP_TRIGGER_STATUS,
          match_confidence: new Decimal('1.00'),
          trigger_reason: reason,
          status: 'pending',
          rule_id: candidate.rule_id ?? null,
          match_method: DATE_SWEEP_MATCH_METHOD,
        },
      });

      await tx.billing_action_item.create({
        data: {
          trigger_queue_id: trigger.id,
          milestone_id: milestoneId,
          action_type: DATE_SWEEP_ACTION_TYPE,
          description: this.buildActionDescription(candidate),
          due_date: dueDate,
          status: 'pending',
        },
      });
    });

    return { processed: true, autoLinked, skippedNoStaffingProject: false, skippedAlreadyTriggered: false };
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
          ${1.0},
          NOW(),
          ${'Auto-linked by milestone due-date sweep via C/M number'}
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

  private static buildTriggerReason(candidate: SweepCandidate): string {
    const dueDateLabel = candidate.effective_due_date
      ? candidate.effective_due_date.toISOString().slice(0, 10)
      : 'unknown-date';
    return `Due date milestone auto-triggered by daily sweep (effective due date: ${dueDateLabel})`;
  }

  private static buildActionDescription(candidate: SweepCandidate): string {
    const title = candidate.title?.trim() || `Milestone ${Number(candidate.milestone_id)}`;
    const amountLabel = candidate.amount_value
      ? ` (${candidate.amount_value.toString()} ${candidate.amount_currency || 'USD'})`
      : '';
    return `Issue invoice for due milestone: ${title}${amountLabel}`;
  }

  private static defaultActionDueDate(base: Date): Date {
    const due = new Date(base);
    due.setDate(due.getDate() + 1);
    return due;
  }
}

