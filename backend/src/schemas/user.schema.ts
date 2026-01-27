import { z } from 'zod';
import { UserRole, ValidationLimits } from '../constants';

/**
 * User creation validation schema
 */
export const createUserSchema = z.object({
  username: z.string()
    .min(ValidationLimits.MIN_USERNAME_LENGTH, `Username must be at least ${ValidationLimits.MIN_USERNAME_LENGTH} characters`)
    .max(ValidationLimits.MAX_USERNAME_LENGTH, `Username must not exceed ${ValidationLimits.MAX_USERNAME_LENGTH} characters`)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .trim()
    .toLowerCase(),
  email: z.string()
    .email('Invalid email address')
    .max(ValidationLimits.MAX_EMAIL_LENGTH, `Email must not exceed ${ValidationLimits.MAX_EMAIL_LENGTH} characters`)
    .trim()
    .toLowerCase(),
  role: z.enum([UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER])
    .refine((val) => [UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER].includes(val), {
      message: 'Role must be admin, editor, or viewer',
    }),
  staffId: z.number()
    .int('Staff ID must be an integer')
    .positive('Staff ID must be positive')
    .optional()
    .nullable(),
});

/**
 * User update validation schema
 * All fields are optional for partial updates
 */
export const updateUserSchema = z.object({
  username: z.string()
    .min(ValidationLimits.MIN_USERNAME_LENGTH, `Username must be at least ${ValidationLimits.MIN_USERNAME_LENGTH} characters`)
    .max(ValidationLimits.MAX_USERNAME_LENGTH, `Username must not exceed ${ValidationLimits.MAX_USERNAME_LENGTH} characters`)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .trim()
    .toLowerCase()
    .optional(),
  email: z.string()
    .email('Invalid email address')
    .max(ValidationLimits.MAX_EMAIL_LENGTH, `Email must not exceed ${ValidationLimits.MAX_EMAIL_LENGTH} characters`)
    .trim()
    .toLowerCase()
    .optional(),
  role: z.enum([UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER])
    .refine((val) => [UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER].includes(val), {
      message: 'Role must be admin, editor, or viewer',
    }).optional(),
  staffId: z.number()
    .int('Staff ID must be an integer')
    .positive('Staff ID must be positive')
    .optional()
    .nullable(),
});

/**
 * User ID parameter validation
 */
export const userIdParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a positive integer')
    .transform(Number),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
