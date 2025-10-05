import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Track last activity update times to avoid excessive DB writes
const activityUpdateCache = new Map<number, number>();
const ACTIVITY_UPDATE_INTERVAL = 60 * 1000; // Update activity every 1 minute max

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    req.user = decoded;

    // Update user activity (throttled to once per minute)
    const userId = decoded.userId;
    const now = Date.now();
    const lastUpdate = activityUpdateCache.get(userId) || 0;

    if (now - lastUpdate > ACTIVITY_UPDATE_INTERVAL) {
      // Update asynchronously, don't wait for it
      prisma.user.update({
        where: { id: userId },
        data: { lastActivity: new Date() },
      }).catch((err) => {
        console.error('[Auth] Failed to update user activity:', err);
      });

      activityUpdateCache.set(userId, now);
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
