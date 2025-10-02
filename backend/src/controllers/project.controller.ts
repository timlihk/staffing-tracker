import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { trackFieldChanges } from '../utils/changeTracking';

export const getAllProjects = async (req: AuthRequest, res: Response) => {
  try {
    const { status, category, search, page = '1', limit = '50' } = req.query;

    const where: any = {};

    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      where.OR = [
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
      projectCode,
      category,
      status,
      priority,
      elStatus,
      timetable,
      actualFilingDate,
      bcAttorney,
      notes,
    } = req.body;

    if (!projectCode || !category || !status) {
      return res.status(400).json({ error: 'Project code, category, and status are required' });
    }

    const project = await prisma.project.create({
      data: {
        projectCode,
        category,
        status,
        priority,
        elStatus,
        timetable,
        actualFilingDate: actualFilingDate ? new Date(actualFilingDate) : null,
        bcAttorney,
        notes,
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
        description: `Created project: ${project.projectCode}`,
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
      projectCode,
      category,
      status,
      priority,
      elStatus,
      timetable,
      actualFilingDate,
      bcAttorney,
      notes,
    } = req.body;

    const existingProject = await prisma.project.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Build update data
    const updateData: any = {};
    if (projectCode !== undefined) updateData.projectCode = projectCode;
    if (category) updateData.category = category;
    if (status) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (elStatus !== undefined) updateData.elStatus = elStatus;
    if (timetable !== undefined) updateData.timetable = timetable;
    if (actualFilingDate !== undefined) updateData.actualFilingDate = actualFilingDate ? new Date(actualFilingDate) : null;
    if (bcAttorney !== undefined) updateData.bcAttorney = bcAttorney;
    if (notes !== undefined) updateData.notes = notes;

    // Track all field changes
    await trackFieldChanges({
      entityId: parseInt(id),
      entityType: 'project',
      oldData: existingProject,
      newData: updateData,
      userId: req.user?.userId,
    });

    const project = await prisma.project.update({
      where: { id: parseInt(id) },
      data: updateData,
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
        description: `Updated project: ${project.projectCode}`,
      },
    });

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
        description: `Deleted project: ${project.projectCode}`,
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

export const getProjectChangeHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '100' } = req.query;

    const limitNum = parseInt(limit as string);

    const changes = await prisma.projectChangeHistory.findMany({
      where: {
        projectId: parseInt(id),
      },
      include: {
        user: {
          select: { username: true },
        },
      },
      orderBy: { changedAt: 'desc' },
      take: limitNum,
    });

    res.json(
      changes.map((change) => ({
        id: change.id,
        fieldName: change.fieldName,
        oldValue: change.oldValue,
        newValue: change.newValue,
        changeType: change.changeType,
        username: change.user?.username || 'System',
        changedAt: change.changedAt,
      }))
    );
  } catch (error) {
    console.error('Get project change history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
