import { AppError, isAppError, createError } from '../../utils/errors';

describe('Errors Utils', () => {
  describe('AppError', () => {
    it('should create error with default status code 500', () => {
      const error = new AppError('Something went wrong');

      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AppError');
    });

    it('should create error with custom status code', () => {
      const error = new AppError('Not found', 404);

      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
    });

    it('should be an instance of Error', () => {
      const error = new AppError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      const error = new AppError('Test');

      expect(isAppError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');

      expect(isAppError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError('string')).toBe(false);
      expect(isAppError(123)).toBe(false);
      expect(isAppError({})).toBe(false);
    });
  });

  describe('createError', () => {
    it('should create not found error (404)', () => {
      const error = createError.notFound('User not found');

      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
    });

    it('should create bad request error (400)', () => {
      const error = createError.badRequest('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
    });

    it('should create unauthorized error (401)', () => {
      const error = createError.unauthorized('Please login');

      expect(error.message).toBe('Please login');
      expect(error.statusCode).toBe(401);
    });

    it('should create forbidden error (403)', () => {
      const error = createError.forbidden('Access denied');

      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
    });

    it('should create conflict error (409)', () => {
      const error = createError.conflict('Resource already exists');

      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
    });
  });
});
