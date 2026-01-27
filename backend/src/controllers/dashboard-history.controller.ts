import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { parseQueryInt, wasValueClamped } from '../utils/queryParsing';
import { logger } from '../utils/logger';

/**
 * Get detailed change history for staff and/or projects
 * Supports filtering by entity type
 */
export const getDetailedChangeHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '100', entityType } = req.query;
    const limitNum = parseQueryInt(limit as string, { default: 100, min: 1, max: 500 });

    if (wasValueClamped(limit as string, limitNum, { max: 500 })) {
      logger.warn('Change history limit clamped', { limit: limitNum, userId: req.user?.userId });
    }

    if (entityType === 'staff') {
      const changes = await prisma.staffChangeHistory.findMany({
        take: limitNum,
        orderBy: { changedAt: 'desc' },
        include: {
          user: { select: { username: true } },
          staff: { select: { id: true, name: true } },
        },
      });

      res.json({
        data: changes.map((change) => ({
          id: change.id,
          entityType: 'staff',
          entityId: change.staffId,
          entityName: change.staff.name,
          actionType: change.changeType,
          fieldName: change.fieldName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          username: change.user?.username || 'System',
          createdAt: change.changedAt,
        })),
      });
    } else if (entityType === 'project') {
      const changes = await prisma.projectChangeHistory.findMany({
        take: limitNum,
        orderBy: { changedAt: 'desc' },
        include: {
          user: { select: { username: true } },
          project: { select: { id: true, name: true } },
        },
      });

      res.json({
        data: changes.map((change) => ({
          id: change.id,
          entityType: 'project',
          entityId: change.projectId,
          entityName: change.project.name,
          actionType: change.changeType,
          fieldName: change.fieldName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          username: change.user?.username || 'System',
          createdAt: change.changedAt,
        })),
      });
    } else {
      // Get both staff and project changes
      const [staffChanges, projectChanges] = await Promise.all([
        prisma.staffChangeHistory.findMany({
          take: Math.floor(limitNum / 2),
          orderBy: { changedAt: 'desc' },
          include: {
            user: { select: { username: true } },
            staff: { select: { id: true, name: true } },
          },
        }),
        prisma.projectChangeHistory.findMany({
          take: Math.floor(limitNum / 2),
          orderBy: { changedAt: 'desc' },
          include: {
            user: { select: { username: true } },
            project: { select: { id: true, name: true } },
          },
        }),
      ]);

      const combined = [
        ...staffChanges.map((change) => ({
          id: `staff-${change.id}`,
          entityType: 'staff' as const,
          entityId: change.staffId,
          entityName: change.staff.name,
          actionType: change.changeType,
          fieldName: change.fieldName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          username: change.user?.username || 'System',
          createdAt: change.changedAt,
        })),
        ...projectChanges.map((change) => ({
          id: `project-${change.id}`,
          entityType: 'project' as const,
          entityId: change.projectId,
          entityName: change.project.name,
          actionType: change.changeType,
          fieldName: change.fieldName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          username: change.user?.username || 'System',
          createdAt: change.changedAt,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({ data: combined.slice(0, limitNum) });
    }
  } catch (error) {
    logger.error('Get detailed change history error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};
