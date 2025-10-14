import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { generateToken, generatePasswordResetToken, verifyPasswordResetToken } from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';
import { ControllerError } from '../types/prisma';
import { logger } from '../utils/logger';

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { staff: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.mustResetPassword) {
      const resetToken = generatePasswordResetToken(user.id);
      return res.status(403).json({
        error: 'Password reset required',
        requiresPasswordReset: true,
        resetToken,
      });
    }

    // Update last login and activity
    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: now,
        lastActivity: now,
      },
    });

    // Log login action for activity tracking
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        actionType: 'login',
        entityType: 'user',
        entityId: user.id,
        description: `User ${user.username} logged in`,
      },
    });

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        mustResetPassword: user.mustResetPassword,
        staff: user.staff,
      },
    });
  } catch (error) {
    logger.error('Login error', {
      error: error instanceof Error ? error.message : String(error),
      username: req.body?.username
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const ALLOWED_ROLES = new Set(['admin', 'editor', 'viewer']);

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, password, role, staffId } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const normalizedRole = typeof role === 'string' && ALLOWED_ROLES.has(role) ? role : 'viewer';

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: normalizedRole,
        staffId: staffId || null,
        mustResetPassword: false,
      },
      include: { staff: true },
    });

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        mustResetPassword: user.mustResetPassword,
        staff: user.staff,
      },
    });
  } catch (error) {
    logger.error('Register error', {
      error: error instanceof Error ? error.message : String(error),
      username: req.body?.username
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const me = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { staff: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      mustResetPassword: user.mustResetPassword,
      staff: user.staff,
      lastLogin: user.lastLogin,
    });
  } catch (error) {
    logger.error('Me endpoint error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const payload = verifyPasswordResetToken(token);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustResetPassword: false,
        lastLogin: now,
        lastActivity: now,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        actionType: 'update',
        entityType: 'user',
        entityId: user.id,
        description: `Password reset for user ${user.username}`,
      },
    });

    res.json({ success: true });
  } catch (error: ControllerError) {
    logger.error('Reset password error', {
      error: error instanceof Error ? error.message : String(error)
    });
    if (error && typeof error === 'object' && 'message' in error && error.message === 'Invalid password reset token') {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};
