export interface DashboardSummary {
  summary: {
    totalProjects: number;
    activeProjects: number;
    slowdownProjects: number;
    suspendedProjects: number;
    closedProjects?: number;
    terminatedProjects?: number;
    totalStaff: number;
    activeStaff: number;
    pendingConfirmations: number;
    upcomingFilings30Days: number;
    upcomingListings30Days: number;
  };
  projectsByStatus: Array<{
    status: string;
    count: number;
  }>;
  projectsByCategory: Array<{
    category: string;
    count: number;
  }>;
  projectsBySector: Array<{
    sector: string | null;
    count: number;
  }>;
  projectsBySide: Array<{
    side: string | null;
    count: number;
  }>;
  staffByRole: Array<{
    position: string;
    count: number;
  }>;
  topAssignedStaff: Array<{
    staffId: number;
    name: string;
    position: string;
    projectCount: number;
  }>;
  sevenDayTrends: {
    newProjects: number;
    suspended: number;
    slowdown: number;
    resumed: number;
  };
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
    teamMembers: Array<{
      id: number;
      name: string;
      position: string;
    }>;
  }>;
  staffingHeatmap: Array<{
    staffId: number;
    name: string;
    position: string;
    weeks: Array<{
      week: string;
      count: number;
    }>;
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
      email: string | null;
      role: string;
      lastLogin: string | null;
    }>;
  };
  recentActivity: Array<{
    id: number;
    actionType: string;
    entityType: string;
    description: string | null;
    username: string;
    createdAt: string;
  }>;
}
