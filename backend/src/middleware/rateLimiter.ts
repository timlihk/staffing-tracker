import rateLimit from 'express-rate-limit';
import config from '../config';

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS', // Skip CORS preflight requests
});

/**
 * Stricter rate limit for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMaxRequests,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

/**
 * Even stricter rate limit for password reset endpoint
 * Prevents brute force attacks and account enumeration
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Only 3 attempts per IP per 15 minutes
  message: 'Too many password reset attempts. Please try again later.',
  skipSuccessfulRequests: false, // Count all attempts, not just failures
  standardHeaders: true,
  legacyHeaders: false,
});
