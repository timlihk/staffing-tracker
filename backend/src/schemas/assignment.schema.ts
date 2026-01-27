import { z } from 'zod';
import { ValidationLimits } from '../constants';

/**
 * Assignment creation validation schema
 */
export const createAssignmentSchema = z.object({
  projectId: z.number()
    .int('Project ID must be an integer')
    .positive('Project ID must be positive'),
  staffId: z.number()
    .int('Staff ID must be an integer')
    .positive('Staff ID must be positive'),
  jurisdiction: z.string()
    .max(ValidationLimits.MAX_CATEGORY_LENGTH, `Jurisdiction must not exceed ${ValidationLimits.MAX_CATEGORY_LENGTH} characters`)
    .trim()
    .optional()
    .nullable(),
  startDate: z.string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
  endDate: z.string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
  notes: z.string()
    .max(ValidationLimits.MAX_NOTES_LENGTH, `Notes must not exceed ${ValidationLimits.MAX_NOTES_LENGTH} characters`)
    .trim()
    .optional()
    .nullable(),
});

/**
 * Assignment update validation schema
 * All fields are optional for partial updates
 */
export const updateAssignmentSchema = z.object({
  jurisdiction: z.string()
    .max(ValidationLimits.MAX_CATEGORY_LENGTH, `Jurisdiction must not exceed ${ValidationLimits.MAX_CATEGORY_LENGTH} characters`)
    .trim()
    .optional()
    .nullable(),
  startDate: z.string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
  endDate: z.string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
  notes: z.string()
    .max(ValidationLimits.MAX_NOTES_LENGTH, `Notes must not exceed ${ValidationLimits.MAX_NOTES_LENGTH} characters`)
    .trim()
    .optional()
    .nullable(),
});

/**
 * Bulk assignment creation schema
 */
export const bulkCreateAssignmentsSchema = z.object({
  assignments: z.array(createAssignmentSchema)
    .min(1, 'At least one assignment is required')
    .max(100, 'Cannot create more than 100 assignments at once'),
});

/**
 * Assignment ID parameter validation
 */
export const assignmentIdParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a positive integer')
    .transform(Number),
});

/**
 * Assignment query parameters validation schema
 */
export const assignmentQuerySchema = z.object({
  projectId: z.string().regex(/^\d+$/).optional(),
  staffId: z.string().regex(/^\d+$/).optional(),
}).partial();

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type BulkCreateAssignmentsInput = z.infer<typeof bulkCreateAssignmentsSchema>;
export type AssignmentIdParam = z.infer<typeof assignmentIdParamSchema>;
export type AssignmentQuery = z.infer<typeof assignmentQuerySchema>;
