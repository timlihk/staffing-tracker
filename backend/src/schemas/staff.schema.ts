import { z } from 'zod';
import { StaffStatus, ValidationLimits } from '../constants';

/**
 * Staff creation validation schema
 */
export const createStaffSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(ValidationLimits.MAX_NAME_LENGTH, `Name must not exceed ${ValidationLimits.MAX_NAME_LENGTH} characters`)
    .trim(),
  email: z.union([
    z.string().email('Invalid email address').max(ValidationLimits.MAX_EMAIL_LENGTH, `Email must not exceed ${ValidationLimits.MAX_EMAIL_LENGTH} characters`).trim().toLowerCase(),
    z.literal('')
  ])
    .optional()
    .nullable(),
  position: z.string()
    .min(1, 'Position is required')
    .max(ValidationLimits.MAX_POSITION_LENGTH, `Position must not exceed ${ValidationLimits.MAX_POSITION_LENGTH} characters`)
    .trim(),
  department: z.string()
    .max(ValidationLimits.MAX_DEPARTMENT_LENGTH, `Department must not exceed ${ValidationLimits.MAX_DEPARTMENT_LENGTH} characters`)
    .trim()
    .optional()
    .nullable(),
  status: z.enum([StaffStatus.ACTIVE, StaffStatus.INACTIVE, StaffStatus.LEAVING]),
  notes: z.string()
    .max(ValidationLimits.MAX_NOTES_LENGTH, `Notes must not exceed ${ValidationLimits.MAX_NOTES_LENGTH} characters`)
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
    .max(ValidationLimits.MAX_NAME_LENGTH, `Name must not exceed ${ValidationLimits.MAX_NAME_LENGTH} characters`)
    .trim()
    .optional(),
  email: z.union([
    z.string().email('Invalid email address').max(ValidationLimits.MAX_EMAIL_LENGTH, `Email must not exceed ${ValidationLimits.MAX_EMAIL_LENGTH} characters`).trim().toLowerCase(),
    z.literal('')
  ])
    .optional()
    .nullable(),
  position: z.string()
    .min(1, 'Position cannot be empty')
    .max(ValidationLimits.MAX_POSITION_LENGTH, `Position must not exceed ${ValidationLimits.MAX_POSITION_LENGTH} characters`)
    .trim()
    .optional(),
  department: z.string()
    .max(ValidationLimits.MAX_DEPARTMENT_LENGTH, `Department must not exceed ${ValidationLimits.MAX_DEPARTMENT_LENGTH} characters`)
    .trim()
    .optional()
    .nullable(),
  status: z.enum([StaffStatus.ACTIVE, StaffStatus.INACTIVE, StaffStatus.LEAVING]).optional(),
  notes: z.string()
    .max(ValidationLimits.MAX_NOTES_LENGTH, `Notes must not exceed ${ValidationLimits.MAX_NOTES_LENGTH} characters`)
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
  status: z.enum([StaffStatus.ACTIVE, StaffStatus.INACTIVE, StaffStatus.LEAVING]).optional(),
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
