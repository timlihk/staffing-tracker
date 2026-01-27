import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { generateTempPassword } from '../utils/password';
import { sendWelcomeEmail } from '../services/email.service';
import { ControllerError } from '../types/prisma';
import { Prisma } from '@prisma/client';
import config from '../config';
import { logger } from '../utils/logger';

const ALLOWED_ROLES = new Set(['admin', 'editor', 'viewer']);

interface UserWithStats {
  id: number;
  username: string;
  email: string;
  role: string;
  mustResetPassword: boolean;
  lastLogin: Date | null;
  lastActivity: Date | null;
  staff?: { id: number; name: string } | null;
  recentActionCount?: number;
}

const sanitizeUser = (user: UserWithStats) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  mustResetPassword: user.mustResetPassword,
  lastLogin: user.lastLogin,
  lastActivity: user.lastActivity,
  staff: user.staff ? { id: user.staff.id, name: user.staff.name } : null,
  recentActionCount: user.recentActionCount || 0,
});

export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    // Calculate date for "last 7 days"
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const users = await prisma.user.findMany({
      orderBy: { username: 'asc' },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get activity counts for all users in a single query
    const activityCounts = await prisma.activityLog.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      _count: {
        userId: true,
      },
    });

    // Create a map of userId -> count for quick lookup
    const activityCountMap = new Map(
      activityCounts.map((ac) => [ac.userId, ac._count.userId])
    );

    // Combine users with their activity counts
    const usersWithStats = users.map((user) => ({
      ...user,
      recentActionCount: activityCountMap.get(user.id) || 0,
    }));

    res.json(usersWithStats.map(sanitizeUser));
  } catch (error) {
    logger.error('List users error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

interface CreateUserBody {
  username: string;
  email: string;
  role?: string;
  staffId?: number | null;
}

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, role, staffId }: CreateUserBody = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const normalizedRole = typeof role === 'string' && ALLOWED_ROLES.has(role) ? role : 'viewer';
    const staffIdValue = staffId === undefined || staffId === null ? null : Number(staffId);

    if (staffIdValue !== null && Number.isNaN(staffIdValue)) {
      return res.status(400).json({ error: 'Invalid staffId' });
    }
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, config.security.bcryptRounds);

    const user = await prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        role: normalizedRole,
        passwordHash,
        mustResetPassword: true,
        staffId: staffIdValue,
      },
      include: {
        staff: {
          select: { id: true, name: true },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'create',
        entityType: 'user',
        entityId: user.id,
        description: `Created user ${user.username}`,
      },
    });

    // Send welcome email asynchronously (don't wait for completion)
    sendWelcomeEmail({
      email: user.email,
      username: user.username,
      tempPassword,
    }).catch((err) => {
      logger.error('Failed to send welcome email', { email: user.email, error: err instanceof Error ? err.message : String(err) });
    });

    res.status(201).json({ user: sanitizeUser(user), tempPassword });
  } catch (error) {
    logger.error('Create user error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

interface UpdateUserBody {
  role?: string;
  staffId?: number | null;
}

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role, staffId }: UpdateUserBody = req.body;

    const updateData: Record<string, unknown> = {};

    if (role !== undefined) {
      if (!ALLOWED_ROLES.has(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updateData.role = role;
    }

    if (staffId !== undefined) {
      const staffIdValue = staffId === null ? null : Number(staffId);
      if (staffIdValue !== null && Number.isNaN(staffIdValue)) {
        return res.status(400).json({ error: 'Invalid staffId' });
      }
      updateData.staffId = staffIdValue;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const userId = parseInt(id as string, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        staff: {
          select: { id: true, name: true },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'update',
        entityType: 'user',
        entityId: user.id,
        description: `Updated user ${user.username}`,
      },
    });

    res.json(sanitizeUser(user));
  } catch (error: ControllerError) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    logger.error('Update user error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetUserPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const userId = parseInt(id as string, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, config.security.bcryptRounds);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustResetPassword: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'update',
        entityType: 'user',
        entityId: user.id,
        description: `Password reset for user ${user.username}`,
      },
    });

    res.json({ tempPassword });
  } catch (error) {
    logger.error('Reset user password error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);

    if (Number.isNaN(targetId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (targetId === req.user.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, username: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'admin') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'At least one admin account is required' });
      }
    }

    await prisma.user.delete({ where: { id: targetId } });

    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        actionType: 'delete',
        entityType: 'user',
        entityId: targetId,
        description: `Deleted user ${user.username}`,
      },
    });

    return res.status(204).send();
  } catch (error) {
    logger.error('Delete user error', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Internal server error' });
  }
};
