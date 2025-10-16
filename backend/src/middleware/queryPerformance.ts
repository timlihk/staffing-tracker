import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Track query performance statistics
const performanceStats = {
  slowQueries: [] as Array<{
    path: string;
    method: string;
    duration: number;
    timestamp: Date;
  }>,
  totalQueries: 0,
  avgDuration: 0,
};

const SLOW_QUERY_THRESHOLD_MS = 100;
const MAX_SLOW_QUERIES_TRACKED = 100; // Prevent memory leaks

/**
 * Query Performance Monitoring Middleware
 *
 * Tracks API request duration and logs slow queries (>100ms)
 * Useful for identifying performance bottlenecks
 */
export const queryPerformanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Capture the original res.json to measure response time
  const originalJson = res.json.bind(res);

  res.json = function (body: any) {
    const duration = Date.now() - startTime;

    // Update statistics
    performanceStats.totalQueries++;
    performanceStats.avgDuration =
      (performanceStats.avgDuration * (performanceStats.totalQueries - 1) + duration) /
      performanceStats.totalQueries;

    // Log slow queries
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      const slowQuery = {
        path: req.path,
        method: req.method,
        duration,
        timestamp: new Date(),
      };

      logger.warn('Slow query detected', {
        ...slowQuery,
        query: req.query,
        statusCode: res.statusCode,
      });

      // Track for metrics (with size limit to prevent memory leaks)
      if (performanceStats.slowQueries.length >= MAX_SLOW_QUERIES_TRACKED) {
        performanceStats.slowQueries.shift(); // Remove oldest
      }
      performanceStats.slowQueries.push(slowQuery);
    }

    // Log all queries in development for debugging
    if (process.env.NODE_ENV === 'development' && duration > 50) {
      logger.debug('Query performance', {
        path: req.path,
        method: req.method,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
      });
    }

    return originalJson(body);
  };

  next();
};

/**
 * Get current performance statistics
 * Useful for monitoring endpoints
 */
export const getPerformanceStats = () => ({
  ...performanceStats,
  slowQueries: performanceStats.slowQueries.slice(-20), // Return last 20 only
});

/**
 * Reset performance statistics
 * Useful for testing or periodic cleanup
 */
export const resetPerformanceStats = () => {
  performanceStats.slowQueries = [];
  performanceStats.totalQueries = 0;
  performanceStats.avgDuration = 0;
};
