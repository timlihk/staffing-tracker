import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, isAppError } from '../utils/errors';
import { logger } from '../utils/logger';

// Error handler middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestLogger = (req as any).log ?? logger;

  requestLogger.error('Unhandled error', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Handle custom AppError
  if (isAppError(err)) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(err, res);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      error: 'Invalid data provided',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Handle validation errors (Zod, etc.)
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.message,
    });
  }

  // Handle syntax errors (malformed JSON)
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  // Default error response
  const statusCode = 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Something went wrong';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Handle Prisma-specific errors
const handlePrismaError = (err: Prisma.PrismaClientKnownRequestError, res: Response) => {
  switch (err.code) {
    case 'P2002':
      // Unique constraint violation
      const target = err.meta?.target as string[] | undefined;
      const field = target?.[0] || 'field';
      return res.status(409).json({
        error: `A record with this ${field} already exists`,
      });

    case 'P2025':
      // Record not found
      return res.status(404).json({
        error: 'Record not found',
      });

    case 'P2003':
      // Foreign key constraint violation
      return res.status(400).json({
        error: 'Invalid reference to related record',
      });

    case 'P2014':
      // Required relation violation
      return res.status(400).json({
        error: 'Cannot delete record with existing relations',
      });

    default:
      return res.status(400).json({
        error: 'Database operation failed',
        ...(process.env.NODE_ENV === 'development' && { code: err.code, details: err.message }),
      });
  }
};

// Async handler wrapper to catch errors in async route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
  });
};
