import { z } from 'zod';

/**
 * Project creation/update validation schema
 */
export const projectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(255, 'Project name must not exceed 255 characters')
    .trim(),
  category: z.string()
    .min(1, 'Category is required')
    .max(100, 'Category must not exceed 100 characters')
    .trim(),
  status: z.string()
    .min(1, 'Status is required')
    .max(50, 'Status must not exceed 50 characters')
    .trim(),
  priority: z.string()
    .max(50, 'Priority must not exceed 50 characters')
    .trim()
    .optional()
    .nullable(),
  elStatus: z.string()
    .max(100, 'EL status must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
  timetable: z.enum(['PRE_A1', 'A1', 'HEARING', 'LISTING'])
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
    .max(255, 'B&C Attorney must not exceed 255 characters')
    .trim()
    .optional()
    .nullable(),
  side: z.string()
    .max(100, 'Side must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
  sector: z.string()
    .max(100, 'Sector must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
  notes: z.string()
    .max(5000, 'Notes must not exceed 5000 characters')
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
