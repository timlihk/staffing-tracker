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
    // Create B&C attorney (database constraints will handle validation)
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

    // Invalidate cache
    invalidateCache(CACHE_KEYS.PROJECT_DETAIL(parsedProjectId));
    invalidateCache('projects:list');

    req.log?.info('B&C attorney added', {
      projectId: parsedProjectId,
      staffId: parsedStaffId,
      bcAttorneyId: bcAttorney.id
    });

    res.status(201).json(bcAttorney);
  } catch (error: any) {
    console.error('Add B&C attorney error:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'B&C attorney already exists for this project' });
    }

    // Handle foreign key constraint violation
    if (error.code === 'P2003') {
      return res.status(404).json({ error: 'Project or staff member not found' });
    }

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
    // Delete B&C attorney directly (database will handle "not found" case)
    await prisma.projectBcAttorney.delete({
      where: {
        projectId_staffId: {
          projectId: parsedProjectId,
          staffId: parsedStaffId,
        },
      },
    });

    // Invalidate cache
    invalidateCache(CACHE_KEYS.PROJECT_DETAIL(parsedProjectId));
    invalidateCache('projects:list');

    req.log?.info('B&C attorney removed', {
      projectId: parsedProjectId,
      staffId: parsedStaffId,
    });

    res.json({ message: 'B&C attorney removed successfully' });
  } catch (error: any) {
    console.error('Remove B&C attorney error:', error);

    // Handle record not found
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'B&C attorney not found' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};