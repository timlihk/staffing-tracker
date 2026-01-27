import { z } from 'zod';

/**
 * Email settings position configuration
 */
const positionSettingsSchema = z.object({
  partner: z.boolean().optional(),
  associate: z.boolean().optional(),
  juniorFlic: z.boolean().optional(),
  seniorFlic: z.boolean().optional(),
  intern: z.boolean().optional(),
  bcWorkingAttorney: z.boolean().optional(),
});

/**
 * Email settings update validation schema
 */
export const updateEmailSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  positionSettings: positionSettingsSchema.optional(),
});

export type UpdateEmailSettingsInput = z.infer<typeof updateEmailSettingsSchema>;
