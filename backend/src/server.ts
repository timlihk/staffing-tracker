import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';

import config, { validateConfig } from './config';
import { swaggerSpec } from './config/swagger';
import prisma from './utils/prisma';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import staffRoutes from './routes/staff.routes';
import assignmentRoutes from './routes/assignment.routes';
import dashboardRoutes from './routes/dashboard.routes';
import reportsRoutes from './routes/reports.routes';
import projectReportRoutes from './routes/project-report.routes';
import userRoutes from './routes/user.routes';
import emailSettingsRoutes from './routes/email-settings.routes';
import billingRoutes from './routes/billing.routes';
import adminRoutes from './routes/admin.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLogger } from './middleware/requestLogger';
import { queryPerformanceMonitor } from './middleware/queryPerformance';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';

// Validate configuration on startup
validateConfig();

const app = express();
const PORT = config.port;

// Trust proxy - Required for Railway/reverse proxies to get real client IP
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Required for inline styles in React/MUI
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"], // API connections
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests from frontend
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// Response compression (gzip/deflate)
app.use(compression({
  // Only compress responses larger than 1KB
  threshold: 1024,
  // Compression level (0-9, higher = better compression but slower)
  level: 6,
  // Filter function to determine which responses to compress
  filter: (req, res) => {
    // Don't compress if request includes no-transform directive
    if (req.headers['cache-control']?.includes('no-transform')) {
      return false;
    }
    // Compress JSON and text responses
    return compression.filter(req, res);
  },
}));

// Apply rate limiters
app.use('/api/', apiLimiter);

// Request ID middleware - must be before requestLogger
app.use(requestIdMiddleware);

// Request logging
app.use(requestLogger);

// Query performance monitoring (tracks slow queries >100ms)
app.use(queryPerformanceMonitor);

// Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Add size limit
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Staffing Tracker API Documentation',
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
app.get('/api/health', async (req, res) => {
  try {
    // Verify database connectivity
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      message: 'Staffing Tracker API is running',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed - database unavailable', { error });
    res.status(503).json({
      status: 'error',
      message: 'Database unavailable',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
// Reports routes
app.use('/api/reports', reportsRoutes); // /api/reports/staffing, /api/reports/staffing.xlsx
app.use('/api/project-reports', projectReportRoutes); // /api/project-reports, /api/project-reports/excel
app.use('/api/users', userRoutes);
app.use('/api/email-settings', emailSettingsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler - must be before error handler
app.use(notFoundHandler);

// Error handling middleware - must be last
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info('Server started', { port: PORT });
  logger.info('Health endpoint available', { url: `/api/health` });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.warn('Shutdown signal received', { signal });

  server.close(async () => {
    logger.info('HTTP server closed');

    // Disconnect Prisma to prevent connection reset errors
    await prisma.$disconnect();
    logger.info('Database connections closed');

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(async () => {
    logger.error('Forced shutdown after timeout');
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
