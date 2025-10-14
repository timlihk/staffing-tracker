import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

// Track last activity update times to avoid excessive DB writes
const activityUpdateCache = new Map<number, number>();
const ACTIVITY_UPDATE_INTERVAL = 60 * 1000; // Update activity every 1 minute max
const MAX_CACHE_ENTRIES = 10000; // Prevent unbounded memory growth
const CACHE_ENTRY_TTL = 24 * 60 * 60 * 1000; // 24 hours - remove stale entries

// Periodic cleanup to prevent memory leaks
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [userId, timestamp] of activityUpdateCache.entries()) {
    if (now - timestamp > CACHE_ENTRY_TTL) {
      activityUpdateCache.delete(userId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.info('Activity cache cleanup completed', {
      entriesRemoved: cleanedCount,
      currentSize: activityUpdateCache.size
    });
  }
}, 60 * 60 * 1000); // Clean up hourly

// Prevent the cleanup interval from keeping the process alive
cleanupInterval.unref();

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
      // Enforce max cache size - remove oldest entry if limit exceeded
      if (activityUpdateCache.size >= MAX_CACHE_ENTRIES) {
        const oldestEntry = activityUpdateCache.keys().next().value;
        if (oldestEntry !== undefined) {
          activityUpdateCache.delete(oldestEntry);
          logger.warn('Activity cache size limit reached, removing oldest entry', {
            cacheSize: activityUpdateCache.size,
            maxSize: MAX_CACHE_ENTRIES
          });
        }
      }

      // Update asynchronously, don't wait for it
      prisma.user.update({
        where: { id: userId },
        data: { lastActivity: new Date() },
      }).catch((err) => {
        logger.error('Failed to update user activity', {
          error: err instanceof Error ? err.message : String(err),
          userId
        });
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

// Convenience middleware for admin-only routes
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};
