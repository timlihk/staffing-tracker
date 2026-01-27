import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import type { AppLogger } from '../utils/logger';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    log: AppLogger;
  }
}

/**
 * Request logging middleware
 *
 * Attaches a logger to each request with request context:
 * - requestId: For tracing requests through logs
 * - path: Request path
 * - method: HTTP method
 *
 * Logs request start and completion with timing information.
 *
 * Note: requestId should be set by requestIdMiddleware before this middleware runs
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Get requestId from request (set by requestIdMiddleware)
  const requestId = req.requestId || 'unknown';
  const requestLog = logger.child({ requestId, path: req.path, method: req.method });

  req.log = requestLog;

  const startedAt = Date.now();
  requestLog.info('Request started');

  res.on('finish', () => {
    requestLog.info('Request completed', {
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  res.on('close', () => {
    if (!res.writableEnded) {
      requestLog.warn('Request connection closed before completion', {
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    }
  });

  next();
};
