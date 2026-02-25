import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { withSweepLock } from '../utils/sweep-lock';

const DATE_SWEEP_TRIGGER_STATUS = 'MILESTONE_DUE_DATE_PASSED';
const DATE_SWEEP_MATCH_METHOD = 'date_sweep';
const DATE_SWEEP_COMPLETION_SOURCE = 'date_sweep_auto';
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

    for (const candidate of candidates) {
      try {
        const processed = await this.processCandidate(candidate, dryRun);
        if (processed.processed) result.processed += 1;
        if (processed.autoLinked) result.autoLinked += 1;
        if (processed.skippedNoStaffingProject) result.skippedNoStaffingProject += 1;
        if (processed.skippedAlreadyTriggered) result.skippedAlreadyTriggered += 1;
      } catch (error) {
        result.errors += 1;
        logger.error('[BillingDateSweep] Failed processing milestone candidate', {
          milestoneId: Number(candidate.milestone_id),
          projectName: candidate.project_name,
          cmNo: candidate.cm_no,
          error: error instanceof Error ? error.message : String(error),
        });
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

  private static async processCandidate(candidate: SweepCandidate, dryRun: boolean): Promise<CandidateProcessResult> {
    const milestoneId = this.toBigInt(candidate.milestone_id);
    const billingProjectId = this.toBigInt(candidate.billing_project_id);

    const alreadyTriggered = await prisma.billing_milestone_trigger_queue.findFirst({
      where: {
        milestone_id: milestoneId,
        event_type: DATE_SWEEP_TRIGGER_STATUS,
        status: {
          in: ['pending', 'confirmed'],
        },
      },
      select: { id: true },
    });

    if (alreadyTriggered) {
      return {
        processed: false,
        autoLinked: false,
        skippedNoStaffingProject: false,
        skippedAlreadyTriggered: true,
      };
    }

    const projectResolution = await this.resolveStaffingProjectId(billingProjectId, candidate.cm_no, dryRun);
    if (!projectResolution.staffingProjectId) {
      return {
        processed: false,
        autoLinked: false,
        skippedNoStaffingProject: true,
        skippedAlreadyTriggered: false,
      };
    }

    if (dryRun) {
      return {
        processed: true,
        autoLinked: projectResolution.autoLinked,
        skippedNoStaffingProject: false,
        skippedAlreadyTriggered: false,
      };
    }

    await prisma.$transaction(async (tx) => {
      const reason = this.buildTriggerReason(candidate);
      const now = new Date();
      const dueDate = this.defaultActionDueDate(now);

      const trigger = await tx.billing_milestone_trigger_queue.create({
        data: {
          milestone_id: milestoneId,
          staffing_project_id: projectResolution.staffingProjectId!,
          old_status: 'pending',
          new_status: DATE_SWEEP_TRIGGER_STATUS,
          event_type: DATE_SWEEP_TRIGGER_STATUS,
          match_confidence: new Decimal('1.00'),
          trigger_reason: reason,
          status: 'confirmed',
          confirmed_at: now,
          action_taken: DATE_SWEEP_ACTION_TYPE,
          rule_id: candidate.rule_id ?? null,
          match_method: DATE_SWEEP_MATCH_METHOD,
        },
      });

      await tx.billing_milestone.update({
        where: { milestone_id: milestoneId },
        data: {
          completed: true,
          completion_date: now,
          completion_source: DATE_SWEEP_COMPLETION_SOURCE,
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
            action_type: DATE_SWEEP_ACTION_TYPE,
            description: this.buildActionDescription(candidate),
            due_date: dueDate,
            status: 'pending',
          },
        });
      }
    });

    return {
      processed: true,
      autoLinked: projectResolution.autoLinked,
      skippedNoStaffingProject: false,
      skippedAlreadyTriggered: false,
    };
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

