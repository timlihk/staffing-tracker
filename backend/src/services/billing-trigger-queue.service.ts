import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

// Action types that semantically mean the milestone is complete
const COMPLETION_ACTION_TYPES = new Set(['issue_invoice', 'follow_up_payment']);

interface TriggerActionItemUpdate {
  actionType?: string;
  description?: string;
  dueDate?: string | null;
  status?: 'pending' | 'completed' | 'cancelled';
  assignedTo?: number | null;
}

export class BillingTriggerQueueService {
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
        billing_action_item: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                position: true,
              },
            },
          },
        },
      },
    });
  }

  static async getTriggers(filters?: {
    status?: string;
    staffingProjectId?: number;
    attorneyId?: number;
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

    const triggers = await (prisma as any).billing_milestone_trigger_queue.findMany({
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
        billing_action_item: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                position: true,
              },
            },
          },
        },
      },
    });

    if (filters?.attorneyId === undefined || filters.attorneyId === null) {
      return triggers;
    }

    const attorneyProjectRows = await (prisma as any).billing_project_bc_attorney.findMany({
      where: {
        staff_id: filters.attorneyId,
      },
      select: {
        billing_project_id: true,
      },
    });

    const allowedProjectIds = new Set(
      attorneyProjectRows
        .map((row: { billing_project_id: bigint | number | string | null }) =>
          row.billing_project_id === null || row.billing_project_id === undefined
            ? NaN
            : Number(row.billing_project_id)
        )
        .filter((value: number) => Number.isFinite(value))
    );

    if (allowedProjectIds.size === 0) {
      return [];
    }

    return triggers.filter((trigger: any) => {
      const projectId = Number(
        trigger?.milestone?.billing_engagement?.billing_project_cm_no?.billing_project?.project_id
      );
      return Number.isFinite(projectId) && allowedProjectIds.has(projectId);
    });
  }

  static async confirmTrigger(triggerId: number, userId: number): Promise<any> {
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

      const actionType = this.getActionTypeForStatus(
        trigger.event_type || trigger.new_status
      );

      const updatedTrigger = await tx.billing_milestone_trigger_queue.update({
        where: { id: triggerId },
        data: {
          status: 'confirmed',
          confirmed_by: userId,
          confirmed_at: new Date(),
          action_taken: actionType,
        },
      });

      // Only mark milestone as complete for completion-type actions
      if (COMPLETION_ACTION_TYPES.has(actionType)) {
        const milestone = await tx.billing_milestone.findUnique({
          where: { milestone_id: trigger.milestone_id },
          select: { completed: true },
        });

        if (!milestone?.completed) {
          await tx.billing_milestone.update({
            where: { milestone_id: trigger.milestone_id },
            data: {
              completed: true,
              completion_date: new Date(),
              completion_source: 'trigger_confirmed',
            },
          });
        }
      }

      // Create/update the consequence action item for this trigger
      const existingActionItem = await tx.billing_action_item.findFirst({
        where: { trigger_queue_id: triggerId },
        orderBy: { created_at: 'desc' },
      });

      if (existingActionItem) {
        await tx.billing_action_item.update({
          where: { id: existingActionItem.id },
          data: {
            action_type: existingActionItem.action_type || actionType,
            description: existingActionItem.description || `Action required: ${this.getActionDescription(actionType)} for milestone`,
            due_date: existingActionItem.due_date ?? this.calculateDueDate(actionType),
            status: existingActionItem.status || 'pending',
          },
        });
      } else {
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
      }

      const completionNote = COMPLETION_ACTION_TYPES.has(actionType)
        ? 'milestone marked complete'
        : 'milestone not marked complete (non-completion action)';
      logger.info(`Confirmed trigger ${triggerId}, ${completionNote}`);

      return updatedTrigger;
    });
  }

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

      await tx.billing_action_item.updateMany({
        where: {
          trigger_queue_id: triggerId,
          status: 'pending',
        },
        data: {
          status: 'cancelled',
          completed_at: null,
        },
      });

      logger.info(`Rejected trigger ${triggerId}`);

      return updatedTrigger;
    });
  }

  static async updateTriggerActionItem(triggerId: number, updates: TriggerActionItemUpdate): Promise<any> {
    return prisma.$transaction(async (tx: any) => {
      const trigger = await tx.billing_milestone_trigger_queue.findUnique({
        where: { id: triggerId },
        include: {
          billing_action_item: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      });

      if (!trigger) {
        throw new Error('Trigger not found');
      }

      const existingActionItem = trigger.billing_action_item?.[0] || null;
      const resolvedActionType = (updates.actionType || existingActionItem?.action_type || trigger.action_taken || this.getActionTypeForStatus(trigger.event_type || trigger.new_status)).trim();
      const resolvedDescription = (updates.description || existingActionItem?.description || `Action required: ${this.getActionDescription(resolvedActionType)} for milestone`).trim();

      if (updates.assignedTo !== undefined && updates.assignedTo !== null) {
        const staff = await tx.staff.findUnique({
          where: { id: updates.assignedTo },
          select: { id: true },
        });
        if (!staff) {
          throw new Error('Assigned staff not found');
        }
      }

      let dueDateToPersist: Date | null | undefined;
      if (updates.dueDate !== undefined) {
        if (updates.dueDate === null || updates.dueDate === '') {
          dueDateToPersist = null;
        } else {
          const parsedDate = new Date(updates.dueDate);
          if (Number.isNaN(parsedDate.getTime())) {
            throw new Error('Invalid due date');
          }
          dueDateToPersist = parsedDate;
        }
      }

      const resolvedStatus = updates.status || existingActionItem?.status || 'pending';
      const completedAt = resolvedStatus === 'completed'
        ? (existingActionItem?.completed_at || new Date())
        : null;

      const payload: any = {
        action_type: resolvedActionType,
        description: resolvedDescription,
        status: resolvedStatus,
        completed_at: completedAt,
      };

      if (dueDateToPersist !== undefined) {
        payload.due_date = dueDateToPersist;
      } else if (!existingActionItem) {
        payload.due_date = this.calculateDueDate(resolvedActionType);
      }

      if (updates.assignedTo !== undefined) {
        payload.assigned_to = updates.assignedTo;
      }

      let actionItem: any;
      if (existingActionItem) {
        actionItem = await tx.billing_action_item.update({
          where: { id: existingActionItem.id },
          data: payload,
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                position: true,
              },
            },
          },
        });
      } else {
        actionItem = await tx.billing_action_item.create({
          data: {
            trigger_queue_id: triggerId,
            milestone_id: trigger.milestone_id,
            ...payload,
          },
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                position: true,
              },
            },
          },
        });
      }

      if (trigger.action_taken !== resolvedActionType) {
        await tx.billing_milestone_trigger_queue.update({
          where: { id: triggerId },
          data: { action_taken: resolvedActionType },
        });
      }

      return actionItem;
    });
  }

  static async getOverdueByAttorney(filters?: {
    attorneyId?: number;
    minAmount?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const conditions: string[] = ['m.completed IS NOT TRUE', 'm.due_date IS NOT NULL', 'm.due_date < CURRENT_DATE'];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.attorneyId !== undefined && filters.attorneyId !== null) {
      conditions.push(`COALESCE(s.id, 0) = $${paramIndex++}`);
      params.push(filters.attorneyId);
    }

    if (filters?.minAmount !== undefined && filters.minAmount !== null) {
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
        COALESCE(s.id, 0) AS staff_id,
        COALESCE(s.name, 'Unassigned') AS attorney_name,
        s.position AS attorney_position,
        COUNT(DISTINCT m.milestone_id) AS overdue_milestones,
        COALESCE(SUM(COALESCE(m.amount_value, 0)::numeric), 0) AS overdue_amount,
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
      LEFT JOIN billing_project_bc_attorneys bpa ON bp.project_id = bpa.billing_project_id
      LEFT JOIN staff s ON bpa.staff_id = s.id
      LEFT JOIN billing_staffing_project_link bspl ON bp.project_id = bspl.billing_project_id
      LEFT JOIN projects p ON bspl.staffing_project_id = p.id
      ${whereClause}
      GROUP BY COALESCE(s.id, 0), COALESCE(s.name, 'Unassigned'), s.position, bp.project_id, bp.project_name, p.id, p.name, p.status, m.milestone_id, m.title, m.amount_value, m.due_date
      ORDER BY overdue_amount DESC, attorney_name ASC
    `;

    return prisma.$queryRawUnsafe(query, ...params);
  }

  private static getActionTypeForStatus(status: string): string {
    const actionMap: Record<string, string> = {
      'Closed': 'issue_invoice',
      'Terminated': 'follow_up_payment',
      'Suspended': 'pause_billing',
      'Slow-down': 'adjust_billing_schedule',
      'On Hold': 'review_billing_agreement',
      'PROJECT_CLOSED': 'issue_invoice',
      'LISTING_COMPLETED': 'issue_invoice',
      'PROJECT_TERMINATED': 'follow_up_payment',
      'PROJECT_PAUSED': 'pause_billing',
      'PROJECT_RESUMED': 'adjust_billing_schedule',
      'EL_SIGNED': 'review_billing_agreement',
      'PROJECT_KICKOFF': 'adjust_billing_schedule',
      'A1_SUBMITTED': 'general_followup',
      'HEARING_PASSED': 'general_followup',
      'CONFIDENTIAL_FILING_SUBMITTED': 'general_followup',
      'RENEWAL_CYCLE_STARTED': 'review_billing_agreement',
    };

    return actionMap[status] || 'general_followup';
  }

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
}
