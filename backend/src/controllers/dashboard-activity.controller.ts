import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { parseQueryInt, wasValueClamped } from '../utils/queryParsing';
import { ActivityLogWhereInput } from '../types/prisma';
import { logger } from '../utils/logger';

/**
 * Get activity log with pagination and optional entity type filtering
 */
export const getActivityLog = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '50', page = '1', entityType } = req.query;

    const limitNum = parseQueryInt(limit as string, { default: 50, min: 1, max: 100 });
    const pageNum = parseQueryInt(page as string, { default: 1, min: 1 });
    const skip = (pageNum - 1) * limitNum;

    if (wasValueClamped(limit as string, limitNum, { max: 100 })) {
      logger.warn('Activity log limit clamped', { limit: limitNum, userId: req.user?.userId });
    }

    // Build where clause
    const where: ActivityLogWhereInput = {};
    if (entityType) {
      where.entityType = entityType as string;
    }

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        take: limitNum,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { username: true },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      data: activities.map((activity) => ({
        id: activity.id,
        actionType: activity.actionType,
        entityType: activity.entityType,
        entityId: activity.entityId,
        description: activity.description,
        username: activity.user?.username || 'System',
        createdAt: activity.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get activity log error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};
