import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma, { getCached, setCached, invalidateCache, CACHE_KEYS } from '../utils/prisma';
import { trackFieldChanges } from '../utils/changeTracking';
import { detectProjectChanges, sendProjectUpdateEmails } from '../services/email.service';
import { parseQueryInt, wasValueClamped } from '../utils/queryParsing';
import type { Prisma } from '@prisma/client';

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
          category: true,
          status: true,
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

    const response = {
      data: projects,
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
    console.error('Get all projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjectById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const projectId = parseInt(id, 10);
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

    // Cache the project
    setCached(cacheKey, project);

    res.json(project);
  } catch (error) {
    console.error('Get project by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
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
  } = req.body;

  if (!name || !category || !status) {
    return res.status(400).json({ error: 'Project name, category, and status are required' });
  }

  const project = await prisma.project.create({
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
    },
    // Optimized with selective fields for performance
    select: {
      id: true,
      name: true,
      category: true,
      status: true,
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

  await prisma.activityLog.create({
    data: {
      userId: req.user?.userId,
      actionType: 'create',
      entityType: 'project',
      entityId: project.id,
      description: `Created project: ${project.name}`,
    },
  });

  // Invalidate cache for project lists and dashboard
  invalidateCache('projects:list');
  invalidateCache('dashboard:summary');

  req.log?.info('Project created', { projectId: project.id, name: project.name });

  res.status(201).json(project);
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const projectId = parseInt(id, 10);
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
  } = req.body;

  const existingProject = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!existingProject) {
    return res.status(404).json({ error: 'Project not found' });
  }

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

  // Note: Confirmation metadata (lastConfirmedAt, confirmedBy) is only updated
  // via the dedicated POST /:id/confirm endpoint, not on regular updates

  await trackFieldChanges({
    entityId: projectId,
    entityType: 'project',
    oldData: existingProject,
    newData: updateData,
    userId: req.user?.userId,
  });

  const project = await prisma.project.update({
    where: { id: projectId },
    data: updateData,
    // Optimized with selective fields for performance
    select: {
      id: true,
      name: true,
      category: true,
      status: true,
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

  await prisma.activityLog.create({
    data: {
      userId: req.user?.userId,
      actionType: 'update',
      entityType: 'project',
      entityId: project.id,
      description: `Updated project: ${project.name}`,
    },
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
  invalidateCache('projects:list');
  invalidateCache('dashboard:summary');

  req.log?.info('Project updated', { projectId: project.id, changes: changes.length });

  res.json(project);
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const projectId = parseInt(id, 10);
  if (Number.isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  await prisma.project.delete({ where: { id: projectId } });

  await prisma.activityLog.create({
    data: {
      userId: req.user?.userId,
      actionType: 'delete',
      entityType: 'project',
      entityId: projectId,
      description: `Deleted project: ${project.name}`,
    },
  });

  // Invalidate cache for this project, project lists, and dashboard
  invalidateCache(CACHE_KEYS.PROJECT_DETAIL(projectId));
  invalidateCache('projects:list');
  invalidateCache('dashboard:summary');

  req.log?.warn('Project deleted', { projectId, name: project.name });

  res.json({ message: 'Project deleted successfully' });
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

    const projectId = parseInt(id, 10);
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
    console.error('Get project change history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const confirmProject = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const projectId = parseInt(id, 10);
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
};

export const getProjectsNeedingAttention = async (req: AuthRequest, res: Response) => {
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

  type AttentionProject = (typeof projects)[number] & {
    attentionReasons: string[];
    urgencyScore: number;
  };

  const needsAttention: AttentionProject[] = [];
  const allGood: typeof projects = [];

  for (const project of projects) {
    const reasons: string[] = [];

    const daysSinceConfirmed = project.lastConfirmedAt
      ? Math.floor((Date.now() - project.lastConfirmedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceConfirmed > 7) {
      reasons.push(daysSinceConfirmed === 999
        ? 'Never confirmed'
        : `Not reviewed in ${daysSinceConfirmed} days`);
    }

    const changedSinceConfirmed = project.lastConfirmedAt
      ? project.updatedAt.getTime() - project.lastConfirmedAt.getTime() > 1000
      : true;

    if (changedSinceConfirmed && project.lastConfirmedAt) {
      reasons.push('Updated since last confirmation');
    }

    const isTrxProject = ['HK Trx', 'US Trx'].includes(project.category);
    if (isTrxProject && !project.bcAttorney) {
      reasons.push('BC Attorney not assigned');
    }

    if (project.assignments.length === 0) {
      reasons.push('No team assigned');
    }

    if (project.status === 'Active' && !project.filingDate && isTrxProject) {
      reasons.push('Filing date not set');
    }

    const recentStatusChange = project.changeHistory.find(
      (change) =>
        change.fieldName === 'status' &&
        change.changedAt > sevenDaysAgo &&
        (!project.lastConfirmedAt || change.changedAt > project.lastConfirmedAt)
    );

    if (recentStatusChange) {
      reasons.push(`Status changed: ${recentStatusChange.oldValue} → ${recentStatusChange.newValue}`);
    }

    const recentTeamChanges = project.changeHistory.filter(
      (change) =>
        (change.changeType === 'assignment_added' || change.changeType === 'assignment_removed') &&
        change.changedAt > sevenDaysAgo &&
        (!project.lastConfirmedAt || change.changedAt > project.lastConfirmedAt)
    );

    if (recentTeamChanges.length > 0) {
      reasons.push('Team composition changed');
    }

    if (reasons.length > 0) {
      needsAttention.push({
        ...project,
        attentionReasons: reasons,
        urgencyScore:
          (recentStatusChange ? 100 : 0) +
          (reasons.some((r) => r.includes('not assigned') || r.includes('not set')) ? 80 : 0) +
          daysSinceConfirmed * 2 +
          (changedSinceConfirmed ? 10 : 0),
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
};
