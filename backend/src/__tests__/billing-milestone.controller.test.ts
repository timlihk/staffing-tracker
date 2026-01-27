import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import {
  createMilestone,
  deleteMilestone,
} from '../controllers/billing-milestone.controller';
import prisma from '../utils/prisma';

// Mock dependencies
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    billingMilestone: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    billingEngagement: {
      findUnique: jest.fn(),
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
app.post('/api/billing/engagements/:engagementId/milestones', mockAuth, createMilestone);
app.delete('/api/billing/milestones/:milestoneId', mockAuth, deleteMilestone);

describe('Billing Milestone Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/billing/engagements/:engagementId/milestones', () => {
    it('should create a milestone successfully', async () => {
      const mockEngagement = {
        engagement_id: 1n,
        project_id: 1n,
        cm_id: 1n,
        project: { project_id: 1n, project_name: 'Test Project' },
      };

      const mockMilestone = {
        milestone_id: 1n,
        engagement_id: 1n,
        description: 'Test Milestone',
        fee: 1000.00,
        status: 'pending',
        is_primary: true,
        created_at: new Date(),
      };

      (prisma.billingEngagement.findUnique as jest.Mock).mockResolvedValueOnce(mockEngagement);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });
      (prisma.billingMilestone.create as jest.Mock).mockResolvedValueOnce(mockMilestone);

      const response = await request(app)
        .post('/api/billing/engagements/1/milestones')
        .send({
          description: 'Test Milestone',
          fee: 1000.00,
          isPrimary: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.description).toBe('Test Milestone');
    });

    it('should return 404 for non-existent engagement', async () => {
      (prisma.billingEngagement.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/billing/engagements/999/milestones')
        .send({
          description: 'Test Milestone',
          fee: 1000.00,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Engagement not found');
    });

    it('should handle invalid engagement ID', async () => {
      const response = await request(app)
        .post('/api/billing/engagements/invalid/milestones')
        .send({
          description: 'Test Milestone',
          fee: 1000.00,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid engagement ID');
    });

    it('should handle negative engagement ID', async () => {
      const response = await request(app)
        .post('/api/billing/engagements/-1/milestones')
        .send({
          description: 'Test Milestone',
          fee: 1000.00,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid engagement ID');
    });

    it('should handle missing required fields', async () => {
      const mockEngagement = {
        engagement_id: 1n,
        project_id: 1n,
      };

      (prisma.billingEngagement.findUnique as jest.Mock).mockResolvedValueOnce(mockEngagement);

      const response = await request(app)
        .post('/api/billing/engagements/1/milestones')
        .send({
          // Missing description
          fee: 1000.00,
        });

      expect(response.status).toBe(400);
    });

    it('should handle database errors', async () => {
      (prisma.billingEngagement.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/billing/engagements/1/milestones')
        .send({
          description: 'Test Milestone',
          fee: 1000.00,
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('DELETE /api/billing/milestones/:milestoneId', () => {
    it('should delete a milestone successfully', async () => {
      const mockMilestone = {
        milestone_id: 1n,
        engagement_id: 1n,
        description: 'Test Milestone',
        status: 'pending',
      };

      (prisma.billingMilestone.findUnique as jest.Mock).mockResolvedValueOnce(mockMilestone);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });
      (prisma.billingMilestone.delete as jest.Mock).mockResolvedValueOnce(mockMilestone);

      const response = await request(app).delete('/api/billing/milestones/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should return 404 for non-existent milestone', async () => {
      (prisma.billingMilestone.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app).delete('/api/billing/milestones/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Milestone not found');
    });

    it('should handle invalid milestone ID', async () => {
      const response = await request(app).delete('/api/billing/milestones/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid milestone ID');
    });

    it('should handle already completed milestones', async () => {
      const mockMilestone = {
        milestone_id: 1n,
        engagement_id: 1n,
        description: 'Test Milestone',
        status: 'completed',
      };

      (prisma.billingMilestone.findUnique as jest.Mock).mockResolvedValueOnce(mockMilestone);

      const response = await request(app).delete('/api/billing/milestones/1');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('completed');
    });

    it('should handle database errors', async () => {
      (prisma.billingMilestone.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).delete('/api/billing/milestones/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
});
