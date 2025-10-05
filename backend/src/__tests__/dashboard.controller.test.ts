import request from 'supertest';
import express from 'express';
import { getDashboardSummary } from '../controllers/dashboard.controller';
import prisma from '../utils/prisma';
// Mock dependencies
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    project: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    staff: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    activityLog: {
      findMany: jest.fn(),
    },
    projectAssignment: {
      findMany: jest.fn(),
    },
  },
}));

// Create test app with mock auth middleware
const app = express();
app.use(express.json());

const mockAuth = (req: any, res: any, next: any) => {
  req.user = { id: 1, username: 'testuser', role: 'admin' };
  next();
};

app.get('/api/dashboard/summary', mockAuth, getDashboardSummary);

describe('Dashboard Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/dashboard/summary', () => {
    it('should return dashboard summary with all required data', async () => {
      const mockDate = new Date('2025-10-03');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      // Mock all Prisma queries
      (prisma.project.count as jest.Mock)
        .mockResolvedValueOnce(100) // totalProjects
        .mockResolvedValueOnce(75) // activeProjects
        .mockResolvedValueOnce(15) // slowdownProjects
        .mockResolvedValueOnce(10); // suspendedProjects

      (prisma.staff.count as jest.Mock)
        .mockResolvedValueOnce(30) // totalStaff
        .mockResolvedValueOnce(28); // activeStaff

      (prisma.project.groupBy as jest.Mock).mockResolvedValue([
        { category: 'HK Trx', _count: 30 },
        { category: 'US Trx', _count: 25 },
        { category: 'HK Comp', _count: 15 },
        { category: 'US Comp', _count: 5 },
      ]);

      (prisma.project.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: 'Project A',
          category: 'HK Trx',
          status: 'Active',
          filingDate: new Date('2025-10-15'),
          assignments: [
            {
              staff: { id: 1, name: 'Partner A', role: 'Partner' },
              jurisdiction: 'HK Law',
            },
          ],
        },
      ]);

      (prisma.staff.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: 'Partner A',
          role: 'Partner',
          weeks: [{ week: '2025-W41', count: 3 }],
        },
      ]);

      (prisma.projectAssignment.findMany as jest.Mock).mockResolvedValue([]);

      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: 2,
          username: 'newuser',
          email: 'new@example.com',
          role: 'viewer',
          mustResetPassword: true,
          lastLogin: null,
        },
      ]);

      (prisma.activityLog.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          actionType: 'CREATE',
          entityType: 'project',
          description: 'Created project "New Deal"',
          user: { username: 'admin' },
          createdAt: new Date('2025-10-02'),
        },
      ]);

      const response = await request(app).get('/api/dashboard/summary');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary).toMatchObject({
        totalProjects: 100,
        activeProjects: 75,
        slowdownProjects: 15,
        suspendedProjects: 10,
        totalStaff: 30,
        activeStaff: 28,
      });

      expect(response.body).toHaveProperty('projectsByStatus');
      expect(response.body.projectsByStatus).toHaveLength(3);

      expect(response.body).toHaveProperty('projectsByCategory');
      expect(response.body.projectsByCategory).toHaveLength(4);

      expect(response.body).toHaveProperty('dealRadar');
      expect(response.body).toHaveProperty('staffingHeatmap');
      expect(response.body).toHaveProperty('actionItems');
      expect(response.body.actionItems).toHaveProperty('unstaffedMilestones');
      expect(response.body.actionItems).toHaveProperty('pendingResets');

      expect(response.body.actionItems.pendingResets).toHaveLength(1);
      expect(response.body.actionItems.pendingResets[0]).toMatchObject({
        username: 'newuser',
        email: 'new@example.com',
      });

      expect(response.body).toHaveProperty('recentActivity');
    });

    it('should handle errors gracefully', async () => {
      (prisma.project.count as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app).get('/api/dashboard/summary');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('Deal Radar - Upcoming Milestones', () => {
    it('should identify filing dates within 30 days', async () => {
      const now = new Date('2025-10-03');
      const filingDate = new Date('2025-10-20'); // 17 days away

      (prisma.project.count as jest.Mock).mockResolvedValue(0);
      (prisma.staff.count as jest.Mock).mockResolvedValue(0);
      (prisma.project.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.project.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: 'Urgent Deal',
          category: 'HK Trx',
          status: 'Active',
          filingDate,
          listingDate: null,
          assignments: [
            {
              staff: { id: 1, name: 'Partner A', role: 'Partner' },
              jurisdiction: 'HK Law',
            },
          ],
        },
      ]);
      (prisma.staff.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.activityLog.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/dashboard/summary');

      expect(response.status).toBe(200);
      expect(response.body.dealRadar).toBeDefined();
      expect(response.body.dealRadar.length).toBeGreaterThan(0);

      const filingEvent = response.body.dealRadar.find(
        (e: any) => e.type === 'Filing' && e.projectId === 1
      );
      expect(filingEvent).toBeDefined();
      expect(filingEvent.projectName).toBe('Urgent Deal');
    });
  });

  describe('Action Items - Unstaffed Milestones', () => {
    it('should identify projects with milestones but no partners', async () => {
      const filingDate = new Date('2025-10-15');

      (prisma.project.count as jest.Mock).mockResolvedValue(0);
      (prisma.staff.count as jest.Mock).mockResolvedValue(0);
      (prisma.project.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.project.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: 'Unstaffed Project',
          category: 'US Trx',
          status: 'Active',
          filingDate,
          assignments: [], // No partners assigned!
        },
      ]);
      (prisma.staff.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.activityLog.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/dashboard/summary');

      expect(response.status).toBe(200);
      expect(response.body.actionItems.unstaffedMilestones).toBeDefined();

      const unstaffed = response.body.actionItems.unstaffedMilestones.find(
        (m: any) => m.projectId === 1
      );
      expect(unstaffed).toBeDefined();
      expect(unstaffed.needsUSPartner).toBe(true);
    });
  });

  describe('Team Member Deduplication in Deal Radar', () => {
    it('should deduplicate team members with same staff ID', async () => {
      const now = new Date();
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + 15);

      // Mock projects with duplicate staff assignments
      const mockProjects = [
        {
          id: 1,
          name: 'Sailing',
          category: 'HK Trx',
          status: 'Active',
          priority: 'High',
          side: 'Buyer',
          filingDate: futureDate,
          listingDate: null,
          assignments: [
            {
              staff: {
                id: 10,
                name: 'George Zheng',
                position: 'Partner',
              },
            },
            {
              staff: {
                id: 10, // Same staff ID - should be deduplicated
                name: 'George Zheng',
                position: 'Partner',
              },
            },
            {
              staff: {
                id: 20,
                name: 'Jane Associate',
                position: 'Associate',
              },
            },
          ],
        },
      ];

      (prisma.project.count as jest.Mock).mockResolvedValue(10);
      (prisma.staff.count as jest.Mock).mockResolvedValue(15);
      (prisma.project.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.project.findMany as jest.Mock).mockResolvedValue(mockProjects);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.activityLog.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/dashboard/summary');

      expect(response.status).toBe(200);
      expect(response.body.dealRadar).toBeDefined();
      expect(response.body.dealRadar.length).toBeGreaterThan(0);

      // Check that team members are deduplicated
      const firstEvent = response.body.dealRadar[0];
      expect(firstEvent.teamMembers).toBeDefined();

      // Should have only 2 unique staff members (not 3)
      const uniqueStaffIds = new Set(firstEvent.teamMembers.map((m: any) => m.id));
      expect(uniqueStaffIds.size).toBe(2); // George Zheng (once) and Jane Associate

      // Verify George Zheng appears only once
      const georgeEntries = firstEvent.teamMembers.filter((m: any) => m.id === 10);
      expect(georgeEntries.length).toBe(1);
    });

    it('should include side field in Deal Radar events', async () => {
      const now = new Date();
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + 15);

      const mockProjects = [
        {
          id: 1,
          name: 'Test Project',
          category: 'HK Trx',
          status: 'Active',
          priority: 'High',
          side: 'Seller',
          filingDate: futureDate,
          listingDate: null,
          assignments: [
            {
              staff: {
                id: 10,
                name: 'Partner Name',
                position: 'Partner',
              },
            },
          ],
        },
      ];

      (prisma.project.count as jest.Mock).mockResolvedValue(10);
      (prisma.staff.count as jest.Mock).mockResolvedValue(15);
      (prisma.project.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.project.findMany as jest.Mock).mockResolvedValue(mockProjects);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.activityLog.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/dashboard/summary');

      expect(response.status).toBe(200);
      expect(response.body.dealRadar).toBeDefined();
      expect(response.body.dealRadar[0].side).toBe('Seller');
    });

    it('should include team member position data', async () => {
      const now = new Date();
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + 15);

      const mockProjects = [
        {
          id: 1,
          name: 'Test Project',
          category: 'HK Trx',
          status: 'Active',
          priority: null,
          side: null,
          filingDate: futureDate,
          listingDate: null,
          assignments: [
            {
              staff: {
                id: 10,
                name: 'Partner Name',
                position: 'Partner',
              },
            },
            {
              staff: {
                id: 20,
                name: 'Associate Name',
                position: 'Associate',
              },
            },
            {
              staff: {
                id: 30,
                name: 'FLIC Name',
                position: 'Junior FLIC',
              },
            },
          ],
        },
      ];

      (prisma.project.count as jest.Mock).mockResolvedValue(10);
      (prisma.staff.count as jest.Mock).mockResolvedValue(15);
      (prisma.project.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.project.findMany as jest.Mock).mockResolvedValue(mockProjects);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.activityLog.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/dashboard/summary');

      expect(response.status).toBe(200);
      expect(response.body.dealRadar).toBeDefined();
      const teamMembers = response.body.dealRadar[0].teamMembers;

      expect(teamMembers).toHaveLength(3);
      expect(teamMembers[0]).toHaveProperty('position');
      expect(teamMembers[0].position).toBe('Partner');
      expect(teamMembers[1].position).toBe('Associate');
      expect(teamMembers[2].position).toBe('Junior FLIC');
    });
  });
});
