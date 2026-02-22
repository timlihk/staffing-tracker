import { z } from 'zod';

/**
 * Financials update schema
 */
export const updateFinancialsSchema = z.object({
  ubt_usd: z.number().nonnegative('UBT USD must be non-negative').or(z.string().regex(/^\d+(\.\d+)?$/)).optional(),
  ubt_cny: z.number().nonnegative('UBT CNY must be non-negative').or(z.string().regex(/^\d+(\.\d+)?$/)).optional(),
  billing_credit_usd: z.number().nonnegative('Billing credit USD must be non-negative').or(z.string().regex(/^\d+(\.\d+)?$/)).optional(),
  billing_credit_cny: z.number().nonnegative('Billing credit CNY must be non-negative').or(z.string().regex(/^\d+(\.\d+)?$/)).optional(),
});

/**
 * Fee arrangement update schema
 */
export const updateFeeArrangementSchema = z.object({
  raw_text: z.string()
    .min(1, 'Fee arrangement text is required')
    .max(10000, 'Fee arrangement text must not exceed 10,000 characters')
    .trim(),
  lsd_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Long stop date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
});

/**
 * Create engagement schema
 */
export const createEngagementSchema = z.object({
  engagement_title: z.string()
    .min(1, 'Engagement title is required')
    .max(500, 'Title must not exceed 500 characters')
    .trim(),
  engagement_code: z.string()
    .max(100, 'Engagement code must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
  start_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  end_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  fee_arrangement_text: z.string()
    .max(10000, 'Fee arrangement text must not exceed 10,000 characters')
    .trim()
    .optional()
    .nullable(),
  signed_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Signed date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
});

export const cmIdParamSchema = z.object({
  cmId: z.string()
    .regex(/^\d+$/, 'CM ID must be a positive integer')
    .transform(Number),
});

/**
 * Create milestone schema
 */
export const createMilestoneSchema = z.object({
  title: z.string()
    .max(500, 'Title must not exceed 500 characters')
    .trim()
    .optional()
    .nullable(),
  trigger_text: z.string()
    .max(1000, 'Trigger text must not exceed 1000 characters')
    .trim()
    .optional()
    .nullable(),
  notes: z.string()
    .max(5000, 'Notes must not exceed 5000 characters')
    .trim()
    .optional()
    .nullable(),
  due_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  amount_value: z.number()
    .nonnegative('Amount must be non-negative')
    .optional()
    .nullable(),
  amount_currency: z.string()
    .max(10, 'Currency must not exceed 10 characters')
    .trim()
    .optional()
    .nullable(),
  ordinal: z.number()
    .int('Ordinal must be an integer')
    .positive('Ordinal must be positive')
    .optional()
    .nullable(),
});

/**
 * Update milestones schema
 */
export const updateMilestonesSchema = z.object({
  milestones: z.array(z.object({
    milestone_id: z.number()
      .int('Milestone ID must be an integer')
      .positive('Milestone ID must be positive'),
    completed: z.boolean().optional(),
    invoice_sent_date: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invoice sent date must be in YYYY-MM-DD format')
      .optional()
      .nullable(),
    payment_received_date: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment received date must be in YYYY-MM-DD format')
      .optional()
      .nullable(),
    notes: z.string()
      .max(5000, 'Notes must not exceed 5000 characters')
      .trim()
      .optional()
      .nullable(),
    due_date: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
      .optional()
      .nullable(),
    title: z.string()
      .max(500, 'Title must not exceed 500 characters')
      .trim()
      .optional()
      .nullable(),
    trigger_text: z.string()
      .max(1000, 'Trigger text must not exceed 1000 characters')
      .trim()
      .optional()
      .nullable(),
    amount_value: z.number()
      .nonnegative('Amount must be non-negative')
      .optional()
      .nullable(),
    amount_currency: z.string()
      .max(10, 'Currency must not exceed 10 characters')
      .trim()
      .optional()
      .nullable(),
    ordinal: z.number()
      .int('Ordinal must be an integer')
      .positive('Ordinal must be positive')
      .optional()
      .nullable(),
  })).min(1, 'At least one milestone is required'),
});

/**
 * Link projects schema
 */
export const linkProjectsSchema = z.object({
  billing_project_id: z.number()
    .int('Billing project ID must be an integer')
    .positive('Billing project ID must be positive'),
  staffing_project_id: z.number()
    .int('Staffing project ID must be an integer')
    .positive('Staffing project ID must be positive'),
  notes: z.string()
    .max(1000, 'Notes must not exceed 1000 characters')
    .trim()
    .optional()
    .nullable(),
});

/**
 * Map B&C Attorney schema
 */
export const mapBCAttorneySchema = z.object({
  billing_attorney_name: z.string()
    .min(1, 'Attorney name is required')
    .max(255, 'Attorney name must not exceed 255 characters')
    .trim(),
  staff_id: z.number()
    .int('Staff ID must be an integer')
    .positive('Staff ID must be positive'),
});

/**
 * Update billing access settings schema
 */
export const updateBillingAccessSettingsSchema = z.object({
  billing_module_enabled: z.boolean(),
  access_level: z.enum(['admin_only', 'admin_and_bc_attorney']),
});

/**
 * Trigger action item update schema
 */
export const updateTriggerActionItemSchema = z.object({
  actionType: z.string()
    .min(1, 'Action type is required')
    .max(120, 'Action type must not exceed 120 characters')
    .trim()
    .optional(),
  description: z.string()
    .min(1, 'Description is required')
    .max(2000, 'Description must not exceed 2000 characters')
    .trim()
    .optional(),
  dueDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
    .nullable()
    .optional(),
  status: z.enum(['pending', 'completed', 'cancelled']).optional(),
  assignedTo: z.number()
    .int('assignedTo must be an integer')
    .positive('assignedTo must be positive')
    .nullable()
    .optional(),
}).refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: 'At least one field must be provided' }
);

/**
 * ID parameter schemas
 */
export const billingIdParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a positive integer')
    .transform(Number),
});

export const engagementIdParamSchema = z.object({
  engagementId: z.string()
    .regex(/^\d+$/, 'Engagement ID must be a positive integer')
    .transform(Number),
});

export const milestoneIdParamSchema = z.object({
  milestoneId: z.string()
    .regex(/^\d+$/, 'Milestone ID must be a positive integer')
    .transform(Number),
});

export const linkIdParamSchema = z.object({
  linkId: z.string()
    .regex(/^\d+$/, 'Link ID must be a positive integer')
    .transform(Number),
});

export type CreateEngagementInput = z.infer<typeof createEngagementSchema>;
export type UpdateFinancialsInput = z.infer<typeof updateFinancialsSchema>;
export type UpdateFeeArrangementInput = z.infer<typeof updateFeeArrangementSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestonesInput = z.infer<typeof updateMilestonesSchema>;
export type LinkProjectsInput = z.infer<typeof linkProjectsSchema>;
export type MapBCAttorneyInput = z.infer<typeof mapBCAttorneySchema>;
export type UpdateBillingAccessSettingsInput = z.infer<typeof updateBillingAccessSettingsSchema>;
export type UpdateTriggerActionItemInput = z.infer<typeof updateTriggerActionItemSchema>;
