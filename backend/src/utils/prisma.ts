import { PrismaClient } from '@prisma/client';

// Enhanced in-memory cache for frequently accessed data
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds
const MAX_CACHE_SIZE = 1000; // Prevent memory leaks

const getCacheKey = (key: string): string => `cache:${key}`;

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

// Cache keys for common queries
export const CACHE_KEYS = {
  PROJECTS_LIST: (params: string) => `projects:list:${params}`,
  PROJECT_DETAIL: (id: number) => `project:detail:${id}`,
  PROJECT_REPORT: (params: string) => `project:report:${params}`,
  PROJECT_CATEGORIES: 'projects:categories',
  PROJECT_CHANGE_HISTORY: (id: number, limit: number) => `project:change-history:${id}:${limit}`,
  STAFF_LIST: (params: string) => `staff:list:${params}`,
  STAFF_DETAIL: (id: number) => `staff:detail:${id}`,
  DASHBOARD_SUMMARY: (params: string) => `dashboard:summary:${params}`,
};

// Singleton pattern to prevent multiple instances in serverless/hot-reload environments
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'], // Reduced logging in dev
    // Optimize connection pool settings
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Connection pool optimization
    ...(process.env.NODE_ENV === 'production' && {
      // Production optimizations
      transactionOptions: {
        maxWait: 5000,
        timeout: 10000,
      },
    }),
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

export default prisma;
