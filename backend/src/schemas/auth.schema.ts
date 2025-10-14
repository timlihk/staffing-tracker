import { z } from 'zod';

/**
 * Login request validation schema
 */
export const loginSchema = z.object({
  username: z.string()
    .min(1, 'Username is required')
    .trim(),
  password: z.string()
    .min(1, 'Password is required'),
});

/**
 * User registration validation schema
 */
export const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
    .trim(),
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must not exceed 255 characters')
    .trim()
    .toLowerCase(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  staffId: z.number().int().positive().optional().nullable(),
});

/**
 * Password reset validation schema
 */
export const resetPasswordSchema = z.object({
  token: z.string()
    .min(1, 'Reset token is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
