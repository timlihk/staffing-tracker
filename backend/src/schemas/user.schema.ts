import { z } from 'zod';

/**
 * User creation validation schema
 */
export const createUserSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .trim()
    .toLowerCase(),
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must not exceed 255 characters')
    .trim()
    .toLowerCase(),
  role: z.enum(['admin', 'editor', 'viewer'], {
    errorMap: () => ({ message: 'Role must be admin, editor, or viewer' }),
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
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .trim()
    .toLowerCase()
    .optional(),
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must not exceed 255 characters')
    .trim()
    .toLowerCase()
    .optional(),
  role: z.enum(['admin', 'editor', 'viewer'], {
    errorMap: () => ({ message: 'Role must be admin, editor, or viewer' }),
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
