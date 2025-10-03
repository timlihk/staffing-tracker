import { z } from 'zod';

// Login validation
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Project validation
export const projectSchema = z.object({
  name: z.string().min(1, 'Project code is required'),
  category: z.string().min(1, 'Category is required'),
  status: z.string().min(1, 'Status is required'),
  priority: z.string().optional(),
  elStatus: z.string().optional(),
  timetable: z.enum(['PRE_A1', 'A1', 'HEARING', 'LISTING']).optional(),
  bcAttorney: z.string().optional(),
  filingDate: z.string().optional(),
  listingDate: z.string().optional(),
  notes: z.string().optional(),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

// Staff validation
export const staffSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  role: z.string().min(1, 'Role is required'),
  department: z.string().optional(),
  status: z.string().default('active'),
  notes: z.string().optional(),
});

export type StaffFormData = z.infer<typeof staffSchema>;
