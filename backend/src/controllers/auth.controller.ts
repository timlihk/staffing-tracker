import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import {
  generateToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens
} from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';
import { ControllerError } from '../types/prisma';
import { logger } from '../utils/logger';
import { sanitizeForLogs, safeLogData } from '../utils/sanitize';
import config from '../config';
import {
  UserRole,
  ALLOWED_ROLES,
  HttpStatus,
  ErrorMessage,
  JWTConfig,
  EntityType,
  ActionType
} from '../constants';

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Username and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { staff: true },
    });

    if (!user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid credentials' });
    }

    if (user.mustResetPassword) {
      const resetToken = generatePasswordResetToken(user.id);
      return res.status(HttpStatus.FORBIDDEN).json({
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
        actionType: ActionType.LOGIN,
        entityType: EntityType.USER,
        entityId: user.id,
        description: `User ${user.username} logged in`,
      },
    });

    // Generate access token (short-lived)
    const accessToken = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // Generate refresh token (long-lived) and store in database
    const refreshToken = await generateRefreshToken(user.id);

    // Set refresh token as HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.isProduction, // Only send over HTTPS in production
      sameSite: 'strict',
      maxAge: JWTConfig.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/auth/refresh', // Only send to refresh endpoint
    });

    res.json({
      token: accessToken, // Keep 'token' for backward compatibility with frontend
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
      username: sanitizeForLogs(req.body?.username)
    });
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
  }
};



export const register = async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, password, role, staffId } = req.body;

    if (!username || !email || !password) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Username, email, and password are required' });
    }

    if (!req.user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
    }

    if (req.user.role !== UserRole.ADMIN) {
      return res.status(HttpStatus.FORBIDDEN).json({ error: 'Admin privileges required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);

    const normalizedRole = typeof role === 'string' && ALLOWED_ROLES.has(role) ? role : UserRole.VIEWER;

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
      username: sanitizeForLogs(req.body?.username)
    });
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
  }
};

export const me = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { staff: true },
    });

    if (!user) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'User not found' });
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
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Token and new password are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Password must be at least 8 characters long' });
    }

    // Verify token (this will throw if invalid)
    const payload = verifyPasswordResetToken(token);

    // Check if user exists - use generic error to prevent user enumeration
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      // Don't reveal that the user doesn't exist - use same error as invalid token
      logger.warn('Password reset attempted for non-existent user', { userId: payload.userId });
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Invalid or expired token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);

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
        actionType: ActionType.UPDATE,
        entityType: EntityType.USER,
        entityId: user.id,
        description: `Password reset for user ${user.username}`,
      },
    });

    res.json({ success: true });
  } catch (error: ControllerError) {
    logger.error('Reset password error', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Generic error for all token validation failures - prevents timing attacks
    if (error && typeof error === 'object' && 'message' in error && error.message === 'Invalid password reset token') {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
  }
};

/**
 * Refresh access token using refresh token from HttpOnly cookie
 */
export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'No refresh token provided' });
    }

    // Verify refresh token
    const payload = await verifyRefreshToken(refreshToken);

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { staff: true },
    });

    if (!user) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'User not found' });
    }

    // Generate new access token
    const accessToken = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // Optionally rotate refresh token for added security
    // await revokeRefreshToken(refreshToken);
    // const newRefreshToken = await generateRefreshToken(user.id);
    // res.cookie('refreshToken', newRefreshToken, {
    //   httpOnly: true,
    //   secure: config.isProduction,
    //   sameSite: 'strict',
    //   maxAge: 30 * 24 * 60 * 60 * 1000,
    //   path: '/api/auth/refresh',
    // });

    res.json({
      token: accessToken,
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
    logger.error('Refresh token error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid or expired refresh token' });
  }
};

/**
 * Logout - revoke refresh token
 */
export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict',
      path: '/api/auth/refresh',
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Logout error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
  }
};

/**
 * Logout from all devices - revoke all refresh tokens for user
 */
export const logoutAll = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
    }

    await revokeAllRefreshTokens(req.user.userId);

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict',
      path: '/api/auth/refresh',
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Logout all error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId,
    });
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
  }
};
