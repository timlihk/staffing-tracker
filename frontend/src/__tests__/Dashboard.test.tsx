import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import * as useDashboardHook from '../hooks/useDashboard';

// Mock the dashboard hook
vi.mock('../hooks/useDashboard');

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading skeleton when data is loading', () => {
    vi.spyOn(useDashboardHook, 'useDashboard').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<Dashboard />, { wrapper });

    // Should show skeleton loaders
    expect(screen.getByTestId('dashboard-skeleton') || document.querySelector('.MuiSkeleton-root')).toBeTruthy();
  });

  it('should render error message when data fetch fails', () => {
    vi.spyOn(useDashboardHook, 'useDashboard').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
    } as any);

    render(<Dashboard />, { wrapper });

    expect(screen.getByText(/Failed to load dashboard data/i)).toBeInTheDocument();
  });

  it('should render dashboard with Deal Radar data', async () => {
    const mockData = {
      summary: {
        totalProjects: 100,
        activeProjects: 75,
        slowdownProjects: 15,
        suspendedProjects: 10,
        totalStaff: 30,
        activeStaff: 28,
      },
      projectsByStatus: [
        { status: 'Active', count: 75 },
        { status: 'Slow-down', count: 15 },
        { status: 'Suspended', count: 10 },
      ],
      projectsByCategory: [
        { category: 'HK Trx', count: 30 },
        { category: 'US Trx', count: 25 },
      ],
      dealRadar: [
        {
          type: 'Filing',
          projectId: 1,
          projectName: 'Urgent IPO',
          category: 'HK Trx',
          status: 'Active',
          milestoneDate: '2025-10-15',
          usPartners: ['Partner A'],
          hkPartners: ['Partner B'],
        },
        {
          type: 'Listing',
          projectId: 2,
          projectName: 'Tech Listing',
          category: 'US Trx',
          status: 'Active',
          milestoneDate: '2025-10-20',
          usPartners: [],
          hkPartners: ['Partner C'],
        },
      ],
      staffingHeatmap: [
        {
          staffId: 1,
          name: 'Partner A',
          role: 'Partner',
          weeks: [
            { week: '2025-W41', count: 3 },
            { week: '2025-W42', count: 2 },
          ],
        },
      ],
      actionItems: {
        unstaffedMilestones: [
          {
            projectId: 3,
            projectName: 'Understaffed Deal',
            category: 'HK Comp',
            status: 'Active',
            milestoneDate: '2025-10-25',
            needsUSPartner: true,
            needsHKPartner: false,
          },
        ],
        pendingResets: [
          {
            id: 5,
            username: 'newuser',
            email: 'new@example.com',
            role: 'viewer',
            lastLogin: null,
          },
        ],
      },
      recentActivity: [
        {
          id: 1,
          actionType: 'CREATE',
          entityType: 'project',
          description: 'Created project "New Deal"',
          username: 'admin',
          createdAt: '2025-10-02T10:00:00Z',
        },
      ],
    };

    vi.spyOn(useDashboardHook, 'useDashboard').mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    } as any);

    render(<Dashboard />, { wrapper });

    await waitFor(() => {
      // Check summary cards with Deal Radar metrics
      expect(screen.getByText('75')).toBeInTheDocument(); // Active projects
      expect(screen.getByText('2')).toBeInTheDocument(); // Filings (dealRadar with type=Filing)
      expect(screen.getByText('1')).toBeInTheDocument(); // Listings or Pending Resets
    });
  });

  it('should handle empty Deal Radar gracefully', () => {
    const mockData = {
      summary: {
        activeProjects: 10,
      },
      projectsByStatus: [],
      projectsByCategory: [],
      dealRadar: [],
      staffingHeatmap: [],
      actionItems: {
        unstaffedMilestones: [],
        pendingResets: [],
      },
      recentActivity: [],
    };

    vi.spyOn(useDashboardHook, 'useDashboard').mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    } as any);

    render(<Dashboard />, { wrapper });

    // Should render without errors
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should use safe fallbacks for useMemo hooks', () => {
    // Test with undefined data to ensure optional chaining works
    vi.spyOn(useDashboardHook, 'useDashboard').mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as any);

    render(<Dashboard />, { wrapper });

    expect(screen.getByText(/No dashboard data available/i)).toBeInTheDocument();
  });
});
