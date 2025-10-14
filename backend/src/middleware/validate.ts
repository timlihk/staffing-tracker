import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * Express middleware factory for validating request data with Zod schemas
 *
 * @param schema - Zod schema to validate against
 * @param source - Which part of the request to validate ('body', 'query', 'params')
 * @returns Express middleware function
 */
export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const validated = schema.parse(data);

      // Replace the original data with validated/sanitized data
      req[source] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        logger.warn('Request validation failed', {
          source,
          errors,
          path: req.path,
        });

        return res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
      }

      logger.error('Unexpected validation error', {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};
