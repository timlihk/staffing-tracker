import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import config, { validateConfig } from './config';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import staffRoutes from './routes/staff.routes';
import assignmentRoutes from './routes/assignment.routes';
import dashboardRoutes from './routes/dashboard.routes';
import reportsRoutes from './routes/reports.routes';
import projectReportRoutes from './routes/project-report.routes';
import userRoutes from './routes/user.routes';
import emailSettingsRoutes from './routes/email-settings.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
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
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS', // Skip CORS preflight requests
});

// Apply rate limiter to all API routes
app.use('/api/', limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMaxRequests,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// Request logging
app.use(requestLogger);

// Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Add size limit
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Staffing Tracker API is running' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/reports', projectReportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/email-settings', emailSettingsRoutes);

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
const gracefulShutdown = (signal: string) => {
  logger.warn('Shutdown signal received', { signal });

  server.close(() => {
    logger.info('HTTP server closed');
    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
