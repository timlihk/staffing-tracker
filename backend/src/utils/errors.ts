/**
 * Application-level error with HTTP status code
 * Use this for user-facing validation errors that should return clean 4xx responses
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Create a 400 Bad Request error
   */
  static badRequest(message: string): AppError {
    return new AppError(message, 400);
  }

  /**
   * Create a 404 Not Found error
   */
  static notFound(message: string): AppError {
    return new AppError(message, 404);
  }

  /**
   * Create a 401 Unauthorized error
   */
  static unauthorized(message: string): AppError {
    return new AppError(message, 401);
  }

  /**
   * Create a 403 Forbidden error
   */
  static forbidden(message: string): AppError {
    return new AppError(message, 403);
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
