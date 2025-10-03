import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { generateTempPassword } from '../utils/password';

const ALLOWED_ROLES = new Set(['admin', 'editor', 'viewer']);

const sanitizeUser = (user: any) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  mustResetPassword: user.mustResetPassword,
  lastLogin: user.lastLogin,
  staff: user.staff ? { id: user.staff.id, name: user.staff.name } : null,
});

export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
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

    res.json(users.map(sanitizeUser));
  } catch (error) {
    console.error('List users error:', error);
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
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
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

    res.status(201).json({ user: sanitizeUser(user), tempPassword });
  } catch (error) {
    console.error('Create user error:', error);
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

    const updateData: any = {};

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

    const user = await prisma.user.update({
      where: { id: parseInt(id, 10) },
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
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetUserPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id: parseInt(id, 10) } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

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
    console.error('Reset user password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
