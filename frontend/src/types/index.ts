export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  staff?: Staff;
  mustResetPassword?: boolean;
}

export interface Staff {
  id: number;
  name: string;
  email?: string;
  position: string;
  department?: string;
  status: string;
  notes?: string;
  assignments?: ProjectAssignment[];
  createdAt: string;
  updatedAt: string;
}

export type Timetable = 'PRE_A1' | 'A1' | 'HEARING' | 'LISTING';

export interface Project {
  id: number;
  name: string;
  category: string;
  status: string;
  priority?: string;
  elStatus?: string;
  timetable?: Timetable;
  bcAttorney?: string;
  filingDate?: string;
  listingDate?: string;
  side?: string;
  sector?: string;
  notes?: string;
  assignments?: ProjectAssignment[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAssignment {
  id: number;
  projectId: number;
  staffId: number;
  jurisdiction?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  project?: Project;
  staff?: Staff;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: number;
  userId?: number;
  actionType: string;
  entityType: string;
  entityId?: number;
  description?: string;
  username?: string;
  createdAt: string;
}

export interface ChangeHistory {
  id: number;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changeType: string;
  username: string;
  changedAt: string;
}

export interface DashboardSummary {
  summary: {
    totalProjects: number;
    activeProjects: number;
    slowdownProjects: number;
    suspendedProjects: number;
    totalStaff: number;
    activeStaff: number;
  };
  projectsByStatus: Array<{ status: string; count: number }>;
  projectsByCategory: Array<{ category: string; count: number }>;
  dealRadar: Array<{
    projectId: number;
    projectName: string;
    category: string;
    status: string;
    priority: string | null;
    side: string | null;
    type: 'Filing' | 'Listing';
    date: string;
    partner: string | null;
    teamMembers: Array<{ id: number; name: string; position: string }>;
  }>;
  staffingHeatmap: Array<{
    staffId: number;
    name: string;
    position: string;
    weeks: Array<{ week: string; count: number }>;
  }>;
  actionItems: {
    unstaffedMilestones: Array<{
      projectId: number;
      projectName: string;
      category: string;
      status: string;
      milestoneDate: string | null;
      needsUSPartner: boolean;
      needsHKPartner: boolean;
    }>;
    pendingResets: Array<{
      id: number;
      username: string;
      email: string;
      role: string;
      lastLogin: string | null;
    }>;
  };
  recentActivity: ActivityLog[];
}

export interface ManagedUser {
  id: number;
  username: string;
  email: string;
  role: string;
  mustResetPassword: boolean;
  lastLogin: string | null;
  staff: { id: number; name: string } | null;
  recentActionCount: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
