import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma, { invalidateCache, CACHE_KEYS } from '../utils/prisma';

export const addBcAttorney = async (req: AuthRequest, res: Response) => {
  const { id: projectId } = req.params;
  const { staffId } = req.body;

  if (!staffId) {
    return res.status(400).json({ error: 'Staff ID is required' });
  }

  const parsedProjectId = parseInt(projectId, 10);
  const parsedStaffId = parseInt(staffId, 10);

  if (Number.isNaN(parsedProjectId) || Number.isNaN(parsedStaffId)) {
    return res.status(400).json({ error: 'Invalid project ID or staff ID' });
  }

  try {
    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: parsedProjectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if staff exists
    const staff = await prisma.staff.findUnique({
      where: { id: parsedStaffId },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Check if B&C attorney already exists
    const existingBcAttorney = await prisma.projectBcAttorney.findUnique({
      where: {
        projectId_staffId: {
          projectId: parsedProjectId,
          staffId: parsedStaffId,
        },
      },
    });

    if (existingBcAttorney) {
      return res.status(409).json({ error: 'B&C attorney already exists for this project' });
    }

    // Create B&C attorney
    const bcAttorney = await prisma.projectBcAttorney.create({
      data: {
        projectId: parsedProjectId,
        staffId: parsedStaffId,
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            position: true,
          },
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'create',
        entityType: 'bc_attorney',
        entityId: bcAttorney.id,
        description: `Added B&C attorney: ${staff.name} to project: ${project.name}`,
      },
    });

    // Invalidate cache
    invalidateCache(CACHE_KEYS.PROJECT_DETAIL(parsedProjectId));
    invalidateCache('projects:list');

    req.log?.info('B&C attorney added', {
      projectId: parsedProjectId,
      staffId: parsedStaffId,
      bcAttorneyId: bcAttorney.id
    });

    res.status(201).json(bcAttorney);
  } catch (error) {
    console.error('Add B&C attorney error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeBcAttorney = async (req: AuthRequest, res: Response) => {
  const { id: projectId, staffId } = req.params;

  const parsedProjectId = parseInt(projectId, 10);
  const parsedStaffId = parseInt(staffId, 10);

  if (Number.isNaN(parsedProjectId) || Number.isNaN(parsedStaffId)) {
    return res.status(400).json({ error: 'Invalid project ID or staff ID' });
  }

  try {
    // Check if B&C attorney exists
    const bcAttorney = await prisma.projectBcAttorney.findUnique({
      where: {
        projectId_staffId: {
          projectId: parsedProjectId,
          staffId: parsedStaffId,
        },
      },
      include: {
        project: {
          select: {
            name: true,
          },
        },
        staff: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!bcAttorney) {
      return res.status(404).json({ error: 'B&C attorney not found' });
    }

    // Delete B&C attorney
    await prisma.projectBcAttorney.delete({
      where: {
        projectId_staffId: {
          projectId: parsedProjectId,
          staffId: parsedStaffId,
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'delete',
        entityType: 'bc_attorney',
        entityId: bcAttorney.id,
        description: `Removed B&C attorney: ${bcAttorney.staff.name} from project: ${bcAttorney.project.name}`,
      },
    });

    // Invalidate cache
    invalidateCache(CACHE_KEYS.PROJECT_DETAIL(parsedProjectId));
    invalidateCache('projects:list');

    req.log?.info('B&C attorney removed', {
      projectId: parsedProjectId,
      staffId: parsedStaffId,
      bcAttorneyId: bcAttorney.id
    });

    res.json({ message: 'B&C attorney removed successfully' });
  } catch (error) {
    console.error('Remove B&C attorney error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};