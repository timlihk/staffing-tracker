import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { trackFieldChanges } from '../utils/changeTracking';
import { detectProjectChanges, sendProjectUpdateEmails } from '../services/email.service';

export const getAllProjects = async (req: AuthRequest, res: Response) => {
  try {
    const { status, category, search, staffId, page = '1', limit = '50' } = req.query;

    const where: any = {};

    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { notes: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (staffId) {
      where.assignments = {
        some: {
          staffId: parseInt(staffId as string),
        },
      };
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
    console.log('Create project request body:', JSON.stringify(req.body, null, 2));
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
      notes,
    } = req.body;

    if (!name || !category || !status) {
      return res.status(400).json({ error: 'Project code, category, and status are required' });
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
        description: `Created project: ${project.name}`,
      },
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    console.log('Update project request - ID:', id, 'Body:', JSON.stringify(req.body, null, 2));

    // Validate ID is a number
    const projectId = parseInt(id);
    if (isNaN(projectId)) {
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
      notes,
    } = req.body;

    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (category) updateData.category = category;
    if (status) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (elStatus !== undefined) updateData.elStatus = elStatus;
    if (timetable !== undefined) updateData.timetable = timetable;
    if (filingDate !== undefined) updateData.filingDate = filingDate ? new Date(filingDate) : null;
    if (listingDate !== undefined) updateData.listingDate = listingDate ? new Date(listingDate) : null;
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
        description: `Updated project: ${project.name}`,
      },
    });

    // Send email notifications to assigned staff
    // Compare old project with updated project (not partial updateData) to avoid false "Removed" messages
    const changes = detectProjectChanges(existingProject, project);
    if (changes.length > 0) {
      // Get all staff assigned to this project with email addresses
      const assignedStaff = await prisma.projectAssignment.findMany({
        where: { projectId: parseInt(id) },
        include: {
          staff: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Send emails asynchronously with rate limiting (don't wait for completion)
      const emailDataList = assignedStaff
        .filter(assignment => assignment.staff.email)
        .map(assignment => ({
          staffEmail: assignment.staff.email!,
          staffName: assignment.staff.name,
          projectId: project.id,
          projectName: project.name,
          projectCategory: project.category,
          changes,
        }));

      if (emailDataList.length > 0) {
        sendProjectUpdateEmails(emailDataList).catch((err) => {
          console.error('Failed to send project update emails:', err);
        });
      }
    }

    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
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
