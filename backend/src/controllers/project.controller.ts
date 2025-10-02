import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

export const getAllProjects = async (req: AuthRequest, res: Response) => {
  try {
    const { status, category, search, page = '1', limit = '50' } = req.query;

    const where: any = {};

    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { projectCode: { contains: search as string, mode: 'insensitive' } },
        { notes: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          assignments: {
            include: { staff: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.project.count({ where }),
    ]);

    res.json({
      data: projects,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjectById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: parseInt(id) },
      include: {
        assignments: {
          include: { staff: true },
        },
        statusHistory: {
          include: { user: { select: { username: true } } },
          orderBy: { changedAt: 'desc' },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      projectCode,
      category,
      status,
      priority,
      startDate,
      targetFilingDate,
      actualFilingDate,
      notes,
      timelineStatus,
    } = req.body;

    if (!name || !category || !status) {
      return res.status(400).json({ error: 'Name, category, and status are required' });
    }

    const project = await prisma.project.create({
      data: {
        name,
        projectCode,
        category,
        status,
        priority,
        startDate: startDate ? new Date(startDate) : null,
        targetFilingDate: targetFilingDate ? new Date(targetFilingDate) : null,
        actualFilingDate: actualFilingDate ? new Date(actualFilingDate) : null,
        notes,
        timelineStatus,
      },
      include: {
        assignments: {
          include: { staff: true },
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'create',
        entityType: 'project',
        entityId: project.id,
        description: `Created project: ${project.name}`,
      },
    });

    // Create initial status history
    await prisma.projectStatusHistory.create({
      data: {
        projectId: project.id,
        newStatus: status,
        changedBy: req.user?.userId,
        changeReason: 'Project created',
      },
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      projectCode,
      category,
      status,
      priority,
      startDate,
      targetFilingDate,
      actualFilingDate,
      notes,
      timelineStatus,
    } = req.body;

    const existingProject = await prisma.project.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = await prisma.project.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(projectCode !== undefined && { projectCode }),
        ...(category && { category }),
        ...(status && { status }),
        ...(priority !== undefined && { priority }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(targetFilingDate !== undefined && { targetFilingDate: targetFilingDate ? new Date(targetFilingDate) : null }),
        ...(actualFilingDate !== undefined && { actualFilingDate: actualFilingDate ? new Date(actualFilingDate) : null }),
        ...(notes !== undefined && { notes }),
        ...(timelineStatus !== undefined && { timelineStatus }),
      },
      include: {
        assignments: {
          include: { staff: true },
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'update',
        entityType: 'project',
        entityId: project.id,
        description: `Updated project: ${project.name}`,
      },
    });

    // Track status change
    if (status && status !== existingProject.status) {
      await prisma.projectStatusHistory.create({
        data: {
          projectId: project.id,
          oldStatus: existingProject.status,
          newStatus: status,
          changedBy: req.user?.userId,
        },
      });
    }

    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: parseInt(id) },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await prisma.project.delete({
      where: { id: parseInt(id) },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'delete',
        entityType: 'project',
        entityId: parseInt(id),
        description: `Deleted project: ${project.name}`,
      },
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjectCategories = async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.project.findMany({
      select: { category: true },
      distinct: ['category'],
    });

    res.json(categories.map((c) => c.category));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjectActivityLog = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50' } = req.query;

    const limitNum = parseInt(limit as string);

    const activities = await prisma.activityLog.findMany({
      where: {
        entityType: 'project',
        entityId: parseInt(id),
      },
      include: {
        user: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
    });

    res.json(
      activities.map((activity) => ({
        id: activity.id,
        actionType: activity.actionType,
        entityType: activity.entityType,
        description: activity.description,
        username: activity.user?.username || 'System',
        createdAt: activity.createdAt,
      }))
    );
  } catch (error) {
    console.error('Get project activity log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
