import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { getIntermediateStages, isBackwardTransition } from '../utils/lifecycle';

export const CanonicalProjectEventType = {
  PROJECT_CLOSED: 'PROJECT_CLOSED',
  PROJECT_TERMINATED: 'PROJECT_TERMINATED',
  PROJECT_PAUSED: 'PROJECT_PAUSED',
  PROJECT_RESUMED: 'PROJECT_RESUMED',
  EL_SIGNED: 'EL_SIGNED',
  PROJECT_KICKOFF: 'PROJECT_KICKOFF',
  CONFIDENTIAL_FILING_SUBMITTED: 'CONFIDENTIAL_FILING_SUBMITTED',
  A1_SUBMITTED: 'A1_SUBMITTED',
  HEARING_PASSED: 'HEARING_PASSED',
  LISTING_COMPLETED: 'LISTING_COMPLETED',
  RENEWAL_CYCLE_STARTED: 'RENEWAL_CYCLE_STARTED',
} as const;

export type CanonicalProjectEventType = (typeof CanonicalProjectEventType)[keyof typeof CanonicalProjectEventType];

export interface CreateProjectEventInput {
  projectId: number;
  eventType: string;
  occurredAt?: Date;
  source?: string;
  payload?: Record<string, unknown> | null;
  createdBy?: number;
  statusFrom?: string | null;
  statusTo?: string | null;
  lifecycleStageFrom?: string | null;
  lifecycleStageTo?: string | null;
  eventKey?: string | null;
  processTriggers?: boolean;
}

interface ProjectTransitionInput {
  projectId: number;
  oldStatus?: string | null;
  newStatus?: string | null;
  oldLifecycleStage?: string | null;
  newLifecycleStage?: string | null;
  userId?: number;
}

interface PendingTriggerFromEventData {
  milestone_id: bigint;
  staffing_project_id: number;
  old_status: string;
  new_status: string;
  event_type: string;
  match_confidence: number;
  trigger_reason: string;
  project_event_id: number;
  rule_id?: number | null;
  match_method: string;
}

interface RuleMatchResult {
  matched: boolean;
  confidence: number;
  reason: string;
  ruleId: number | null;
  matchMethod: string;
}

export interface InferredTriggerRule {
  trigger_mode: 'common' | 'bespoke' | 'manual';
  anchor_event_type: string | null;
  requires_invoice_issued: boolean;
  requires_payment_received: boolean;
  due_in_business_days: number | null;
  fallback_due_date: Date | null;
  recurrence: 'none' | 'annual' | 'semiannual';
  auto_confirm: boolean;
  manual_confirm_required: boolean;
  condition_json: Record<string, unknown> | null;
  confidence: number;
  reason: string;
}

const PAUSED_STATUSES = new Set(['Suspended', 'Slow-down', 'On Hold']);

const STATUS_TRIGGER_KEYWORDS: Record<string, string[]> = {
  Closed: ['close', 'completion', 'final', 'complete', 'done', 'finished', '上市完成', '挂牌'],
  Terminated: ['terminat', 'cancel', 'termination', 'cancellation', '终止', '取消'],
  Suspended: ['suspend', 'halt', 'pause', 'hold', 'slow', 'delay', 'defer', '暂停', '延后'],
};

const EVENT_ANCHORS: Array<{ eventType: CanonicalProjectEventType; patterns: RegExp[]; confidence: number }> = [
  {
    eventType: CanonicalProjectEventType.LISTING_COMPLETED,
    patterns: [/上市完成|挂牌|completion of the offering|successful listing|offering completion|close of offering/i],
    confidence: 0.95,
  },
  {
    eventType: CanonicalProjectEventType.HEARING_PASSED,
    patterns: [/聆讯|hearing/i],
    confidence: 0.9,
  },
  {
    eventType: CanonicalProjectEventType.A1_SUBMITTED,
    patterns: [/a1|公开递交|public filing|form f-?1|registration statement/i],
    confidence: 0.9,
  },
  {
    eventType: CanonicalProjectEventType.CONFIDENTIAL_FILING_SUBMITTED,
    patterns: [/秘交|confidential (filing|submission)/i],
    confidence: 0.9,
  },
  {
    eventType: CanonicalProjectEventType.PROJECT_KICKOFF,
    patterns: [/启动|commencement|commence|kick[\s-]*off|launch of project/i],
    confidence: 0.85,
  },
  {
    eventType: CanonicalProjectEventType.EL_SIGNED,
    patterns: [/签署|聘用函|engagement letter|execution|executed|signing|signed/i],
    confidence: 0.85,
  },
  {
    eventType: CanonicalProjectEventType.RENEWAL_CYCLE_STARTED,
    patterns: [/续期|anniversary|renewal|each year|每年/i],
    confidence: 0.8,
  },
];

