import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import {
  linkProjects,
  unlinkProjects,
} from '../controllers/billing-mapping.controller';
import prisma from '../utils/prisma';

// Mock dependencies
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    billingProject: {
      findUnique: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    staffingProjectLink: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('../config', () => ({
  __esModule: true,
  default: {
    isDevelopment: false,
  },
}));

// Create test app
const mockAuth = (req: Partial<Request>, res: Partial<Response>, next: NextFunction) => {
  (req as any).user = { userId: 1, username: 'testuser', role: 'admin' };
  next();
};

const app = express();
app.use(express.json());
app.post('/api/billing/mapping/link', mockAuth, linkProjects);
app.delete('/api/billing/mapping/unlink/:linkId', mockAuth, unlinkProjects);

describe('Billing Mapping Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/billing/mapping/link', () => {
    it('should link billing and staffing projects successfully', async () => {
      const mockBillingProject = {
        project_id: 1n,
        project_name: 'Billing Project',
      };

      const mockStaffingProject = {
        id: 2,
        name: 'Staffing Project',
      };

      const mockLink = {
        link_id: 1,
        billing_project_id: 1n,
        staffing_project_id: 2,
        linked_at: new Date(),
        linked_by: 1,
      };

      (prisma.billingProject.findUnique as jest.Mock).mockResolvedValueOnce(mockBillingProject);
      (prisma.project.findUnique as jest.Mock).mockResolvedValueOnce(mockStaffingProject);
      (prisma.staffingProjectLink.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.staffingProjectLink.create as jest.Mock).mockResolvedValueOnce(mockLink);
      (prisma.activityLog.create as jest.Mock).mockResolvedValueOnce({});

      const response = await request(app)
        .post('/api/billing/mapping/link')
        .send({
          billingProjectId: '1',
          staffingProjectId: 2,
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('linked successfully');
    });

    it('should return 404 for non-existent billing project', async () => {
      (prisma.billingProject.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/billing/mapping/link')
        .send({
          billingProjectId: '999',
          staffingProjectId: 2,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Billing project not found');
    });

    it('should return 404 for non-existent staffing project', async () => {
      const mockBillingProject = {
        project_id: 1n,
        project_name: 'Billing Project',
      };

      (prisma.billingProject.findUnique as jest.Mock).mockResolvedValueOnce(mockBillingProject);
      (prisma.project.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/billing/mapping/link')
        .send({
          billingProjectId: '1',
          staffingProjectId: 999,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Staffing project not found');
    });

    it('should handle existing link (conflict)', async () => {
      const mockBillingProject = {
        project_id: 1n,
        project_name: 'Billing Project',
      };

      const mockStaffingProject = {
        id: 2,
        name: 'Staffing Project',
      };

      const existingLink = {
        link_id: 1,
        billing_project_id: 1n,
        staffing_project_id: 2,
      };

      (prisma.billingProject.findUnique as jest.Mock).mockResolvedValueOnce(mockBillingProject);
      (prisma.project.findUnique as jest.Mock).mockResolvedValueOnce(mockStaffingProject);
      (prisma.staffingProjectLink.findFirst as jest.Mock).mockResolvedValueOnce(existingLink);

      const response = await request(app)
        .post('/api/billing/mapping/link')
        .send({
          billingProjectId: '1',
          staffingProjectId: 2,
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already linked');
    });

    it('should handle invalid billing project ID', async () => {
      const response = await request(app)
        .post('/api/billing/mapping/link')
        .send({
          billingProjectId: 'invalid',
          staffingProjectId: 2,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid billing project ID');
    });

    it('should handle missing staffing project ID', async () => {
      const response = await request(app)
        .post('/api/billing/mapping/link')
        .send({
          billingProjectId: '1',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Staffing project ID is required');
    });

    it('should handle database errors', async () => {
      (prisma.billingProject.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/billing/mapping/link')
        .send({
          billingProjectId: '1',
          staffingProjectId: 2,
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('DELETE /api/billing/mapping/unlink/:linkId', () => {
    it('should unlink projects successfully', async () => {
      const mockLink = {
        link_id: 1,
        billing_project_id: 1n,
        staffing_project_id: 2,
      };

      (prisma.staffingProjectLink.findFirst as jest.Mock).mockResolvedValueOnce(mockLink);
      (prisma.staffingProjectLink.delete as jest.Mock).mockResolvedValueOnce(mockLink);
      (prisma.activityLog.create as jest.Mock).mockResolvedValueOnce({});

      const response = await request(app).delete('/api/billing/mapping/unlink/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('unlinked successfully');
    });

    it('should return 404 for non-existent link', async () => {
      (prisma.staffingProjectLink.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app).delete('/api/billing/mapping/unlink/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project link not found');
    });

    it('should handle invalid link ID', async () => {
      const response = await request(app).delete('/api/billing/mapping/unlink/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid link ID');
    });

    it('should handle negative link ID', async () => {
      const response = await request(app).delete('/api/billing/mapping/unlink/-1');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid link ID');
    });

    it('should handle database errors', async () => {
      (prisma.staffingProjectLink.findFirst as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).delete('/api/billing/mapping/unlink/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
});
