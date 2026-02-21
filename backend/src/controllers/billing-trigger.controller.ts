/**
 * Billing Trigger Controller
 *
 * Handles API endpoints for billing milestone trigger queue and action items
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProjectStatusTriggerService } from '../services/project-status-trigger.service';
import { logger } from '../utils/logger';

const toSafeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) ? numeric : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatActionItem = (actionItem: any) => {
  if (!actionItem) {
    return null;
  }

  return {
    id: actionItem.id,
    actionType: actionItem.action_type,
    description: actionItem.description,
    dueDate: actionItem.due_date,
    status: actionItem.status,
    completedAt: actionItem.completed_at,
    assignedTo: actionItem.assignedTo ? {
      id: actionItem.assignedTo.id,
      name: actionItem.assignedTo.name,
      position: actionItem.assignedTo.position,
    } : null,
  };
};

const formatTrigger = (trigger: any) => {
  const actionItem = Array.isArray(trigger.billing_action_item)
    ? trigger.billing_action_item[0]
    : null;

  return {
    id: trigger.id,
    milestoneId: toSafeNumber(trigger.milestone_id),
    staffingProjectId: toSafeNumber(trigger.staffing_project_id),
    oldStatus: trigger.old_status,
    newStatus: trigger.new_status,
    matchConfidence: parseFloat(trigger.match_confidence?.toString() || '0'),
    triggerReason: trigger.trigger_reason,
    status: trigger.status,
    confirmedBy: toSafeNumber(trigger.confirmed_by),
    confirmedAt: trigger.confirmed_at,
    actionTaken: trigger.action_taken,
    createdAt: trigger.created_at,
    milestone: trigger.milestone ? {
      title: trigger.milestone.title,
      triggerText: trigger.milestone.trigger_text,
      amountValue: trigger.milestone.amount_value
        ? parseFloat(trigger.milestone.amount_value.toString())
        : null,
      dueDate: trigger.milestone.due_date,
    } : null,
    project: trigger.project ? {
      name: trigger.project.name,
      status: trigger.project.status,
    } : null,
    actionItem: formatActionItem(actionItem),
  };
};

/**
 * Get all pending triggers for admin review
 */
export const getPendingTriggers = async (req: AuthRequest, res: Response) => {
  try {
    const triggers = await ProjectStatusTriggerService.getPendingTriggers();
    const formattedTriggers = triggers.map((trigger: any) => formatTrigger(trigger));

    res.json(formattedTriggers);
  } catch (error) {
    logger.error('Error fetching pending triggers:', error as any);
    res.status(500).json({ error: 'Failed to fetch pending triggers' });
  }
};

/**
 * Get all triggers with filters
 */
export const getTriggers = async (req: AuthRequest, res: Response) => {
  try {
    const { status, staffingProjectId, startDate, endDate } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (staffingProjectId) filters.staffingProjectId = parseInt(staffingProjectId as string, 10);
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const triggers = await ProjectStatusTriggerService.getTriggers(filters);
    const formattedTriggers = triggers.map((trigger: any) => formatTrigger(trigger));

    res.json(formattedTriggers);
  } catch (error) {
    logger.error('Error fetching triggers:', error as any);
    res.status(500).json({ error: 'Failed to fetch triggers' });
  }
};

/**
 * Add or update a consequence action item for a trigger.
 */
export const updateTriggerActionItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const triggerId = parseInt(id as string, 10);

    if (Number.isNaN(triggerId)) {
      return res.status(400).json({ error: 'Invalid trigger ID' });
    }

    const actionItem = await ProjectStatusTriggerService.updateTriggerActionItem(triggerId, {
      actionType: req.body?.actionType,
      description: req.body?.description,
      dueDate: req.body?.dueDate,
      status: req.body?.status,
      assignedTo: req.body?.assignedTo,
    });

    res.json({
      message: 'Trigger action item updated successfully',
      actionItem: formatActionItem(actionItem),
    });
  } catch (error: any) {
    logger.error('Error updating trigger action item:', error);
    res.status(400).json({ error: error.message || 'Failed to update trigger action item' });
  }
};

/**
 * Confirm a trigger
 */
export const confirmTrigger = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const triggerId = parseInt(id as string, 10);

    if (Number.isNaN(triggerId)) {
      return res.status(400).json({ error: 'Invalid trigger ID' });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const trigger = await ProjectStatusTriggerService.confirmTrigger(triggerId, userId);

    res.json({
      message: 'Trigger confirmed successfully',
      trigger: {
        id: trigger.id,
        status: trigger.status,
        confirmedBy: trigger.confirmed_by,
        confirmedAt: trigger.confirmed_at,
        actionTaken: trigger.action_taken,
      },
    });
  } catch (error: any) {
    logger.error('Error confirming trigger:', error);
    res.status(400).json({ error: error.message || 'Failed to confirm trigger' });
  }
};

/**
 * Reject a trigger
 */
export const rejectTrigger = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const triggerId = parseInt(id as string, 10);

    if (Number.isNaN(triggerId)) {
      return res.status(400).json({ error: 'Invalid trigger ID' });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const trigger = await ProjectStatusTriggerService.rejectTrigger(triggerId, userId);

    res.json({
      message: 'Trigger rejected successfully',
      trigger: {
        id: trigger.id,
        status: trigger.status,
        confirmedBy: trigger.confirmed_by,
        confirmedAt: trigger.confirmed_at,
      },
    });
  } catch (error: any) {
    logger.error('Error rejecting trigger:', error);
    res.status(400).json({ error: error.message || 'Failed to reject trigger' });
  }
};

/**
 * Get overdue billing by attorney
 */
export const getOverdueByAttorney = async (req: AuthRequest, res: Response) => {
  try {
    const { attorneyId, minAmount, startDate, endDate } = req.query;

    const filters: any = {};
    if (attorneyId) filters.attorneyId = parseInt(attorneyId as string, 10);
    if (minAmount) filters.minAmount = parseFloat(minAmount as string);
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const overdue = await ProjectStatusTriggerService.getOverdueByAttorney(filters);

    // Format the results
    const formattedOverdue = (overdue as any[]).map(item => ({
      staffId: Number(item.staff_id ?? 0),
      attorneyName: item.attorney_name,
      attorneyPosition: item.attorney_position,
      overdueMilestones: Number(item.overdue_milestones ?? 0),
      overdueAmount: Number(item.overdue_amount ?? 0),
      nextDueDate: item.next_due_date,
      billingProjectId: Number(item.billing_project_id),
      billingProjectName: item.project_name,
      staffingProjectId: item.staffing_project_id ? Number(item.staffing_project_id) : null,
      staffingProjectName: item.staffing_project_name,
      staffingProjectStatus: item.staffing_project_status,
      milestoneId: Number(item.milestone_id),
      milestoneTitle: item.milestone_title,
      milestoneAmount: item.milestone_amount ? Number(item.milestone_amount) : null,
      milestoneDueDate: item.milestone_due_date,
    }));

    res.json(formattedOverdue);
  } catch (error) {
    logger.error('Error fetching overdue by attorney:', error as any);
    res.status(500).json({ error: 'Failed to fetch overdue billing data' });
  }
};
