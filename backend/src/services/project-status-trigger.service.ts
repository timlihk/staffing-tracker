import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';

// Status to trigger keyword mappings
const STATUS_TRIGGER_KEYWORDS: Record<string, string[]> = {
  'Closed': ['close', 'completion', 'final', 'complete', 'done', 'finished'],
  'Terminated': ['terminat', 'cancel', 'termination', 'cancellation'],
  'Suspended': ['suspend', 'halt', 'pause'],
  'Slow-down': ['slow', 'delay', 'defer'],
  'On Hold': ['hold', 'wait', 'on'],
};

// Confidence threshold for auto-creating triggers
const HIGH_CONFIDENCE_THRESHOLD = 0.8;
const LOW_CONFIDENCE_THRESHOLD = 0.5;

interface TriggerMatchResult {
  milestoneId: bigint;
  triggerText: string;
  confidence: number;
  reason: string;
}

interface PendingTriggerData {
  milestone_id: bigint;
  staffing_project_id: number;
  old_status: string;
  new_status: string;
  match_confidence: number;
  trigger_reason: string;
}

export class ProjectStatusTriggerService {
  /**
   * Process a status change for a project and create pending triggers if matching milestones found
   */
  static async processStatusChange(
    projectId: number,
    oldStatus: string,
    newStatus: string
  ): Promise<{ triggersCreated: number; triggers: PendingTriggerData[] }> {
    // Check if trigger system is enabled
    const settings = await prisma.appSettings.findFirst();
    if (!settings?.billingTriggerEnabled) {
      logger.info('Billing trigger system is disabled');
      return { triggersCreated: 0, triggers: [] };
    }

    // Get the project with its cmNumber
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, cmNumber: true, status: true },
    });

    if (!project) {
      logger.warn(`Project ${projectId} not found`);
      return { triggersCreated: 0, triggers: [] };
    }

    // Skip if no cmNumber linked
    if (!project.cmNumber) {
      logger.debug(`Project ${projectId} has no linked cmNumber, skipping trigger check`);
      return { triggersCreated: 0, triggers: [] };
    }

    // Find matching milestones
    const matchingMilestones = await this.findMatchingMilestones(project.cmNumber, newStatus);

    if (matchingMilestones.length === 0) {
      logger.debug(`No matching milestones found for cmNumber ${project.cmNumber} and status ${newStatus}`);
      return { triggersCreated: 0, triggers: [] };
    }

    // Create pending triggers
    const triggers: PendingTriggerData[] = [];
    for (const match of matchingMilestones) {
      if (match.confidence >= LOW_CONFIDENCE_THRESHOLD) {
        const triggerData = {
          milestone_id: match.milestoneId,
          staffing_project_id: projectId,
          old_status: oldStatus,
          new_status: newStatus,
          match_confidence: match.confidence,
          trigger_reason: match.reason,
        };
        const createdTrigger = await this.createPendingTrigger(triggerData);
        if (createdTrigger) {
          triggers.push({
            milestone_id: createdTrigger.milestone_id,
            staffing_project_id: createdTrigger.staffing_project_id,
            old_status: createdTrigger.old_status,
            new_status: createdTrigger.new_status,
            match_confidence: parseFloat(createdTrigger.match_confidence.toString()),
            trigger_reason: createdTrigger.trigger_reason || '',
          });
        }
      } else {
        logger.info(`Milestone ${match.milestoneId} below confidence threshold (${match.confidence}), skipping`);
      }
    }

    return { triggersCreated: triggers.length, triggers };
  }

  /**
   * Find billing project by cmNumber
   */
  static async findLinkedBillingProject(cmNumber: string) {
    const cmNo = await prisma.billing_project_cm_no.findFirst({
      where: {
        cm_no: cmNumber,
        status: { not: 'closed' },
      },
      include: {
        billing_project: {
          include: {
            billing_engagement: {
              include: {
                billing_milestone: {
                  where: { completed: false },
                },
              },
            },
          },
        },
      },
    });

    return cmNo;
  }

  /**
   * Find milestones that might be triggered by the new status
   */
  static async findMatchingMilestones(
    cmNumber: string,
    newStatus: string
  ): Promise<TriggerMatchResult[]> {
    // Get all incomplete milestones for this cmNumber
    const cmNo = await prisma.billing_project_cm_no.findFirst({
      where: { cm_no: cmNumber },
      include: {
        billing_project: {
          include: {
            billing_engagement: {
              where: { end_date: null }, // Only active engagements
              include: {
                billing_milestone: {
                  where: { completed: false },
                  orderBy: { sort_order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!cmNo) {
      return [];
    }

    const results: TriggerMatchResult[] = [];

    for (const engagement of cmNo.billing_project.billing_engagement) {
      for (const milestone of engagement.billing_milestone) {
        const evaluation = this.evaluateTrigger(milestone.trigger_text, newStatus);
        if (evaluation.confidence > 0) {
          results.push({
            milestoneId: milestone.milestone_id,
            triggerText: milestone.trigger_text || '',
            confidence: evaluation.confidence,
            reason: evaluation.reason,
          });
        }
      }
    }

    return results;
  }

  /**
   * Evaluate if a milestone's trigger_text matches the new status
   * Uses keyword matching first, then falls back to simple pattern matching
   */
  static evaluateTrigger(
    triggerText: string | null,
    newStatus: string
  ): { confidence: number; reason: string } {
    if (!triggerText) {
      return { confidence: 0, reason: 'No trigger text defined' };
    }

    const text = triggerText.toLowerCase();
    const status = newStatus.toLowerCase();

    // Get keywords for the new status
    const keywords = STATUS_TRIGGER_KEYWORDS[newStatus] || [];

    // Step 1: Keyword-based matching
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return {
          confidence: HIGH_CONFIDENCE_THRESHOLD,
          reason: `Keyword match: "${keyword}" found in trigger text`,
        };
      }
    }

    // Step 2: Status name direct match in trigger text
    if (text.includes(status)) {
      return {
        confidence: 0.9,
        reason: `Status "${newStatus}" found in trigger text`,
      };
    }

    // Step 3: Pattern-based matching for common status changes
    const statusPatterns: Record<string, RegExp[]> = {
      'Closed': [/final/i, /complete/i, /done/i, /finish/i, /close/i],
      'Terminated': [/cancel/i, /terminat/i],
      'Suspended': [/suspend/i, /halt/i],
      'Slow-down': [/slow/i, /delay/i, /defer/i],
      'On Hold': [/hold/i, /wait/i],
    };

    const patterns = statusPatterns[newStatus] || [];
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return {
          confidence: 0.85,
          reason: `Pattern match: ${pattern.source} matches trigger text`,
        };
      }
    }

    // Step 4: Check for "Upon" triggers that might be event-based
    if (text.startsWith('upon ') || text.startsWith('on ')) {
      // Event-based milestones might be triggered by status changes
      const eventKeywords = ['completion', 'closing', 'termination', 'suspension'];
      for (const kw of eventKeywords) {
        if (text.includes(kw)) {
          return {
            confidence: 0.6,
            reason: `Event-based milestone likely triggered by ${newStatus}`,
          };
        }
      }
    }

    return { confidence: 0, reason: 'No matching trigger found' };
  }

  /**
   * Create a pending trigger record
   */
  static async createPendingTrigger(data: PendingTriggerData): Promise<any> {
    try {
      // Check for existing pending trigger for same milestone and status change
      const existing = await (prisma as any).billing_milestone_trigger_queue.findFirst({
        where: {
          milestone_id: data.milestone_id,
          new_status: data.new_status,
          status: 'pending',
        },
      });

      if (existing) {
        logger.info(`Pending trigger already exists for milestone ${data.milestone_id}, status ${data.new_status}`);
        return null;
      }

      const trigger = await (prisma as any).billing_milestone_trigger_queue.create({
        data: {
          milestone_id: data.milestone_id,
          staffing_project_id: data.staffing_project_id,
          old_status: data.old_status,
          new_status: data.new_status,
          match_confidence: new Decimal(data.match_confidence.toString()),
          trigger_reason: data.trigger_reason,
          status: 'pending',
        },
      });

      logger.info(`Created pending trigger ${trigger.id} for milestone ${data.milestone_id}`);
      return trigger;
    } catch (error) {
      // Expected when concurrent requests try to insert the same pending trigger.
      if ((error as any)?.code === 'P2002') {
        logger.info(`Duplicate pending trigger prevented by unique constraint for milestone ${data.milestone_id}, status ${data.new_status}`);
        return null;
      }
      logger.error('Error creating pending trigger:', error as any);
      return null;
    }
  }

  /**
   * Get all pending triggers
   */
  static async getPendingTriggers(): Promise<any[]> {
    return (prisma as any).billing_milestone_trigger_queue.findMany({
      where: { status: 'pending' },
      orderBy: { created_at: 'desc' },
      include: {
        milestone: {
          include: {
            billing_engagement: {
              include: {
                billing_project_cm_no: {
                  include: {
                    billing_project: true,
                  },
                },
              },
            },
          },
        },
        project: true,
      },
    });
  }

  /**
   * Get all triggers with optional filters
   */
  static async getTriggers(filters?: {
    status?: string;
    staffingProjectId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.staffingProjectId) {
      where.staffing_project_id = filters.staffingProjectId;
    }
    if (filters?.startDate || filters?.endDate) {
      where.created_at = {};
      if (filters?.startDate) where.created_at.gte = filters.startDate;
      if (filters?.endDate) where.created_at.lte = filters.endDate;
    }

    return (prisma as any).billing_milestone_trigger_queue.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        milestone: {
          include: {
            billing_engagement: {
              include: {
                billing_project_cm_no: {
                  include: {
                    billing_project: true,
                  },
                },
              },
            },
          },
        },
        project: true,
      },
    });
  }

  /**
   * Confirm a trigger - marks milestone as complete and creates action item
   */
  static async confirmTrigger(triggerId: number, userId: number): Promise<any> {
    return prisma.$transaction(async (tx: any) => {
      // Get the trigger
      const trigger = await tx.billing_milestone_trigger_queue.findUnique({
        where: { id: triggerId },
      });

      if (!trigger) {
        throw new Error('Trigger not found');
      }

      if (trigger.status !== 'pending') {
        throw new Error('Trigger is not pending');
      }

      // Determine action type based on new status
      const actionType = this.getActionTypeForStatus(trigger.new_status);

      // Update the trigger
      const updatedTrigger = await tx.billing_milestone_trigger_queue.update({
        where: { id: triggerId },
        data: {
          status: 'confirmed',
          confirmed_by: userId,
          confirmed_at: new Date(),
          action_taken: actionType,
        },
      });

      // Mark milestone as complete
      await tx.billing_milestone.update({
        where: { milestone_id: trigger.milestone_id },
        data: {
          completed: true,
          completion_date: new Date(),
          completion_source: 'trigger_confirmed',
        },
      });

      // Create action item
      await tx.billing_action_item.create({
        data: {
          trigger_queue_id: triggerId,
          milestone_id: trigger.milestone_id,
          action_type: actionType,
          description: `Action required: ${this.getActionDescription(actionType)} for milestone`,
          due_date: this.calculateDueDate(actionType),
          status: 'pending',
        },
      });

      logger.info(`Confirmed trigger ${triggerId}, milestone ${trigger.milestone_id} marked complete`);

      return updatedTrigger;
    });
  }

  /**
   * Reject a trigger
   */
  static async rejectTrigger(triggerId: number, userId: number): Promise<any> {
    return prisma.$transaction(async (tx: any) => {
      const trigger = await tx.billing_milestone_trigger_queue.findUnique({
        where: { id: triggerId },
      });

      if (!trigger) {
        throw new Error('Trigger not found');
      }

      if (trigger.status !== 'pending') {
        throw new Error('Trigger is not pending');
      }

      const updatedTrigger = await tx.billing_milestone_trigger_queue.update({
        where: { id: triggerId },
        data: {
          status: 'rejected',
          confirmed_by: userId,
          confirmed_at: new Date(),
        },
      });

      logger.info(`Rejected trigger ${triggerId}`);

      return updatedTrigger;
    });
  }

  /**
   * Get action type based on project status
   */
  private static getActionTypeForStatus(status: string): string {
    const actionMap: Record<string, string> = {
      'Closed': 'issue_invoice',
      'Terminated': 'follow_up_payment',
      'Suspended': 'pause_billing',
      'Slow-down': 'adjust_billing_schedule',
      'On Hold': 'review_billing_agreement',
    };

    return actionMap[status] || 'general_followup';
  }

  /**
   * Get action description
   */
  private static getActionDescription(actionType: string): string {
    const descriptions: Record<string, string> = {
      'issue_invoice': 'Issue final invoice',
      'follow_up_payment': 'Follow up outstanding payment',
      'pause_billing': 'Pause billing schedule',
      'adjust_billing_schedule': 'Adjust billing schedule',
      'review_billing_agreement': 'Review billing agreement',
      'general_followup': 'General follow-up',
    };

    return descriptions[actionType] || 'Review and take action';
  }

  /**
   * Calculate due date for action item based on action type
   */
  private static calculateDueDate(actionType: string): Date {
    const dueInDays: Record<string, number> = {
      'issue_invoice': 7,
      'follow_up_payment': 14,
      'pause_billing': 3,
      'adjust_billing_schedule': 7,
      'review_billing_agreement': 5,
      'general_followup': 7,
    };

    const days = dueInDays[actionType] || 7;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }

  /**
   * Get overdue billing by attorney
   */
  static async getOverdueByAttorney(filters?: {
    attorneyId?: number;
    minAmount?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    // Build WHERE clause dynamically
    const conditions: string[] = ['m.completed = false', 'm.due_date < NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.attorneyId) {
      conditions.push(`s.id = $${paramIndex++}`);
      params.push(filters.attorneyId);
    }

    if (filters?.minAmount) {
      conditions.push(`m.amount_value >= $${paramIndex++}`);
      params.push(filters.minAmount);
    }

    if (filters?.startDate) {
      conditions.push(`m.due_date >= $${paramIndex++}`);
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      conditions.push(`m.due_date <= $${paramIndex++}`);
      params.push(filters.endDate);
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    const query = `
      SELECT
        s.id AS staff_id,
        s.name AS attorney_name,
        s.position AS attorney_position,
        COUNT(DISTINCT m.milestone_id) AS overdue_milestones,
        SUM(m.amount_value::numeric) AS overdue_amount,
        MIN(m.due_date) AS next_due_date,
        bp.project_id AS billing_project_id,
        bp.project_name,
        p.id AS staffing_project_id,
        p.name AS staffing_project_name,
        p.status AS staffing_project_status,
        m.milestone_id,
        m.title AS milestone_title,
        m.amount_value AS milestone_amount,
        m.due_date AS milestone_due_date
      FROM billing_milestone m
      JOIN billing_engagement e ON m.engagement_id = e.engagement_id
      JOIN billing_project_cm_no cm ON e.cm_id = cm.cm_id
      JOIN billing_project bp ON cm.project_id = bp.project_id
      JOIN billing_project_bc_attorneys bpa ON bp.project_id = bpa.billing_project_id
      JOIN staff s ON bpa.staff_id = s.id
      LEFT JOIN billing_staffing_project_link bspl ON bp.project_id = bspl.billing_project_id
      LEFT JOIN projects p ON bspl.staffing_project_id = p.id
      ${whereClause}
      GROUP BY s.id, s.name, s.position, bp.project_id, bp.project_name, p.id, p.name, p.status, m.milestone_id, m.title, m.amount_value, m.due_date
      ORDER BY overdue_amount DESC
    `;

    const result = await prisma.$queryRawUnsafe(query, ...params);
    return result;
  }
}