export class ProjectEventTriggerService {
  static async processProjectTransition(input: ProjectTransitionInput): Promise<{
    eventsCreated: number;
    triggersCreated: number;
    eventIds: number[];
  }> {
    const settings = await prisma.appSettings.findFirst();
    if (!settings?.billingTriggerEnabled) {
      return { eventsCreated: 0, triggersCreated: 0, eventIds: [] };
    }

    // Each event descriptor carries its own lifecycle stage context
    interface EventDescriptor {
      eventType: string;
      lifecycleStageTo: string | null;
    }

    const eventDescriptors: EventDescriptor[] = [];
    const seenEventTypes = new Set<string>();

    const statusEvent = this.mapStatusTransitionToEventType(input.oldStatus, input.newStatus);
    if (statusEvent && !seenEventTypes.has(statusEvent)) {
      seenEventTypes.add(statusEvent);
      eventDescriptors.push({
        eventType: statusEvent,
        lifecycleStageTo: input.newLifecycleStage || null,
      });
    }

    const lifecycleChanged = input.newLifecycleStage !== input.oldLifecycleStage;

    if (lifecycleChanged) {
      if (isBackwardTransition(input.oldLifecycleStage, input.newLifecycleStage)) {
        logger.warn('Backward lifecycle transition detected, skipping lifecycle events', {
          projectId: input.projectId,
          from: input.oldLifecycleStage,
          to: input.newLifecycleStage,
        });
      } else {
        // Fire events for intermediate stages that were skipped
        const intermediateStages = getIntermediateStages(
          input.oldLifecycleStage,
          input.newLifecycleStage
        );
        for (const stage of intermediateStages) {
          const intermediateEvent = this.mapLifecycleStageToEventType(stage);
          if (intermediateEvent && !seenEventTypes.has(intermediateEvent)) {
            seenEventTypes.add(intermediateEvent);
            eventDescriptors.push({
              eventType: intermediateEvent,
              lifecycleStageTo: stage,
            });
          }
        }

        // Fire event for the target stage
        const lifecycleEvent = this.mapLifecycleStageToEventType(input.newLifecycleStage);
        if (lifecycleEvent && !seenEventTypes.has(lifecycleEvent)) {
          seenEventTypes.add(lifecycleEvent);
          eventDescriptors.push({
            eventType: lifecycleEvent,
            lifecycleStageTo: input.newLifecycleStage || null,
          });
        }
      }
    }

    if (eventDescriptors.length === 0) {
      return { eventsCreated: 0, triggersCreated: 0, eventIds: [] };
    }

    let eventsCreated = 0;
    let triggersCreated = 0;
    const eventIds: number[] = [];

    for (const descriptor of eventDescriptors) {
      const created = await this.createProjectEvent({
        projectId: input.projectId,
        eventType: descriptor.eventType,
        source: 'system_transition',
        createdBy: input.userId,
        statusFrom: input.oldStatus || null,
        statusTo: input.newStatus || null,
        lifecycleStageFrom: input.oldLifecycleStage || null,
        lifecycleStageTo: descriptor.lifecycleStageTo,
        payload: {
          oldStatus: input.oldStatus || null,
          newStatus: input.newStatus || null,
          oldLifecycleStage: input.oldLifecycleStage || null,
          newLifecycleStage: input.newLifecycleStage || null,
          eventLifecycleStage: descriptor.lifecycleStageTo,
        },
        processTriggers: true,
      });

      eventsCreated += 1;
      triggersCreated += created.triggersCreated;
      eventIds.push(created.event.id);
    }

    return { eventsCreated, triggersCreated, eventIds };
  }

