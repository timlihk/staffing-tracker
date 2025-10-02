export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  staff?: Staff;
}

export interface Staff {
  id: number;
  name: string;
  email?: string;
  role: string;
  department?: string;
  status: string;
  notes?: string;
  assignments?: ProjectAssignment[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: number;
  name: string;
  projectCode?: string;
  category: string;
  status: string;
  priority?: string;
  startDate?: string;
  targetFilingDate?: string;
  actualFilingDate?: string;
  notes?: string;
  timelineStatus?: string;
  assignments?: ProjectAssignment[];
  statusHistory?: ProjectStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAssignment {
  id: number;
  projectId: number;
  staffId: number;
  roleInProject: string;
  jurisdiction?: string;
  allocationPercentage: number;
  startDate?: string;
  endDate?: string;
  isLead: boolean;
  notes?: string;
  project?: Project;
  staff?: Staff;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStatusHistory {
  id: number;
  projectId: number;
  oldStatus?: string;
  newStatus: string;
  changedBy?: number;
  changeReason?: string;
  changedAt: string;
  user?: { username: string };
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
  workloadDistribution: Array<{
    staffId: number;
    name: string;
    role: string;
    projectCount: number;
    totalAllocation: number;
    isOverAllocated: boolean;
  }>;
  upcomingDeadlines: Array<{
    id: number;
    name: string;
    category: string;
    targetFilingDate: string;
  }>;
  recentActivity: ActivityLog[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
