import { PrismaClient } from '@prisma/client';
import config from '../config';

// Enhanced in-memory cache for frequently accessed data
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds
const MAX_CACHE_SIZE = 1000; // Prevent memory leaks

/**
 * Sanitize cache key to prevent cache poisoning and injection attacks
 * - Removes control characters and newlines
 * - Limits length to prevent memory exhaustion
 * - Normalizes to prevent cache key collisions
 */
const sanitizeCacheKey = (key: string): string => {
  if (typeof key !== 'string') {
    throw new Error('Cache key must be a string');
  }

  // Remove control characters, newlines, and other potentially dangerous characters
  let sanitized = key
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
    .replace(/[^\x20-\x7E]/g, '') // Keep only printable ASCII
    .trim();

  // Limit key length to prevent memory exhaustion
  const MAX_KEY_LENGTH = 500;
  if (sanitized.length > MAX_KEY_LENGTH) {
    sanitized = sanitized.substring(0, MAX_KEY_LENGTH);
  }

  return sanitized;
};

const getCacheKey = (key: string): string => `cache:${sanitizeCacheKey(key)}`;

// Cache statistics for monitoring
export const cacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  size: () => cache.size
};

export const getCached = <T>(key: string): T | null => {
  const cacheKey = getCacheKey(key);
  const cached = cache.get(cacheKey);

  if (!cached) {
    cacheStats.misses++;
    return null;
  }

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(cacheKey);
    cacheStats.evictions++;
    cacheStats.misses++;
    return null;
  }

  cacheStats.hits++;
  return cached.data;
};

export const setCached = <T>(key: string, data: T): void => {
  // Clean up if cache is too large
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = Array.from(cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0]?.[0];
    if (oldestKey) {
      cache.delete(oldestKey);
      cacheStats.evictions++;
    }
  }

  const cacheKey = getCacheKey(key);
  cache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
};

export const invalidateCache = (pattern: string): void => {
  const cacheKey = getCacheKey(pattern);
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
};

export const clearCache = (): void => {
  cache.clear();
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.evictions = 0;
};

// Cache version - increment this when schema changes to invalidate old cache entries
const CACHE_VERSION = 'v2';

// Cache keys for common queries with automatic sanitization
export const CACHE_KEYS = {
  PROJECTS_LIST: (params: string) => `projects:list:${CACHE_VERSION}:${sanitizeCacheKey(params)}`,
  PROJECT_DETAIL: (id: number) => `project:detail:${CACHE_VERSION}:${id}`,
  PROJECT_REPORT: (params: string) => `project:report:${CACHE_VERSION}:${sanitizeCacheKey(params)}`,
  PROJECT_CATEGORIES: `projects:categories:${CACHE_VERSION}`,
  PROJECT_CHANGE_HISTORY: (id: number, limit: number) => `project:change-history:${CACHE_VERSION}:${id}:${limit}`,
  STAFF_LIST: (params: string) => `staff:list:${CACHE_VERSION}:${sanitizeCacheKey(params)}`,
  STAFF_DETAIL: (id: number) => `staff:detail:${CACHE_VERSION}:${id}`,
  DASHBOARD_SUMMARY: (params: string) => `dashboard:summary:${CACHE_VERSION}:${sanitizeCacheKey(params)}`,
};

/**
 * Prisma Client Singleton with optimized connection pool settings
 *
 * Connection Pool Configuration:
 * ==============================
 *
 * The connection pool is configured via DATABASE_URL query parameters:
 *
 * Required Parameters:
 * - connection_limit: Maximum number of database connections (default: 20)
 *   - Set to number of CPU cores * 2 + 1 for optimal performance
 *   - Railway/Heroku: Usually 10-20 depending on plan
 *   - Local dev: 5-10 is typically sufficient
 *
 * - pool_timeout: Maximum time (seconds) to wait for a connection (default: 30)
 *   - If all connections are busy, new requests will wait up to this duration
 *   - Set higher in production (30-60s) to handle traffic spikes
 *   - Set lower in dev (10-20s) to fail fast
 *
 * - idle_timeout: Time (seconds) before idle connections are closed (default: 300)
 *   - Prevents holding connections unnecessarily during low traffic
 *   - Railway: Set to 300s (5 min) to balance responsiveness and resource usage
 *   - Should be less than database's own connection timeout
 *
 * Example DATABASE_URL:
 * postgresql://user:pass@host:port/db?connection_limit=20&pool_timeout=30&idle_timeout=300
 *
 * Transaction Settings:
 * - maxWait: Maximum time to wait for a transaction slot (2000ms)
 * - timeout: Maximum time a transaction can run before being rolled back (5000ms)
 *
 * Security Considerations:
 * - Always use SSL in production (add ?sslmode=require to DATABASE_URL)
 * - Keep connection_limit appropriate to avoid exhausting database resources
 * - Monitor connection pool usage via Prisma metrics
 * - Use transactions sparingly and keep them short-lived
 *
 * Performance Tips:
 * - Use connection pooling to reuse connections instead of creating new ones
 * - Avoid long-running transactions that hold connections
 * - Monitor for connection pool exhaustion (all connections busy)
 * - Consider using read replicas for read-heavy workloads
 */
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: config.nodeEnv === 'development' ? ['error', 'warn'] : ['error'], // Reduced logging in dev
    // Optimize connection pool settings
    datasources: {
      db: {
        url: config.database.url,
      },
    },
    // Connection pool optimization for both dev and prod
    transactionOptions: {
      maxWait: 2000,  // Max time to wait for a transaction slot
      timeout: 5000,  // Max time a transaction can run
    },
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (config.nodeEnv !== 'production') globalThis.prisma = prisma;

export default prisma;
