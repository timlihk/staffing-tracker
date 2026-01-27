import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Validation helper
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const getOptionalEnvVar = (key: string, defaultValue?: string): string | undefined => {
  return process.env[key] || defaultValue;
};

// Configuration object
export const config = {
  // Server
  port: parseInt(getEnvVar('PORT', '3000'), 10),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  isDevelopment: getEnvVar('NODE_ENV', 'development') === 'development',
  isProduction: getEnvVar('NODE_ENV', 'development') === 'production',

  // Frontend
  frontendUrl: getEnvVar('FRONTEND_URL', 'http://localhost:5173'),

  // Database
  database: {
    url: getEnvVar('DATABASE_URL'),

    /**
     * Connection Pool Settings
     *
     * IMPORTANT: These values are critical for production performance and stability.
     * Review and adjust based on your deployment environment and load testing results.
     *
     * Current Configuration:
     * - poolMin: 2 connections (idle pool size)
     * - poolMax: 10 connections (maximum concurrent connections)
     * - connectionTimeout: 20000ms (20 seconds to acquire connection)
     *
     * Sizing Guidelines:
     * Formula: pool_size >= (concurrent_requests × avg_query_time_ms) / 1000
     *
     * Example calculations:
     * - 50 concurrent users, 200ms avg query time: ~10 connections needed
     * - 100 concurrent users, 500ms avg query time: ~50 connections needed
     *
     * Considerations:
     * 1. Database max_connections limit (PostgreSQL default: 100)
     * 2. Multiple application instances share the database connection limit
     * 3. Each Railway/Heroku dyno should use: max_connections / number_of_instances
     * 4. Monitor connection pool exhaustion in production logs
     *
     * Recommended Actions:
     * 1. Load test to determine actual concurrent request patterns
     * 2. Monitor p95/p99 query times in production
     * 3. Adjust pool size if seeing "Connection pool timeout" errors
     * 4. Consider connection pooling service (PgBouncer) for >3 app instances
     *
     * Environment Variables:
     * - DB_POOL_MIN: Minimum idle connections (default: 2)
     * - DB_POOL_MAX: Maximum total connections (default: 10)
     * - DB_CONNECTION_TIMEOUT: Max wait time for connection in ms (default: 20000)
     */
    poolMin: parseInt(getOptionalEnvVar('DB_POOL_MIN', '2') || '2', 10),
    poolMax: parseInt(getOptionalEnvVar('DB_POOL_MAX', '10') || '10', 10),
    connectionTimeout: parseInt(getOptionalEnvVar('DB_CONNECTION_TIMEOUT', '20000') || '20000', 10),
  },

  // JWT
  jwt: {
    secret: getEnvVar('JWT_SECRET'),
    expiresIn: getEnvVar('JWT_EXPIRES_IN', '7d'),
    refreshExpiresIn: getOptionalEnvVar('JWT_REFRESH_EXPIRES_IN', '30d'),
  },

  // Email
  email: {
    apiKey: getEnvVar('RESEND_API_KEY'),
    from: getEnvVar('EMAIL_FROM', 'Asia CM Team <notifications@asia-cm.team>'),
    enabled: getOptionalEnvVar('EMAIL_ENABLED', 'true') === 'true',
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(getOptionalEnvVar('RATE_LIMIT_WINDOW_MS', '900000') || '900000', 10), // 15 minutes
    maxRequests: parseInt(getOptionalEnvVar('RATE_LIMIT_MAX_REQUESTS', '500') || '500', 10),
    authWindowMs: parseInt(getOptionalEnvVar('AUTH_RATE_LIMIT_WINDOW_MS', '900000') || '900000', 10), // 15 minutes
    authMaxRequests: parseInt(getOptionalEnvVar('AUTH_RATE_LIMIT_MAX_REQUESTS', '5') || '5', 10),
  },

  // Security
  security: {
    bcryptRounds: parseInt(getOptionalEnvVar('BCRYPT_ROUNDS', '10') || '10', 10),
    sessionSecret: getOptionalEnvVar('SESSION_SECRET', 'session-secret-change-in-production'),
  },

  // Logging
  logging: {
    level: getOptionalEnvVar('LOG_LEVEL', 'info'),
    enableQueryLogging: getOptionalEnvVar('ENABLE_QUERY_LOGGING', 'false') === 'true',
  },

  // Redis (optional, for future caching implementation)
  redis: {
    url: getOptionalEnvVar('REDIS_URL'),
    enabled: !!getOptionalEnvVar('REDIS_URL'),
    ttl: parseInt(getOptionalEnvVar('REDIS_TTL', '3600') || '3600', 10), // 1 hour default
  },
} as const;

// Validate required configuration on startup
export const validateConfig = () => {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
  ];

  const missing = requiredVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }

  // Warn about insecure defaults in production
  if (config.isProduction) {
    if (config.jwt.secret === 'dev-secret-key-change-in-production') {
      logger.warn('Using default JWT secret in production', { 
        message: 'Please set a secure JWT_SECRET' 
      });
    }
    if (config.security.sessionSecret === 'session-secret-change-in-production') {
      logger.warn('Using default session secret in production', { 
        message: 'Please set a secure SESSION_SECRET' 
      });
    }
  }

  logger.info('Configuration validated successfully');
};

export default config;
