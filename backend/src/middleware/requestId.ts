import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Request ID header name
 */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Extended request interface with requestId
 */
export interface RequestWithId extends Request {
  requestId: string;
}

/**
 * Generate a unique request ID
 * Uses UUID v4 for uniqueness
 */
const generateRequestId = (): string => {
  return randomUUID();
};

/**
 * Request ID middleware
 *
 * Attaches a unique request ID to each incoming request:
 * - Checks for existing request ID from client (for distributed tracing)
 * - Generates new UUID if none provided
 * - Adds requestId to request object for use in controllers
 * - Sets request ID in response header for client reference
 * - Makes requestId available to logger via res.locals
 *
 * Usage in controllers:
 *   const { requestId } = req as RequestWithId;
 *
 * Usage in logging:
 *   logger.info('Message', { requestId: res.locals.requestId });
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check if client provided a request ID (for distributed tracing)
  const clientRequestId = req.get(REQUEST_ID_HEADER);

  // Use client request ID if valid, otherwise generate new one
  const requestId = clientRequestId && clientRequestId.length > 0
    ? clientRequestId
    : generateRequestId();

  // Attach to request object
  (req as RequestWithId).requestId = requestId;

  // Make available to logger and other middleware
  res.locals.requestId = requestId;

  // Set response header so client can reference this request
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
};

/**
 * Get request ID from request object
 * Helper function for type safety
 */
export const getRequestId = (req: Request): string => {
  return (req as RequestWithId).requestId;
};
