import { z } from 'zod';

// Login validation
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Project validation
export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  category: z.string().min(1, 'Category is required'),
  status: z.string().min(1, 'Status is required'),
  lifecycleStage: z.string().optional(),
  priority: z.string().optional(),
  bcAttorney: z.string().optional(),
  filingDate: z.string().optional(),
  listingDate: z.string().optional(),
  side: z.string().optional(),
  sector: z.string().optional(),
  notes: z.string().optional(),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

// Staff validation
export const staffSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  position: z.string().min(1, 'Position is required'),
  department: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
  notes: z.string().optional(),
});

export type StaffFormData = z.infer<typeof staffSchema>;

export const createUserSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().email('Valid email is required'),
  role: z.enum(['admin', 'finance', 'editor', 'viewer']),
  staffId: z.number().optional().nullable(),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
