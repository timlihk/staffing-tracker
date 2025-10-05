import dotenv from 'dotenv';

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
    // Connection pool settings (for production)
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
      console.warn('⚠️  WARNING: Using default JWT secret in production! Please set a secure JWT_SECRET.');
    }
    if (config.security.sessionSecret === 'session-secret-change-in-production') {
      console.warn('⚠️  WARNING: Using default session secret in production! Please set a secure SESSION_SECRET.');
    }
  }

  console.log('✅ Configuration validated successfully');
};

export default config;
