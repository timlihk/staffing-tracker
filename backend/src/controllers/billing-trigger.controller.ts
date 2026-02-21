/**
 * Billing Trigger Controller
 *
 * Handles API endpoints for billing milestone trigger queue and action items
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProjectStatusTriggerService } from '../services/project-status-trigger.service';
import { logger } from '../utils/logger';

/**
 * Get all pending triggers for admin review
 */
export const getPendingTriggers = async (req: AuthRequest, res: Response) => {
  try {
    const triggers = await ProjectStatusTriggerService.getPendingTriggers();

    const formattedTriggers = triggers.map((trigger: any) => ({
      id: trigger.id,
      milestoneId: trigger.milestone_id,
      staffingProjectId: trigger.staffing_project_id,
      oldStatus: trigger.old_status,
      newStatus: trigger.new_status,
      matchConfidence: parseFloat(trigger.match_confidence?.toString() || '0'),
      triggerReason: trigger.trigger_reason,
      status: trigger.status,
      createdAt: trigger.created_at,
      // Milestone details
      milestone: trigger.milestone ? {
        title: trigger.milestone.title,
        triggerText: trigger.milestone.trigger_text,
        amountValue: trigger.milestone.amount_value
          ? parseFloat(trigger.milestone.amount_value.toString())
          : null,
        dueDate: trigger.milestone.due_date,
      } : null,
      // Project details
      project: trigger.project ? {
        name: trigger.project.name,
        status: trigger.project.status,
      } : null,
    }));

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

    const formattedTriggers = triggers.map((trigger: any) => ({
      id: trigger.id,
      milestoneId: trigger.milestone_id,
      staffingProjectId: trigger.staffing_project_id,
      oldStatus: trigger.old_status,
      newStatus: trigger.new_status,
      matchConfidence: parseFloat(trigger.match_confidence?.toString() || '0'),
      triggerReason: trigger.trigger_reason,
      status: trigger.status,
      confirmedBy: trigger.confirmed_by,
      confirmedAt: trigger.confirmed_at,
      actionTaken: trigger.action_taken,
      createdAt: trigger.created_at,
      // Milestone details
      milestone: trigger.milestone ? {
        title: trigger.milestone.title,
        triggerText: trigger.milestone.trigger_text,
        amountValue: trigger.milestone.amount_value
          ? parseFloat(trigger.milestone.amount_value.toString())
          : null,
        dueDate: trigger.milestone.due_date,
      } : null,
      // Project details
      project: trigger.project ? {
        name: trigger.project.name,
        status: trigger.project.status,
      } : null,
    }));

    res.json(formattedTriggers);
  } catch (error) {
    logger.error('Error fetching triggers:', error as any);
    res.status(500).json({ error: 'Failed to fetch triggers' });
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
      staffId: item.staff_id,
      attorneyName: item.attorney_name,
      attorneyPosition: item.attorney_position,
      overdueMilestones: parseInt(item.overdue_milestones, 10),
      overdueAmount: parseFloat(item.overdue_amount),
      nextDueDate: item.next_due_date,
      billingProjectId: item.billing_project_id,
      billingProjectName: item.project_name,
      staffingProjectId: item.staffing_project_id,
      staffingProjectName: item.staffing_project_name,
      staffingProjectStatus: item.staffing_project_status,
      milestoneId: item.milestone_id,
      milestoneTitle: item.milestone_title,
      milestoneAmount: item.milestone_amount
        ? parseFloat(item.milestone_amount.toString())
        : null,
      milestoneDueDate: item.milestone_due_date,
    }));

    res.json(formattedOverdue);
  } catch (error) {
    logger.error('Error fetching overdue by attorney:', error as any);
    res.status(500).json({ error: 'Failed to fetch overdue billing data' });
  }
};
