import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import {
  getBillingProjects,
  getBillingProjectDetail,
} from '../controllers/billing-project.controller';
import prisma from '../utils/prisma';

// Mock dependencies
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    billingProject: {
      findUnique: jest.fn(),
    },
    staffingProjectLink: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock config
jest.mock('../config', () => ({
  __esModule: true,
  default: {
    isDevelopment: false,
    isProduction: false,
  },
}));

// Create test app
const mockAuth = (req: Partial<Request>, res: Partial<Response>, next: NextFunction) => {
  (req as any).user = { userId: 1, username: 'testuser', role: 'admin' };
  next();
};

const app = express();
app.use(express.json());
app.get('/api/billing/projects', mockAuth, getBillingProjects);
app.get('/api/billing/projects/:id', mockAuth, getBillingProjectDetail);

describe('Billing Project Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/billing/projects', () => {
    it('should return billing projects with pagination', async () => {
      const mockProjects = [
        {
          project_id: 1n,
          project_name: 'Test Project',
          client_name: 'Test Client',
          attorney_in_charge: 'John Doe',
          bc_attorney_name: 'Jane Smith',
          total_milestones: 5,
          completed_milestones: 2,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce(mockProjects);
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: 1n }]);

      const response = await request(app)
        .get('/api/billing/projects')
        .query({ page: '1', limit: '10' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].project_name).toBe('Test Project');
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('should filter by search term', async () => {
      const mockProjects = [
        {
          project_id: 1n,
          project_name: 'Test Project',
          client_name: 'Test Client',
          attorney_in_charge: 'John Doe',
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce(mockProjects);
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: 1n }]);

      const response = await request(app)
        .get('/api/billing/projects')
        .query({ search: 'Test' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter by bcAttorney', async () => {
      const mockProjects: unknown[] = [];

      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce(mockProjects);
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: 0n }]);

      const response = await request(app)
        .get('/api/billing/projects')
        .query({ bcAttorney: '123' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should handle invalid page parameter', async () => {
      const response = await request(app)
        .get('/api/billing/projects')
        .query({ page: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid page parameter');
    });

    it('should handle invalid limit parameter', async () => {
      const response = await request(app)
        .get('/api/billing/projects')
        .query({ limit: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid limit parameter');
    });

    it('should handle database errors gracefully', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/api/billing/projects');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('GET /api/billing/projects/:id', () => {
    it('should return project details', async () => {
      const mockProject = {
        project_id: 1n,
        project_name: 'Test Project',
        client_name: 'Test Client',
        cm_numbers: ['CM001'],
        fee_arrangement_text: 'Fixed fee',
      };

      const mockLinkedProjects = [
        {
          staffingProject: {
            id: 1,
            name: 'Staffing Project',
            status: 'Active',
          },
          linkedAt: new Date(),
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([mockProject]);
      (prisma.staffingProjectLink.findMany as jest.Mock).mockResolvedValueOnce(mockLinkedProjects);

      const response = await request(app).get('/api/billing/projects/1');

      expect(response.status).toBe(200);
      expect(response.body.project_name).toBe('Test Project');
      expect(response.body.linkedStaffingProjects).toHaveLength(1);
    });

    it('should return 404 for non-existent project', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

      const response = await request(app).get('/api/billing/projects/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Billing project not found');
    });

    it('should handle invalid project ID', async () => {
      const response = await request(app).get('/api/billing/projects/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid billing project ID');
    });

    it('should handle negative project ID', async () => {
      const response = await request(app).get('/api/billing/projects/-1');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid billing project ID');
    });

    it('should handle database errors', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/api/billing/projects/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
});
