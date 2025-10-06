import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import type { AppLogger } from '../utils/logger';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    log: AppLogger;
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = randomUUID();
  const requestLog = logger.child({ requestId, path: req.path, method: req.method });

  req.requestId = requestId;
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