  static async createProjectEvent(input: CreateProjectEventInput): Promise<{
    event: any;
    triggersCreated: number;
    triggerIds: number[];
  }> {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true },
    });

    if (!project) {
      throw new Error(`Project ${input.projectId} not found`);
    }

    const created = await (prisma as any).project_event.create({
      data: {
        project_id: input.projectId,
        event_type: input.eventType,
        event_key: input.eventKey || null,
        occurred_at: input.occurredAt || new Date(),
        source: input.source || 'manual',
        payload: input.payload || null,
        created_by: input.createdBy || null,
        status_from: input.statusFrom || null,
        status_to: input.statusTo || null,
        lifecycle_stage_from: input.lifecycleStageFrom || null,
        lifecycle_stage_to: input.lifecycleStageTo || null,
      },
    });

    if (input.processTriggers === false) {
      return {
        event: created,
        triggersCreated: 0,
        triggerIds: [],
      };
    }

    const processed = await this.processProjectEvent(created.id);
    return {
      event: created,
      triggersCreated: processed.triggersCreated,
      triggerIds: processed.triggerIds,
    };
  }

  static async getProjectEvents(
    projectId: number,
    filters?: { eventType?: string; limit?: number }
  ): Promise<any[]> {
    const where: Record<string, unknown> = { project_id: projectId };
    if (filters?.eventType) {
      where.event_type = filters.eventType;
    }

    const limit = Math.min(Math.max(filters?.limit || 50, 1), 500);
    return (prisma as any).project_event.findMany({
      where,
      orderBy: { occurred_at: 'desc' },
      take: limit,
    });
  }

  static inferRuleFromMilestone(triggerText: string | null, title: string | null): InferredTriggerRule {
    const combinedText = `${triggerText || ''} ${title || ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!combinedText) {
      return {
        trigger_mode: 'manual',
        anchor_event_type: null,
        requires_invoice_issued: false,
        requires_payment_received: false,
        due_in_business_days: null,
        fallback_due_date: null,
        recurrence: 'none',
        auto_confirm: false,
        manual_confirm_required: true,
        condition_json: { reason: 'No trigger text/title found' },
        confidence: 0.2,
        reason: 'No trigger text/title found',
      };
    }

    const anchor = EVENT_ANCHORS.find((candidate) => candidate.patterns.some((pattern) => pattern.test(combinedText)));
    const requiresInvoice = /收到账单|invoice|发票|bill/.test(combinedText);
    const requiresPayment = /付款|支付|payment received|collection|paid/.test(combinedText);
    const recurrence: 'none' | 'annual' | 'semiannual' = /续期|anniversary|renewal|each year|每年/.test(combinedText)
      ? 'annual'
      : /6个月|semi-annual|semi annual|second phase|第二期/.test(combinedText)
        ? 'semiannual'
        : 'none';

    const dueInBusinessDays = this.extractDueInBusinessDays(combinedText);
    const fallbackDueDate = this.extractFallbackDate(combinedText);

    if (anchor) {
      return {
        trigger_mode: 'common',
        anchor_event_type: anchor.eventType,
        requires_invoice_issued: requiresInvoice,
        requires_payment_received: requiresPayment,
        due_in_business_days: dueInBusinessDays,
        fallback_due_date: fallbackDueDate,
        recurrence,
        auto_confirm: false,
        manual_confirm_required: true,
        condition_json: {
          eventTypes: [anchor.eventType],
          requiresInvoiceIssued: requiresInvoice,
          requiresPaymentReceived: requiresPayment,
          recurrence,
        },
        confidence: anchor.confidence,
        reason: `Matched anchor event: ${anchor.eventType}`,
      };
    }

    return {
      trigger_mode: 'bespoke',
      anchor_event_type: null,
      requires_invoice_issued: requiresInvoice,
      requires_payment_received: requiresPayment,
      due_in_business_days: dueInBusinessDays,
      fallback_due_date: fallbackDueDate,
      recurrence,
      auto_confirm: false,
      manual_confirm_required: true,
      condition_json: {
        freeText: triggerText || null,
        title: title || null,
        requiresInvoiceIssued: requiresInvoice,
        requiresPaymentReceived: requiresPayment,
        recurrence,
      },
      confidence: 0.65,
      reason: 'No canonical event anchor matched; classified as bespoke',
    };
  }

  static async backfillMilestoneTriggerRules(options?: {
    dryRun?: boolean;
    onlyMissing?: boolean;
    includeCompleted?: boolean;
    limit?: number;
  }): Promise<{
    total: number;
    processed: number;
    created: number;
    updated: number;
    byMode: Record<string, number>;
  }> {
    const milestones = await prisma.billing_milestone.findMany({
      where: options?.includeCompleted === false ? { completed: false } : undefined,
      orderBy: { milestone_id: 'asc' },
      ...(options?.limit ? { take: options.limit } : {}),
      select: {
        milestone_id: true,
        trigger_text: true,
        title: true,
      },
    });

    let created = 0;
    let updated = 0;
    const byMode: Record<string, number> = {};

    for (const milestone of milestones) {
      const inferred = this.inferRuleFromMilestone(milestone.trigger_text, milestone.title);
      byMode[inferred.trigger_mode] = (byMode[inferred.trigger_mode] || 0) + 1;

      if (options?.dryRun) {
        continue;
      }

      const existing = await (prisma as any).billing_milestone_trigger_rule.findFirst({
        where: { milestone_id: milestone.milestone_id },
      });

      if (existing && options?.onlyMissing) {
        continue;
      }

      const payload = {
        milestone_id: milestone.milestone_id,
        trigger_mode: inferred.trigger_mode,
        anchor_event_type: inferred.anchor_event_type,
        requires_invoice_issued: inferred.requires_invoice_issued,
        requires_payment_received: inferred.requires_payment_received,
        due_in_business_days: inferred.due_in_business_days,
        fallback_due_date: inferred.fallback_due_date,
        recurrence: inferred.recurrence,
        auto_confirm: inferred.auto_confirm,
        manual_confirm_required: inferred.manual_confirm_required,
        condition_json: inferred.condition_json || undefined,
        confidence: new Decimal(inferred.confidence.toFixed(2)),
        updated_at: new Date(),
      };

      if (existing) {
        await (prisma as any).billing_milestone_trigger_rule.update({
          where: { id: existing.id },
          data: payload,
        });
        updated += 1;
      } else {
        await (prisma as any).billing_milestone_trigger_rule.create({
          data: {
            ...payload,
            created_at: new Date(),
          },
        });
        created += 1;
      }
    }

    return {
      total: milestones.length,
      processed: options?.dryRun ? milestones.length : created + updated,
      created,
      updated,
      byMode,
    };
  }

  private static async processProjectEvent(eventId: number): Promise<{ triggersCreated: number; triggerIds: number[] }> {
    const event = await (prisma as any).project_event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return { triggersCreated: 0, triggerIds: [] };
    }

    const project = await prisma.project.findUnique({
      where: { id: event.project_id },
      select: { id: true, name: true, cmNumber: true },
    });

    if (!project?.cmNumber) {
      return { triggersCreated: 0, triggerIds: [] };
    }

    const cmNo = await prisma.billing_project_cm_no.findFirst({
      where: { cm_no: project.cmNumber },
      include: {
        billing_project: {
          include: {
            billing_engagement: {
              where: { end_date: null },
              include: {
                billing_milestone: {
                  where: { completed: false },
                  orderBy: { sort_order: 'asc' },
                  include: {
                    billing_milestone_trigger_rule: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cmNo) {
      return { triggersCreated: 0, triggerIds: [] };
    }

    const triggerIds: number[] = [];

    for (const engagement of cmNo.billing_project.billing_engagement) {
      for (const milestone of engagement.billing_milestone) {
        const matched = this.matchMilestoneForEvent(milestone, event);
        if (!matched.matched) {
          continue;
        }

        const createdTrigger = await this.createPendingTriggerFromEvent({
          milestone_id: milestone.milestone_id,
          staffing_project_id: project.id,
          old_status: event.status_from || event.lifecycle_stage_from || 'N/A',
          new_status: event.status_to || event.lifecycle_stage_to || 'N/A',
          event_type: event.event_type,
          match_confidence: matched.confidence,
          trigger_reason: matched.reason,
          project_event_id: event.id,
          rule_id: matched.ruleId,
          match_method: matched.matchMethod,
        });

        if (createdTrigger) {
          triggerIds.push(createdTrigger.id);
        }
      }
    }

    if (triggerIds.length > 0) {
      logger.info('Project event created milestone triggers', {
        eventId,
        projectId: project.id,
        triggersCreated: triggerIds.length,
      });
    }

    return { triggersCreated: triggerIds.length, triggerIds };
  }

  private static matchMilestoneForEvent(milestone: any, event: any): RuleMatchResult {
    const rules: any[] = milestone.billing_milestone_trigger_rule || [];
    if (rules.length === 0) {
      return this.evaluateLegacyTextRule(milestone, event, null);
    }

    let bestMatch: RuleMatchResult = {
      matched: false,
      confidence: 0,
      reason: 'No matching rules',
      ruleId: null,
      matchMethod: 'none',
    };

    for (const rule of rules) {
      const mode = (rule.trigger_mode || 'manual').toLowerCase();
      let current: RuleMatchResult = {
        matched: false,
        confidence: 0,
        reason: `Rule ${rule.id} did not match`,
        ruleId: rule.id,
        matchMethod: `${mode}_rule`,
      };

      if (mode === 'manual') {
        continue;
      }

      if (!this.prerequisitesPass(rule, milestone)) {
        continue;
      }

      if (mode === 'common') {
        if (!rule.anchor_event_type || rule.anchor_event_type !== event.event_type) {
          continue;
        }
        if (!this.matchesConditionJson(rule.condition_json, event)) {
          continue;
        }
        current = {
          matched: true,
          confidence: Number(rule.confidence?.toString?.() || '0.9'),
          reason: `Common rule matched event ${event.event_type}`,
          ruleId: rule.id,
          matchMethod: 'common_rule',
        };
      } else if (mode === 'bespoke') {
        const anchorOk = !rule.anchor_event_type || rule.anchor_event_type === event.event_type;
        if (!anchorOk || !this.matchesConditionJson(rule.condition_json, event)) {
          continue;
        }
        current = {
          matched: true,
          confidence: Number(rule.confidence?.toString?.() || '0.7'),
          reason: `Bespoke rule matched event ${event.event_type}`,
          ruleId: rule.id,
          matchMethod: 'bespoke_rule',
        };
      } else if (mode === 'legacy_text') {
        current = this.evaluateLegacyTextRule(milestone, event, rule.id);
      }

      if (current.matched && current.confidence > bestMatch.confidence) {
        bestMatch = current;
      }
    }

    return bestMatch;
  }

  private static evaluateLegacyTextRule(milestone: any, event: any, ruleId: number | null): RuleMatchResult {
    const statusHint = this.mapEventTypeToLegacyStatus(event.event_type, event.status_to);
    if (!statusHint) {
      return {
        matched: false,
        confidence: 0,
        reason: 'Legacy status hint not available for event',
        ruleId,
        matchMethod: 'legacy_text',
      };
    }

    const evaluation = this.evaluateLegacyTriggerText(milestone.trigger_text, statusHint);
    if (!evaluation.matched) {
      return {
        matched: false,
        confidence: 0,
        reason: evaluation.reason,
        ruleId,
        matchMethod: 'legacy_text',
      };
    }

    return {
      matched: true,
      confidence: evaluation.confidence,
      reason: `Legacy text matched (${statusHint}): ${evaluation.reason}`,
      ruleId,
      matchMethod: 'legacy_text',
    };
  }

  private static prerequisitesPass(rule: any, milestone: any): boolean {
    if (rule.requires_invoice_issued && !milestone.invoice_sent_date) {
      return false;
    }
    if (rule.requires_payment_received && !milestone.payment_received_date) {
      return false;
    }
    return true;
  }

  private static matchesConditionJson(condition: unknown, event: any): boolean {
    if (!condition || typeof condition !== 'object') {
      return true;
    }

    const obj = condition as Record<string, unknown>;

    const allOf = this.toObjectArray(obj.allOf);
    if (allOf.length > 0 && !allOf.every((item) => this.matchesConditionJson(item, event))) {
      return false;
    }

    const anyOf = this.toObjectArray(obj.anyOf);
    if (anyOf.length > 0 && !anyOf.some((item) => this.matchesConditionJson(item, event))) {
      return false;
    }

    const eventTypes = this.toStringArray(obj.eventTypes);
    if (eventTypes.length > 0 && !eventTypes.includes(String(event.event_type))) {
      return false;
    }

    const statusToIn = this.toStringArray(obj.statusToIn);
    if (statusToIn.length > 0 && !statusToIn.includes(String(event.status_to || ''))) {
      return false;
    }

    if (typeof obj.statusTo === 'string' && obj.statusTo !== String(event.status_to || '')) {
      return false;
    }

    const lifecycleStageToIn = this.toStringArray(obj.lifecycleStageToIn);
    if (lifecycleStageToIn.length > 0 && !lifecycleStageToIn.includes(String(event.lifecycle_stage_to || ''))) {
      return false;
    }

    if (typeof obj.lifecycleStageTo === 'string' && obj.lifecycleStageTo !== String(event.lifecycle_stage_to || '')) {
      return false;
    }

    return true;
  }

  private static toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private static toObjectArray(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
  }

  private static evaluateLegacyTriggerText(triggerText: string | null, status: string): {
    matched: boolean;
    confidence: number;
    reason: string;
  } {
    if (!triggerText) {
      return { matched: false, confidence: 0, reason: 'No trigger text' };
    }

    const text = triggerText.toLowerCase();
    const keywords = STATUS_TRIGGER_KEYWORDS[status] || [];

    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return {
          matched: true,
          confidence: 0.8,
          reason: `Keyword "${keyword}" matched`,
        };
      }
    }

    return { matched: false, confidence: 0, reason: 'No keyword match' };
  }

  private static mapEventTypeToLegacyStatus(eventType: string, statusTo?: string | null): string | null {
    if (statusTo && statusTo.trim()) {
      return statusTo;
    }

    switch (eventType) {
      case CanonicalProjectEventType.PROJECT_CLOSED:
      case CanonicalProjectEventType.LISTING_COMPLETED:
        return 'Closed';
      case CanonicalProjectEventType.PROJECT_TERMINATED:
        return 'Terminated';
      case CanonicalProjectEventType.PROJECT_PAUSED:
        return 'Suspended';
      case CanonicalProjectEventType.PROJECT_RESUMED:
        return 'Active';
      default:
        return null;
    }
  }

  private static async createPendingTriggerFromEvent(data: PendingTriggerFromEventData): Promise<any> {
    try {
      const existing = await (prisma as any).billing_milestone_trigger_queue.findFirst({
        where: {
          milestone_id: data.milestone_id,
          project_event_id: data.project_event_id,
        },
      });

      if (existing) {
        return null;
      }

      return await (prisma as any).billing_milestone_trigger_queue.create({
        data: {
          milestone_id: data.milestone_id,
          staffing_project_id: data.staffing_project_id,
          old_status: data.old_status,
          new_status: data.new_status,
          event_type: data.event_type,
          match_confidence: new Decimal(data.match_confidence.toString()),
          trigger_reason: data.trigger_reason,
          project_event_id: data.project_event_id,
          rule_id: data.rule_id || null,
          match_method: data.match_method,
          status: 'pending',
        },
      });
    } catch (error) {
      if ((error as any)?.code === 'P2002') {
        return null;
      }
      logger.error('Error creating pending trigger from event', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private static mapStatusTransitionToEventType(
    oldStatus?: string | null,
    newStatus?: string | null
  ): CanonicalProjectEventType | null {
    if (!newStatus || newStatus === oldStatus) {
      return null;
    }

    if (newStatus === 'Closed') {
      return CanonicalProjectEventType.PROJECT_CLOSED;
    }
    if (newStatus === 'Terminated') {
      return CanonicalProjectEventType.PROJECT_TERMINATED;
    }
    if (PAUSED_STATUSES.has(newStatus)) {
      return CanonicalProjectEventType.PROJECT_PAUSED;
    }
    if (oldStatus && PAUSED_STATUSES.has(oldStatus) && newStatus === 'Active') {
      return CanonicalProjectEventType.PROJECT_RESUMED;
    }

    return null;
  }

  private static mapLifecycleStageToEventType(stage?: string | null): CanonicalProjectEventType | null {
    if (!stage) {
      return null;
    }

    switch (stage.toLowerCase()) {
      case 'signed':
      case 'new_engagement':
        return CanonicalProjectEventType.EL_SIGNED;
      case 'kickoff':
        return CanonicalProjectEventType.PROJECT_KICKOFF;
      case 'confidential_filed':
        return CanonicalProjectEventType.CONFIDENTIAL_FILING_SUBMITTED;
      case 'a1_filed':
        return CanonicalProjectEventType.A1_SUBMITTED;
      case 'hearing_passed':
        return CanonicalProjectEventType.HEARING_PASSED;
      case 'listed':
        return CanonicalProjectEventType.LISTING_COMPLETED;
      case 'renewal_cycle':
        return CanonicalProjectEventType.RENEWAL_CYCLE_STARTED;
      default:
        return null;
    }
  }

  private static extractDueInBusinessDays(text: string): number | null {
    const english = text.match(/within\s+(\d+)\s+(?:business\s+)?days?/i);
    if (english) {
      return Number.parseInt(english[1], 10);
    }

    const chinese = text.match(/(\d+)\s*个?(?:工作)?日内/);
    if (chinese) {
      return Number.parseInt(chinese[1], 10);
    }

    return null;
  }

  private static extractFallbackDate(text: string): Date | null {
    const ymd = text.match(/\b(20\d{2})[/-](\d{1,2})[/-](\d{1,2})\b/);
    if (ymd) {
      const date = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const monthDate = text.match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(20\d{2})\b/i
    );
    if (monthDate) {
      const parsed = new Date(`${monthDate[1]} ${monthDate[2]}, ${monthDate[3]}`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }
}
