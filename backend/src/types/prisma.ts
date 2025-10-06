import { Prisma } from '@prisma/client';

// Properly typed where inputs for controllers
export type ProjectWhereInput = Prisma.ProjectWhereInput;
export type StaffWhereInput = Prisma.StaffWhereInput;
export type AssignmentWhereInput = Prisma.ProjectAssignmentWhereInput;
export type ActivityLogWhereInput = Prisma.ActivityLogWhereInput;

// Prisma groupBy result types - matches what Prisma actually returns
export interface ProjectGroupByCount {
  category?: string | null;
  sector?: string | null;
  side?: string | null;
  _count: number;
}

export interface StaffGroupByCount {
  position?: string;
  _count: number;
}

// Error types for catch blocks
export type ControllerError = Error | Prisma.PrismaClientKnownRequestError | unknown;
