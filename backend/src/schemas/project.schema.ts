import { z } from 'zod';
import { Timetable, ValidationLimits } from '../constants';

/**
 * Project creation/update validation schema
 */
export const projectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(ValidationLimits.MAX_NAME_LENGTH, `Project name must not exceed ${ValidationLimits.MAX_NAME_LENGTH} characters`)
    .trim(),
  category: z.string()
    .min(1, 'Category is required')
    .max(ValidationLimits.MAX_CATEGORY_LENGTH, `Category must not exceed ${ValidationLimits.MAX_CATEGORY_LENGTH} characters`)
    .trim(),
  status: z.string()
    .min(1, 'Status is required')
    .max(ValidationLimits.MAX_STATUS_LENGTH, `Status must not exceed ${ValidationLimits.MAX_STATUS_LENGTH} characters`)
    .trim(),
  priority: z.string()
    .max(ValidationLimits.MAX_STATUS_LENGTH, `Priority must not exceed ${ValidationLimits.MAX_STATUS_LENGTH} characters`)
    .trim()
    .optional()
    .nullable(),
  elStatus: z.string()
    .max(ValidationLimits.MAX_CATEGORY_LENGTH, `EL status must not exceed ${ValidationLimits.MAX_CATEGORY_LENGTH} characters`)
    .trim()
    .optional()
    .nullable(),
  timetable: z.enum([Timetable.PRE_A1, Timetable.A1, Timetable.HEARING, Timetable.LISTING])
    .optional()
    .nullable(),
  filingDate: z.string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
  listingDate: z.string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
  bcAttorney: z.string()
    .max(ValidationLimits.MAX_NAME_LENGTH, `B&C Attorney must not exceed ${ValidationLimits.MAX_NAME_LENGTH} characters`)
    .trim()
    .optional()
    .nullable(),
  side: z.string()
    .max(ValidationLimits.MAX_CATEGORY_LENGTH, `Side must not exceed ${ValidationLimits.MAX_CATEGORY_LENGTH} characters`)
    .trim()
    .optional()
    .nullable(),
  sector: z.string()
    .max(ValidationLimits.MAX_CATEGORY_LENGTH, `Sector must not exceed ${ValidationLimits.MAX_CATEGORY_LENGTH} characters`)
    .trim()
    .optional()
    .nullable(),
  notes: z.string()
    .max(ValidationLimits.MAX_NOTES_LENGTH, `Notes must not exceed ${ValidationLimits.MAX_NOTES_LENGTH} characters`)
    .trim()
    .optional()
    .nullable(),
});

/**
 * ID parameter validation for route params
 */
export const idParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a positive integer')
    .transform(Number),
});

/**
 * Query params for getAllProjects
 */
export const projectQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  side: z.string().optional(),
  sector: z.string().optional(),
  search: z.string().optional(),
  staffId: z.string().regex(/^\d+$/).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
}).partial();

/**
 * B&C Attorney assignment schema
 */
export const bcAttorneySchema = z.object({
  staffId: z.number()
    .int('Staff ID must be an integer')
    .positive('Staff ID must be positive'),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type IdParam = z.infer<typeof idParamSchema>;
export type ProjectQuery = z.infer<typeof projectQuerySchema>;
export type BcAttorneyInput = z.infer<typeof bcAttorneySchema>;
