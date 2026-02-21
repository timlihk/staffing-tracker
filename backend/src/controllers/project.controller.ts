import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma, { getCached, setCached, invalidateCache, CACHE_KEYS } from '../utils/prisma';
import { trackFieldChanges } from '../utils/changeTracking';
import { detectProjectChanges, sendProjectUpdateEmails } from '../services/email.service';
import { ProjectStatusTriggerService } from '../services/project-status-trigger.service';
import { ProjectEventTriggerService } from '../services/project-event-trigger.service';
import { parseQueryInt, wasValueClamped } from '../utils/queryParsing';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import { ProjectCategory, ProjectStatus, ActionType, EntityType } from '../constants';

const TIMETABLE_TO_LIFECYCLE_STAGE: Record<string, string> = {
  PRE_A1: 'kickoff',
  A1: 'a1_filed',
  HEARING: 'hearing_passed',
  LISTING: 'listed',
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isElSigned = (value: unknown): boolean => {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  return normalized === 'signed' || normalized === 'yes' || normalized === 'true';
};

const deriveLifecycleStage = (params: {
  lifecycleStage?: unknown;
  timetable?: unknown;
  elStatus?: unknown;
  fallbackLifecycleStage?: string | null;
}): string | null => {
  if (isElSigned(params.elStatus)) {
    return 'signed';
  }

  const explicitLifecycle = normalizeOptionalString(params.lifecycleStage);
  if (explicitLifecycle) {
    return explicitLifecycle;
  }

  const timetable = normalizeOptionalString(params.timetable)?.toUpperCase();
  if (timetable && TIMETABLE_TO_LIFECYCLE_STAGE[timetable]) {
    return TIMETABLE_TO_LIFECYCLE_STAGE[timetable];
  }

  return params.fallbackLifecycleStage ?? null;
};

const normalizeDateInput = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeNumberInput = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const deriveMilestoneBillingStatus = (milestone: {
  completed?: boolean | null;
  invoice_sent_date?: Date | string | null;
  payment_received_date?: Date | string | null;
  due_date?: Date | string | null;
}): 'pending' | 'overdue' | 'completed' | 'invoiced' | 'collected' => {
  if (milestone.payment_received_date) return 'collected';
  if (milestone.invoice_sent_date) return 'invoiced';
  if (milestone.completed) return 'completed';
  if (milestone.due_date && new Date(milestone.due_date).getTime() < Date.now()) return 'overdue';
  return 'pending';
};

export const getAllProjects = async (req: AuthRequest, res: Response) => {
  try {
    const { status, category, side, sector, search, staffId, page = '1', limit = '50' } = req.query;

    // Generate cache key based on query parameters
    const cacheKey = CACHE_KEYS.PROJECTS_LIST(
      `status=${status}&category=${category}&side=${side}&sector=${sector}&search=${search}&staffId=${staffId}&page=${page}&limit=${limit}`
    );

    // Try to get from cache first
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const where: Prisma.ProjectWhereInput = {};

    if (typeof status === 'string' && status.trim()) {
      where.status = status;
    }

    if (typeof category === 'string' && category.trim()) {
      where.category = category;
    }

    if (typeof side === 'string' && side.trim()) {
      where.side = side;
    }

    if (typeof sector === 'string' && sector.trim()) {
      where.sector = sector;
    }

    if (typeof search === 'string' && search.trim()) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { cmNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (typeof staffId === 'string' && staffId.trim()) {
      const parsedStaffId = parseInt(staffId, 10);
      if (Number.isNaN(parsedStaffId)) {
        return res.status(400).json({ error: 'Invalid staffId' });
      }
      where.assignments = {
        some: { staffId: parsedStaffId },
      };
    }

    const pageNum = parseQueryInt(page as string, { default: 1, min: 1 });
    const limitNum = parseQueryInt(limit as string, { default: 25, min: 1, max: 100 }); // Reduced default from 50 to 25 for faster initial load
    const skip = (pageNum - 1) * limitNum;

    // Further optimize by using select instead of include for better performance
    // Remove assignments field as it's not used in the project list view
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        // Use select instead of include for better performance
        select: {
          id: true,
          name: true,
          cmNumber: true,
          category: true,
          status: true,
          lifecycleStage: true,
          stageVersion: true,
          priority: true,
          elStatus: true,
          timetable: true,
          filingDate: true,
          listingDate: true,
          side: true,
          sector: true,
          lastConfirmedAt: true,
          createdAt: true,
          updatedAt: true,
          // Removed unused fields: bcAttorney, notes, assignments
          // This significantly reduces query complexity and data transfer
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.project.count({ where }),
    ]);

    const projectsWithUnifiedLifecycle = projects.map((project) => ({
      ...project,
      lifecycleStage: deriveLifecycleStage({
        lifecycleStage: project.lifecycleStage,
        timetable: project.timetable,
        elStatus: project.elStatus,
        fallbackLifecycleStage: project.lifecycleStage,
      }),
    }));

    const response = {
      data: projectsWithUnifiedLifecycle,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    // Cache the response
    setCached(cacheKey, response);

    res.json(response);
  } catch (error) {
    logger.error('Get all projects error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjectById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const projectId = parseInt(id as string, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Try to get from cache first
    const cacheKey = CACHE_KEYS.PROJECT_DETAIL(projectId);
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      // Use select instead of include for better performance
      select: {
        id: true,
        name: true,
        category: true,
        status: true,
        cmNumber: true,
        lifecycleStage: true,
        stageVersion: true,
        priority: true,
        elStatus: true,
        timetable: true,
        filingDate: true,
        listingDate: true,
        bcAttorney: true,
        side: true,
        sector: true,
        notes: true,
        lastConfirmedAt: true,
        lastConfirmedBy: true,
        lifecycleStageChangedAt: true,
        lifecycleStageChangedBy: true,
        createdAt: true,
        updatedAt: true,
        assignments: {
          select: {
            id: true,
            staffId: true,
            jurisdiction: true,
            createdAt: true,
            staff: {
              select: {
                id: true,
                name: true,
                position: true,
                // Removed email and department as they're not used in project detail view
              }
            },
          },
        },
        bcAttorneys: {
          select: {
            id: true,
            projectId: true,
            staffId: true,
            createdAt: true,
            staff: {
              select: {
                id: true,
                name: true,
                position: true,
              }
            },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const projectWithUnifiedLifecycle = {
      ...project,
      lifecycleStage: deriveLifecycleStage({
        lifecycleStage: project.lifecycleStage,
        timetable: project.timetable,
        elStatus: project.elStatus,
        fallbackLifecycleStage: project.lifecycleStage,
      }),
    };

    // Cache the project
    setCached(cacheKey, projectWithUnifiedLifecycle);

    res.json(projectWithUnifiedLifecycle);
  } catch (error) {
    logger.error('Get project by ID error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjectBillingMilestones = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, cmNumber: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const linkedCms = await prisma.$queryRaw<{ cm_no: string | null }[]>`
      SELECT DISTINCT cm.cm_no
      FROM billing_staffing_project_link l
      JOIN billing_project_cm_no cm ON cm.project_id = l.billing_project_id
      WHERE l.staffing_project_id = ${projectId}
    `;

    const cmNumbers = Array.from(
      new Set(
        [project.cmNumber, ...linkedCms.map((row) => row.cm_no)]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim())
      )
    );

    if (cmNumbers.length === 0) {
      return res.json({
        projectId,
        linked: false,
        cmNumbers: [],
        milestones: [],
      });
    }

    const cmSql = cmNumbers.map((value) => Prisma.sql`${value}`);
    const milestoneRows = await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        bp.project_id AS billing_project_id,
        bp.project_name AS billing_project_name,
        cm.cm_no,
        e.engagement_id,
        COALESCE(e.engagement_title, e.name) AS engagement_title,
        m.milestone_id,
        m.ordinal,
        m.title,
        m.trigger_text,
        m.due_date,
        m.amount_value,
        m.amount_currency,
        m.completed,
        m.completion_date,
        m.invoice_sent_date,
        m.payment_received_date,
        m.notes,
        m.sort_order,
        fa.raw_text AS fee_arrangement_text
      FROM billing_milestone m
      JOIN billing_engagement e ON e.engagement_id = m.engagement_id
      JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
      JOIN billing_project bp ON bp.project_id = cm.project_id
      LEFT JOIN billing_fee_arrangement fa ON fa.engagement_id = e.engagement_id
      WHERE cm.cm_no IN (${Prisma.join(cmSql)})
      ORDER BY bp.project_name, cm.cm_no, e.engagement_id, m.sort_order NULLS LAST, m.milestone_id
    `);

    const milestoneIds = milestoneRows
      .map((row) => Number(row.milestone_id))
      .filter((value) => Number.isFinite(value));
    const milestoneIdBigInts = milestoneIds.map((value) => BigInt(value));

    const triggerRows = milestoneIdBigInts.length > 0
      ? await prisma.billing_milestone_trigger_queue.findMany({
        where: {
          staffing_project_id: projectId,
          milestone_id: { in: milestoneIdBigInts },
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        include: {
          billing_action_item: {
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
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
      })
      : [];

    const triggerRules = milestoneIdBigInts.length > 0
      ? await prisma.billing_milestone_trigger_rule.findMany({
        where: {
          milestone_id: { in: milestoneIdBigInts },
        },
        orderBy: [{ milestone_id: 'asc' }, { updated_at: 'desc' }, { id: 'desc' }],
      })
      : [];

    const triggerStatsByMilestone = new Map<number, {
      total: number;
      pending: number;
      confirmed: number;
      rejected: number;
    }>();
    const latestTriggerByMilestone = new Map<number, (typeof triggerRows)[number]>();

    for (const trigger of triggerRows) {
      const milestoneId = Number(trigger.milestone_id);
      if (!Number.isFinite(milestoneId)) continue;

      const existingStats = triggerStatsByMilestone.get(milestoneId) ?? {
        total: 0,
        pending: 0,
        confirmed: 0,
        rejected: 0,
      };

      existingStats.total += 1;
      if (trigger.status === 'pending') existingStats.pending += 1;
      if (trigger.status === 'confirmed') existingStats.confirmed += 1;
      if (trigger.status === 'rejected') existingStats.rejected += 1;
      triggerStatsByMilestone.set(milestoneId, existingStats);

      if (!latestTriggerByMilestone.has(milestoneId)) {
        latestTriggerByMilestone.set(milestoneId, trigger);
      }
    }

    const triggerRuleByMilestone = new Map<number, (typeof triggerRules)[number]>();
    for (const rule of triggerRules) {
      const milestoneId = Number(rule.milestone_id);
      if (!Number.isFinite(milestoneId)) continue;
      if (!triggerRuleByMilestone.has(milestoneId)) {
        triggerRuleByMilestone.set(milestoneId, rule);
      }
    }

    const isAdmin = req.user?.role === 'admin';

    const milestones = milestoneRows.map((row) => {
      const milestoneId = Number(row.milestone_id);
      const stats = triggerStatsByMilestone.get(milestoneId) ?? {
        total: 0,
        pending: 0,
        confirmed: 0,
        rejected: 0,
      };

      const trigger = latestTriggerByMilestone.get(milestoneId);
      const actionItem = trigger && Array.isArray(trigger.billing_action_item)
        ? trigger.billing_action_item[0]
        : null;

      const triggerRule = (() => {
        if (!isAdmin) return null;
        const rule = triggerRuleByMilestone.get(milestoneId);
        if (!rule) return null;
        return {
          id: rule.id,
          triggerMode: rule.trigger_mode,
          anchorEventType: rule.anchor_event_type,
          autoConfirm: rule.auto_confirm,
          manualConfirmRequired: rule.manual_confirm_required,
          dueInBusinessDays: rule.due_in_business_days,
          recurrence: rule.recurrence,
          confidence: rule.confidence !== null ? Number(rule.confidence) : null,
          updatedAt: rule.updated_at,
        };
      })();

      const latestTrigger = (() => {
        if (!trigger) return null;

        const formattedActionItem = actionItem
          ? {
            id: actionItem.id,
            actionType: actionItem.action_type,
            description: actionItem.description,
            dueDate: actionItem.due_date,
            status: actionItem.status,
            completedAt: actionItem.completed_at,
            assignedTo: actionItem.assignedTo
              ? {
                id: actionItem.assignedTo.id,
                name: actionItem.assignedTo.name,
                position: actionItem.assignedTo.position,
              }
              : null,
          }
          : null;

        if (!isAdmin) {
          return {
            status: trigger.status,
            actionItem: formattedActionItem,
          };
        }

        return {
          id: trigger.id,
          status: trigger.status,
          oldStatus: trigger.old_status,
          newStatus: trigger.new_status,
          matchConfidence: Number(trigger.match_confidence),
          matchMethod: trigger.match_method,
          triggerReason: trigger.trigger_reason,
          createdAt: trigger.created_at,
          confirmedAt: trigger.confirmed_at,
          actionTaken: trigger.action_taken,
          actionItem: formattedActionItem,
        };
      })();

      return {
        milestoneId,
        triggerStats: isAdmin
          ? stats
          : {
            total: stats.pending,
            pending: stats.pending,
            confirmed: 0,
            rejected: 0,
          },
        triggerRule,
        latestTrigger,
        billingProjectId: Number(row.billing_project_id),
        billingProjectName: row.billing_project_name,
        cmNumber: row.cm_no,
        engagementId: Number(row.engagement_id),
        engagementTitle: row.engagement_title,
        ordinal: row.ordinal,
        title: row.title,
        triggerText: row.trigger_text,
        dueDate: row.due_date,
        amountValue: row.amount_value !== null ? Number(row.amount_value) : null,
        amountCurrency: row.amount_currency,
        completed: Boolean(row.completed),
        completionDate: row.completion_date,
        invoiceSentDate: row.invoice_sent_date,
        paymentReceivedDate: row.payment_received_date,
        notes: row.notes,
        feeArrangementText: row.fee_arrangement_text ?? null,
        milestoneStatus: deriveMilestoneBillingStatus(row),
      };
    });

    res.json({
      projectId,
      linked: true,
      cmNumbers,
      milestones,
    });
  } catch (error) {
    logger.error('Get project billing milestones error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProjectBillingMilestones = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const { milestones } = req.body as {
      milestones?: Array<{
        milestone_id: number;
        completed?: boolean;
        invoice_sent_date?: string | null;
        payment_received_date?: string | null;
        notes?: string | null;
        due_date?: string | null;
        title?: string | null;
        trigger_text?: string | null;
        amount_value?: number | null;
        amount_currency?: string | null;
      }>;
    };

    if (!Array.isArray(milestones) || milestones.length === 0) {
      return res.status(400).json({ error: 'Milestones payload is required' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, cmNumber: true },
    });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin) {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { staffId: true },
      });

      if (!dbUser?.staffId) {
        return res.status(403).json({ error: 'Access denied - No staff record' });
      }

      const staff = await prisma.staff.findUnique({
        where: { id: dbUser.staffId },
        select: { position: true },
      });

      if (staff?.position !== 'B&C Working Attorney') {
        return res.status(403).json({ error: 'Access denied - Not a B&C attorney' });
      }

      const assignment = await prisma.projectBcAttorney.findFirst({
        where: {
          projectId,
          staffId: dbUser.staffId,
        },
        select: { id: true },
      });

      if (!assignment) {
        return res.status(403).json({ error: 'Access denied - Project not assigned to you' });
      }
    }

    const linkedCms = await prisma.$queryRaw<{ cm_no: string | null }[]>`
      SELECT DISTINCT cm.cm_no
      FROM billing_staffing_project_link l
      JOIN billing_project_cm_no cm ON cm.project_id = l.billing_project_id
      WHERE l.staffing_project_id = ${projectId}
    `;
    const cmNumbers = Array.from(
      new Set(
        [project.cmNumber, ...linkedCms.map((row) => row.cm_no)]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim())
      )
    );

    if (cmNumbers.length === 0) {
      return res.status(400).json({ error: 'Project has no linked C/M number' });
    }

    const milestoneIds = milestones
      .map((m) => Number(m.milestone_id))
      .filter((value) => Number.isFinite(value));
    if (milestoneIds.length !== milestones.length) {
      return res.status(400).json({ error: 'Invalid milestone_id in payload' });
    }

    const allowedMilestones = await prisma.$queryRaw<{ milestone_id: bigint }[]>(Prisma.sql`
      SELECT DISTINCT m.milestone_id
      FROM billing_milestone m
      JOIN billing_engagement e ON e.engagement_id = m.engagement_id
      JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
      WHERE cm.cm_no IN (${Prisma.join(cmNumbers.map((value) => Prisma.sql`${value}`))})
        AND m.milestone_id IN (${Prisma.join(milestoneIds.map((value) => Prisma.sql`${BigInt(value)}`))})
    `);

    const allowedIds = new Set(allowedMilestones.map((row) => Number(row.milestone_id)));
    const unauthorized = milestoneIds.filter((id) => !allowedIds.has(id));
    if (unauthorized.length > 0) {
      return res.status(403).json({ error: `Milestones not linked to project C/M: ${unauthorized.join(', ')}` });
    }

    const updatedMilestones: Array<{ milestoneId: number; changed: string[] }> = [];
    for (const milestone of milestones) {
      const milestoneId = Number(milestone.milestone_id);
      const existing = await prisma.billing_milestone.findUnique({
        where: { milestone_id: BigInt(milestoneId) },
        select: {
          milestone_id: true,
          completed: true,
          completion_date: true,
          invoice_sent_date: true,
          payment_received_date: true,
          notes: true,
          due_date: true,
          title: true,
          trigger_text: true,
          amount_value: true,
          amount_currency: true,
        },
      });

      if (!existing) continue;

      const data: any = {};
      const changed: string[] = [];

      if (Object.prototype.hasOwnProperty.call(milestone, 'completed')) {
        const completed = Boolean(milestone.completed);
        data.completed = completed;
        data.completion_date = completed ? (existing.completion_date || new Date()) : null;
        data.completion_source = completed ? 'project_detail_update' : null;
        if (completed !== existing.completed) changed.push('completed');
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'invoice_sent_date')) {
        const value = normalizeDateInput(milestone.invoice_sent_date);
        data.invoice_sent_date = value;
        if (String(value) !== String(existing.invoice_sent_date)) changed.push('invoice_sent_date');
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'payment_received_date')) {
        const value = normalizeDateInput(milestone.payment_received_date);
        data.payment_received_date = value;
        if (String(value) !== String(existing.payment_received_date)) changed.push('payment_received_date');
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'notes')) {
        const value = normalizeOptionalString(milestone.notes);
        data.notes = value;
        if (value !== existing.notes) changed.push('notes');
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'due_date')) {
        const value = normalizeDateInput(milestone.due_date);
        data.due_date = value;
        if (String(value) !== String(existing.due_date)) changed.push('due_date');
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'title')) {
        const value = normalizeOptionalString(milestone.title);
        data.title = value;
        data.description = value;
        if (value !== existing.title) changed.push('title');
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'trigger_text')) {
        const value = normalizeOptionalString(milestone.trigger_text);
        data.trigger_text = value;
        if (value !== existing.trigger_text) changed.push('trigger_text');
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'amount_value')) {
        const value = normalizeNumberInput(milestone.amount_value);
        data.amount_value = value;
        if (String(value) !== String(existing.amount_value ?? null)) changed.push('amount_value');
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'amount_currency')) {
        const value = normalizeOptionalString(milestone.amount_currency);
        data.amount_currency = value;
        if (value !== existing.amount_currency) changed.push('amount_currency');
      }

      if (changed.length === 0) continue;

      await prisma.billing_milestone.update({
        where: { milestone_id: BigInt(milestoneId) },
        data,
      });

      updatedMilestones.push({ milestoneId, changed });

      await ProjectEventTriggerService.createProjectEvent({
        projectId,
        eventType: 'BILLING_MILESTONE_UPDATED',
        source: 'project_detail',
        createdBy: req.user?.userId,
        payload: {
          milestoneId,
          changedFields: changed,
          completed: Object.prototype.hasOwnProperty.call(milestone, 'completed')
            ? Boolean(milestone.completed)
            : existing.completed,
          invoiceSentDate: Object.prototype.hasOwnProperty.call(milestone, 'invoice_sent_date')
            ? milestone.invoice_sent_date
            : existing.invoice_sent_date,
          paymentReceivedDate: Object.prototype.hasOwnProperty.call(milestone, 'payment_received_date')
            ? milestone.payment_received_date
            : existing.payment_received_date,
        },
        processTriggers: true,
      });
    }

    if (req.user?.userId && updatedMilestones.length > 0) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          actionType: ActionType.UPDATE,
          entityType: 'billing_milestone',
          entityId: updatedMilestones[0].milestoneId,
          description: `Updated ${updatedMilestones.length} billing milestones from project ${project.name}`,
        },
      });
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({
      success: true,
      updated: updatedMilestones.length,
      milestones: updatedMilestones,
    });
  } catch (error) {
    logger.error('Update project billing milestones error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjectEvents = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const eventType = typeof req.query.eventType === 'string' ? req.query.eventType : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;

    const events = await ProjectEventTriggerService.getProjectEvents(projectId, {
      eventType,
      limit: Number.isNaN(limit as number) ? undefined : limit,
    });

    res.json(events);
  } catch (error) {
    logger.error('Get project events error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addProjectEvent = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const {
      eventType,
      occurredAt,
      source,
      payload,
      statusFrom,
      statusTo,
      lifecycleStageFrom,
      lifecycleStageTo,
      eventKey,
    } = req.body as {
      eventType: string;
      occurredAt?: string;
      source?: string;
      payload?: Record<string, unknown>;
      statusFrom?: string;
      statusTo?: string;
      lifecycleStageFrom?: string;
      lifecycleStageTo?: string;
      eventKey?: string;
    };

    if (!eventType || !eventType.trim()) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    const created = await ProjectEventTriggerService.createProjectEvent({
      projectId,
      eventType: eventType.trim(),
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      source: source || 'manual',
      payload: payload || null,
      createdBy: req.user?.userId,
      statusFrom: statusFrom || null,
      statusTo: statusTo || null,
      lifecycleStageFrom: lifecycleStageFrom || null,
      lifecycleStageTo: lifecycleStageTo || null,
      eventKey: eventKey || null,
      processTriggers: true,
    });

    res.status(201).json(created);
  } catch (error) {
    logger.error('Add project event error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      category,
      status,
      priority,
      elStatus,
      timetable,
      filingDate,
      listingDate,
      bcAttorney,
      side,
      sector,
      notes,
      lifecycleStage,
    } = req.body;

    if (!name || !category || !status) {
      return res.status(400).json({ error: 'Project name, category, and status are required' });
    }

    const resolvedLifecycleStage = deriveLifecycleStage({
      lifecycleStage,
      timetable,
      elStatus,
      fallbackLifecycleStage: null,
    });

    const project = await prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          name,
          category,
          status,
          priority,
          elStatus,
          timetable,
          filingDate: filingDate ? new Date(filingDate) : null,
          listingDate: listingDate ? new Date(listingDate) : null,
          bcAttorney,
          side,
          sector,
          notes,
          ...(resolvedLifecycleStage ? { lifecycleStage: resolvedLifecycleStage, lifecycleStageChangedAt: new Date() } : {}),
          ...(resolvedLifecycleStage && req.user?.userId ? { lifecycleChangedBy: { connect: { id: req.user.userId } } } : {}),
        },
        // Optimized with selective fields for performance
        select: {
          id: true,
          name: true,
          cmNumber: true,
          category: true,
          status: true,
          lifecycleStage: true,
          stageVersion: true,
          priority: true,
          elStatus: true,
          timetable: true,
          filingDate: true,
          listingDate: true,
          bcAttorney: true,
          side: true,
          sector: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          assignments: {
            select: {
              id: true,
              jurisdiction: true,
              staff: {
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

      await tx.activityLog.create({
        data: {
          userId: req.user?.userId,
          actionType: ActionType.CREATE,
          entityType: EntityType.PROJECT,
          entityId: newProject.id,
          description: `Created project: ${newProject.name}`,
        },
      });

      return newProject;
    });

    // Invalidate cache for project lists and dashboard
    invalidateCache('projects:list');
    invalidateCache('dashboard:summary');

    req.log?.info('Project created', { projectId: project.id, name: project.name });

    res.status(201).json(project);
  } catch (error) {
    logger.error('Create project error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const projectId = parseInt(id as string, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const {
      name,
      category,
      status,
      priority,
      elStatus,
      timetable,
      filingDate,
      listingDate,
      bcAttorney,
      side,
      sector,
      notes,
      lifecycleStage,
      cmNumber,
    } = req.body;

    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const nextLifecycleStage = deriveLifecycleStage({
      lifecycleStage,
      timetable: timetable !== undefined ? timetable : existingProject.timetable,
      elStatus: elStatus !== undefined ? elStatus : existingProject.elStatus,
      fallbackLifecycleStage: existingProject.lifecycleStage,
    });

    const updateData: Prisma.ProjectUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (elStatus !== undefined) updateData.elStatus = elStatus;
    if (timetable !== undefined) updateData.timetable = timetable;
    if (filingDate !== undefined) updateData.filingDate = filingDate ? new Date(filingDate) : null;
    if (listingDate !== undefined) updateData.listingDate = listingDate ? new Date(listingDate) : null;
    if (bcAttorney !== undefined) updateData.bcAttorney = bcAttorney;
    if (side !== undefined) updateData.side = side;
    if (sector !== undefined) updateData.sector = sector;
    if (notes !== undefined) updateData.notes = notes;
    if (cmNumber !== undefined) updateData.cmNumber = cmNumber || null;
    if (nextLifecycleStage !== existingProject.lifecycleStage) {
      updateData.lifecycleStage = nextLifecycleStage;
      updateData.lifecycleStageChangedAt = new Date();
      if (req.user?.userId) {
        updateData.lifecycleChangedBy = { connect: { id: req.user.userId } };
      }
      updateData.stageVersion = { increment: 1 };
    }

    // Note: Confirmation metadata (lastConfirmedAt, confirmedBy) is only updated
    // via the dedicated POST /:id/confirm endpoint, not on regular updates

    await trackFieldChanges({
      entityId: projectId,
      entityType: 'project',
      oldData: existingProject,
      newData: updateData,
      userId: req.user?.userId,
    });

    const project = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: updateData,
        // Optimized with selective fields for performance
        select: {
          id: true,
          name: true,
          cmNumber: true,
          category: true,
          status: true,
          lifecycleStage: true,
          stageVersion: true,
          priority: true,
          elStatus: true,
          timetable: true,
          filingDate: true,
          listingDate: true,
          bcAttorney: true,
          side: true,
          sector: true,
          notes: true,
          lastConfirmedAt: true,
          lastConfirmedBy: true,
          lifecycleStageChangedAt: true,
          lifecycleStageChangedBy: true,
          confirmedBy: {
            select: {
              id: true,
              username: true,
              staff: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          createdAt: true,
          updatedAt: true,
          assignments: {
            select: {
              id: true,
              jurisdiction: true,
              staff: {
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

      await tx.activityLog.create({
        data: {
          userId: req.user?.userId,
          actionType: ActionType.UPDATE,
          entityType: EntityType.PROJECT,
          entityId: updatedProject.id,
          description: `Updated project: ${updatedProject.name}`,
        },
      });

      return updatedProject;
    });

    const changes = detectProjectChanges(existingProject, project);
    if (changes.length > 0) {
      const assignedStaff = await prisma.projectAssignment.findMany({
        where: { projectId },
        include: {
          staff: {
            select: {
              id: true,
              name: true,
              email: true,
              position: true,
            },
          },
        },
      });

      const emailDataList = assignedStaff
        .filter((assignment) => assignment.staff.email)
        .map((assignment) => ({
          staffEmail: assignment.staff.email!,
          staffName: assignment.staff.name,
          staffPosition: assignment.staff.position,
          projectId: project.id,
          projectName: project.name,
          projectCategory: project.category,
          changes,
        }));

      if (emailDataList.length > 0) {
        sendProjectUpdateEmails(emailDataList).catch((err) => {
          req.log?.error('Failed to send project update emails', {
            projectId: project.id,
            error: err,
          });
        });
      }
    }

    // Invalidate cache for this project, project lists, and dashboard
    invalidateCache(CACHE_KEYS.PROJECT_DETAIL(projectId));
    invalidateCache(`project:change-history:v2:${projectId}`); // All limits for this project
    invalidateCache('projects:list');
    invalidateCache('dashboard:summary');

    // Process milestone triggers if status or lifecycle stage changed
    const statusChanged = status !== undefined && status !== existingProject.status;
    const lifecycleStageChanged = nextLifecycleStage !== existingProject.lifecycleStage;
    if (statusChanged || lifecycleStageChanged) {
      // Fire and forget - don't block the response
      ProjectEventTriggerService.processProjectTransition({
        projectId,
        oldStatus: existingProject.status,
        newStatus: status ?? existingProject.status,
        oldLifecycleStage: existingProject.lifecycleStage,
        newLifecycleStage: nextLifecycleStage,
        userId: req.user?.userId,
      }).then((result) => {
        if (result.triggersCreated > 0 || result.eventsCreated > 0) {
          req.log?.info('Project transition events/triggers processed', {
            projectId,
            oldStatus: existingProject.status,
            newStatus: status ?? existingProject.status,
            oldLifecycleStage: existingProject.lifecycleStage,
            newLifecycleStage: nextLifecycleStage,
            eventsCreated: result.eventsCreated,
            triggersCreated: result.triggersCreated,
          });
        }
      }).catch((err) => {
        req.log?.error('Failed to process project transition triggers', {
          projectId,
          error: err,
        });
      });

      // Legacy status trigger compatibility path
      if (statusChanged) {
        ProjectStatusTriggerService.processStatusChange(
          projectId,
          existingProject.status,
          status as string
        ).catch((err) => {
          req.log?.error('Failed to process legacy status triggers', {
            projectId,
            error: err,
          });
        });
      }
    }

    req.log?.info('Project updated', { projectId: project.id, changes: changes.length });

    res.json(project);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return res.status(409).json({ error: 'This C/M number is already assigned to another project' });
    }
    logger.error('Update project error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const projectId = parseInt(id as string, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.delete({ where: { id: projectId } });
      await tx.activityLog.create({
        data: {
          userId: req.user?.userId,
          actionType: ActionType.DELETE,
          entityType: EntityType.PROJECT,
          entityId: projectId,
          description: `Deleted project: ${project.name}`,
        },
      });
    });

    // Invalidate cache for this project, project lists, and dashboard
    invalidateCache(CACHE_KEYS.PROJECT_DETAIL(projectId));
    invalidateCache('projects:list');
    invalidateCache('dashboard:summary');

    req.log?.warn('Project deleted', { projectId, name: project.name });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    logger.error('Delete project error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjectCategories = async (_req: AuthRequest, res: Response) => {
  const categories = await prisma.project.findMany({
    select: { category: true },
    distinct: ['category'],
  });

  res.json(categories.map((c) => c.category));
};

export const getProjectChangeHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50' } = req.query; // Reduced default from 100 to 50

    const projectId = parseInt(id as string, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const limitNum = parseQueryInt(limit as string, { default: 50, min: 1, max: 100 }); // Reduced max from 500 to 100

    // Generate cache key for change history
    const cacheKey = CACHE_KEYS.PROJECT_CHANGE_HISTORY(projectId, limitNum);

    // Try to get from cache first
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    if (wasValueClamped(limit as string, limitNum, { max: 100 })) {
      req.log?.warn('Project change history limit clamped', {
        userId: req.user?.userId,
        requested: limit,
        used: limitNum,
      });
    }

    const changes = await prisma.projectChangeHistory.findMany({
      where: {
        projectId,
      },
      include: {
        user: {
          select: { username: true },
        },
      },
      orderBy: { changedAt: 'desc' },
      take: limitNum,
    });

    const response = changes.map((change) => ({
      id: change.id,
      fieldName: change.fieldName,
      oldValue: change.oldValue,
      newValue: change.newValue,
      changeType: change.changeType,
      username: change.user?.username || 'System',
      changedAt: change.changedAt,
    }));

    // Cache the response
    setCached(cacheKey, response);

    res.json(response);
  } catch (error) {
    logger.error('Get project change history error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Calculate days since project was last confirmed
 */
const getDaysSinceConfirmed = (lastConfirmedAt: Date | null): number => {
  return lastConfirmedAt
    ? Math.floor((Date.now() - lastConfirmedAt.getTime()) / (1000 * 60 * 60 * 24))
    : 999;
};

/**
 * Check if project was updated since last confirmation
 */
const wasUpdatedSinceConfirmation = (lastConfirmedAt: Date | null, updatedAt: Date): boolean => {
  return lastConfirmedAt
    ? updatedAt.getTime() - lastConfirmedAt.getTime() > 1000
    : true;
};

/**
 * Check if project is a transaction project (HK Trx or US Trx)
 */
const isTrxProject = (category: string): boolean => {
  return category === ProjectCategory.HK_TRX || category === ProjectCategory.US_TRX;
};

/**
 * Get attention reasons for a project
 */
const getAttentionReasons = (
  project: ProjectWithHistory,
  daysSinceConfirmed: number,
  changedSinceConfirmed: boolean,
  sevenDaysAgo: Date
): string[] => {
  const reasons: string[] = [];

  // Not confirmed in 7+ days
  if (daysSinceConfirmed > 7) {
    reasons.push(daysSinceConfirmed === 999
      ? 'Never confirmed'
      : `Not reviewed in ${daysSinceConfirmed} days`);
  }

  // Updated since last confirmation
  if (changedSinceConfirmed && project.lastConfirmedAt) {
    reasons.push('Updated since last confirmation');
  }

  // BC Attorney not assigned for Trx projects
  if (isTrxProject(project.category) && !project.bcAttorney) {
    reasons.push('BC Attorney not assigned');
  }

  // No team assigned
  if (project.assignments.length === 0) {
    reasons.push('No team assigned');
  }

  // Filing date not set for active Trx projects
  if (project.status === ProjectStatus.ACTIVE && !project.filingDate && isTrxProject(project.category)) {
    reasons.push('Filing date not set');
  }

  // Recent status change
  const recentStatusChange = project.changeHistory.find(
    (change) =>
      change.fieldName === 'status' &&
      change.changedAt > sevenDaysAgo &&
      (!project.lastConfirmedAt || change.changedAt > project.lastConfirmedAt)
  );

  if (recentStatusChange) {
    reasons.push(`Status changed: ${recentStatusChange.oldValue} → ${recentStatusChange.newValue}`);
  }

  // Recent team changes
  const recentTeamChanges = project.changeHistory.filter(
    (change) =>
      (change.changeType === 'assignment_added' || change.changeType === 'assignment_removed') &&
      change.changedAt > sevenDaysAgo &&
      (!project.lastConfirmedAt || change.changedAt > project.lastConfirmedAt)
  );

  if (recentTeamChanges.length > 0) {
    reasons.push('Team composition changed');
  }

  return reasons;
};

/**
 * Calculate urgency score for a project
 */
const calculateUrgencyScore = (
  daysSinceConfirmed: number,
  reasons: string[],
  changedSinceConfirmed: boolean,
  hasRecentStatusChange: boolean
): number => {
  return (
    (hasRecentStatusChange ? 100 : 0) +
    (reasons.some((r) => r.includes('not assigned') || r.includes('not set')) ? 80 : 0) +
    daysSinceConfirmed * 2 +
    (changedSinceConfirmed ? 10 : 0)
  );
};

/**
 * Type definition for project with history
 */
type ProjectWithHistory = Prisma.ProjectGetPayload<{
  select: {
    id: true;
    name: true;
    category: true;
    status: true;
    priority: true;
    bcAttorney: true;
    filingDate: true;
    listingDate: true;
    lastConfirmedAt: true;
    updatedAt: true;
    assignments: {
      select: {
        id: true;
        staff: { select: { id: true } };
      };
    };
    changeHistory: {
      select: {
        fieldName: true;
        oldValue: true;
        newValue: true;
        changeType: true;
        changedAt: true;
      };
    };
  };
}>;

export const confirmProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projectId = parseInt(id as string, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        lastConfirmedAt: new Date(),
        confirmedBy: {
          connect: { id: userId },
        },
      },
      include: {
        confirmedBy: {
          select: {
            id: true,
            username: true,
            staff: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    req.log?.info('Project confirmed', { projectId, userId });

    res.json({
      message: 'Project confirmed successfully',
      project: updatedProject,
    });
  } catch (error) {
    logger.error('Confirm project error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjectsNeedingAttention = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Generate cache key for this user's attention projects
    const cacheKey = CACHE_KEYS.DASHBOARD_SUMMARY(`attention:${userId}`);

    // Try to get from cache first
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        staff: {
          select: {
            id: true,
          },
        },
      },
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const projectFilter: Prisma.ProjectWhereInput = {};

    if (user?.staff) {
      projectFilter.assignments = {
        some: {
          staffId: user.staff.id,
        },
      };
    }

    // Optimized query with minimal fields needed for attention analysis
    const projects = await prisma.project.findMany({
      where: projectFilter,
      select: {
        id: true,
        name: true,
        category: true,
        status: true,
        priority: true,
        bcAttorney: true,
        filingDate: true,
        listingDate: true,
        lastConfirmedAt: true,
        updatedAt: true,
        assignments: {
          select: {
            id: true,
            staff: {
              select: {
                id: true,
              },
            },
          },
        },
        // Only load recent status changes for attention analysis
        changeHistory: {
          where: {
            OR: [
              { fieldName: 'status' },
              { changeType: { in: ['assignment_added', 'assignment_removed'] } },
            ],
            changedAt: { gte: sevenDaysAgo },
          },
          select: {
            fieldName: true,
            oldValue: true,
            newValue: true,
            changeType: true,
            changedAt: true,
          },
          orderBy: { changedAt: 'desc' },
          take: 5, // Limit to most recent 5 relevant changes
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    type AttentionProject = ProjectWithHistory & {
      attentionReasons: string[];
      urgencyScore: number;
    };

    const needsAttention: AttentionProject[] = [];
    const allGood: ProjectWithHistory[] = [];

    for (const project of projects) {
      const daysSinceConfirmed = getDaysSinceConfirmed(project.lastConfirmedAt);
      const changedSinceConfirmed = wasUpdatedSinceConfirmation(project.lastConfirmedAt, project.updatedAt);
      const reasons = getAttentionReasons(project, daysSinceConfirmed, changedSinceConfirmed, sevenDaysAgo);

      if (reasons.length > 0) {
        const recentStatusChange = reasons.some(r => r.startsWith('Status changed'));
        needsAttention.push({
          ...project,
          attentionReasons: reasons,
          urgencyScore: calculateUrgencyScore(daysSinceConfirmed, reasons, changedSinceConfirmed, recentStatusChange),
        });
      } else {
        allGood.push(project);
      }
    }

    needsAttention.sort((a, b) => b.urgencyScore - a.urgencyScore);

    res.json({
      needsAttention,
      allGood,
      summary: {
        totalProjects: projects.length,
        needingAttention: needsAttention.length,
        allGood: allGood.length,
      },
    });
  } catch (error) {
    logger.error('Get projects needing attention error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};
