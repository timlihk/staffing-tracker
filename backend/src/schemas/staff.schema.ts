import { z } from 'zod';

/**
 * Staff creation validation schema
 */
export const createStaffSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must not exceed 255 characters')
    .trim(),
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must not exceed 255 characters')
    .trim()
    .toLowerCase()
    .optional()
    .nullable(),
  position: z.string()
    .min(1, 'Position is required')
    .max(100, 'Position must not exceed 100 characters')
    .trim(),
  department: z.string()
    .max(100, 'Department must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
  status: z.enum(['active', 'inactive', 'leaving']),
  notes: z.string()
    .max(5000, 'Notes must not exceed 5000 characters')
    .trim()
    .optional()
    .nullable(),
});

/**
 * Staff update validation schema
 * All fields are optional for partial updates
 */
export const updateStaffSchema = z.object({
  name: z.string()
    .min(1, 'Name cannot be empty')
    .max(255, 'Name must not exceed 255 characters')
    .trim()
    .optional(),
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must not exceed 255 characters')
    .trim()
    .toLowerCase()
    .optional()
    .nullable(),
  position: z.string()
    .min(1, 'Position cannot be empty')
    .max(100, 'Position must not exceed 100 characters')
    .trim()
    .optional(),
  department: z.string()
    .max(100, 'Department must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
  status: z.enum(['active', 'inactive', 'leaving']).optional(),
  notes: z.string()
    .max(5000, 'Notes must not exceed 5000 characters')
    .trim()
    .optional()
    .nullable(),
});

/**
 * Staff query parameters validation schema
 */
export const staffQuerySchema = z.object({
  position: z.string().optional(),
  department: z.string().optional(),
  status: z.enum(['active', 'inactive', 'leaving']).optional(),
  search: z.string().optional(),
}).partial();

/**
 * ID parameter validation for route params
 */
export const staffIdParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a positive integer')
    .transform(Number),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type StaffQuery = z.infer<typeof staffQuerySchema>;
export type StaffIdParam = z.infer<typeof staffIdParamSchema>;
