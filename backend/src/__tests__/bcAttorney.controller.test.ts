import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { addBcAttorney, removeBcAttorney } from '../controllers/bcAttorney.controller';
import prisma from '../utils/prisma';

// Mock dependencies
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    project: {
      findUnique: jest.fn(),
    },
    staff: {
      findUnique: jest.fn(),
    },
    projectBcAttorney: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
  },
  invalidateCache: jest.fn(),
  CACHE_KEYS: {
    PROJECT_DETAIL: (id: number) => `project:${id}`,
  },
}));

// Create test app
const app = express();
app.use(express.json());

// Mock auth middleware
const mockAuth = (req: Partial<Request>, res: Partial<Response>, next: NextFunction) => {
  (req as any).user = { userId: 1, username: 'testuser', role: 'admin' };
  (req as any).log = {
    info: jest.fn(),
  };
  next();
};

// Setup routes
app.post('/api/projects/:id/bc-attorneys', mockAuth, addBcAttorney);
app.delete('/api/projects/:id/bc-attorneys/:staffId', mockAuth, removeBcAttorney);

describe('B&C Attorney Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/projects/:id/bc-attorneys', () => {
    it('should add a B&C attorney successfully', async () => {
      const mockProject = {
        id: 1,
        name: 'Test Project',
      };

      const mockStaff = {
        id: 5,
        name: 'Test Attorney',
      };

      const mockBcAttorney = {
        id: 1,
        projectId: 1,
        staffId: 5,
        staff: {
          id: 5,
          name: 'Test Attorney',
          position: 'Partner',
        },
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.projectBcAttorney.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.projectBcAttorney.create as jest.Mock).mockResolvedValue(mockBcAttorney);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/projects/1/bc-attorneys')
        .send({ staffId: 5 });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: 1,
        projectId: 1,
        staffId: 5,
        staff: {
          id: 5,
          name: 'Test Attorney',
          position: 'Partner',
        },
      });
      expect(prisma.projectBcAttorney.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            projectId: 1,
            staffId: 5,
          },
        })
      );
    });

    it('should return 400 when staffId is missing', async () => {
      const response = await request(app)
        .post('/api/projects/1/bc-attorneys')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Staff ID is required');
    });

    it('should return 400 for invalid project ID', async () => {
      const response = await request(app)
        .post('/api/projects/invalid/bc-attorneys')
        .send({ staffId: 5 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid project ID or staff ID');
    });

    it('should return 404 when project not found', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/projects/999/bc-attorneys')
        .send({ staffId: 5 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Project not found');
    });

    it('should return 404 when staff member not found', async () => {
      const mockProject = { id: 1, name: 'Test Project' };
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/projects/1/bc-attorneys')
        .send({ staffId: 999 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Staff member not found');
    });

    it('should return 409 when B&C attorney already exists', async () => {
      const mockProject = { id: 1, name: 'Test Project' };
      const mockStaff = { id: 5, name: 'Test Attorney' };
      const mockExistingBcAttorney = { id: 1, projectId: 1, staffId: 5 };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.projectBcAttorney.findUnique as jest.Mock).mockResolvedValue(mockExistingBcAttorney);

      const response = await request(app)
        .post('/api/projects/1/bc-attorneys')
        .send({ staffId: 5 });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'B&C attorney already exists for this project');
    });

    it('should handle database errors gracefully', async () => {
      const mockProject = { id: 1, name: 'Test Project' };
      const mockStaff = { id: 5, name: 'Test Attorney' };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.projectBcAttorney.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.projectBcAttorney.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/projects/1/bc-attorneys')
        .send({ staffId: 5 });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('DELETE /api/projects/:id/bc-attorneys/:staffId', () => {
    it('should remove a B&C attorney successfully', async () => {
      const mockBcAttorney = {
        id: 1,
        projectId: 1,
        staffId: 5,
        project: {
          name: 'Test Project',
        },
        staff: {
          name: 'Test Attorney',
        },
      };

      (prisma.projectBcAttorney.findUnique as jest.Mock).mockResolvedValue(mockBcAttorney);
      (prisma.projectBcAttorney.delete as jest.Mock).mockResolvedValue(mockBcAttorney);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app).delete('/api/projects/1/bc-attorneys/5');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'B&C attorney removed successfully');
      expect(prisma.projectBcAttorney.delete).toHaveBeenCalledWith({
        where: {
          projectId_staffId: {
            projectId: 1,
            staffId: 5,
          },
        },
      });
    });

    it('should return 400 for invalid IDs', async () => {
      const response = await request(app).delete('/api/projects/invalid/bc-attorneys/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid project ID or staff ID');
    });

    it('should return 404 when B&C attorney not found', async () => {
      (prisma.projectBcAttorney.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).delete('/api/projects/1/bc-attorneys/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'B&C attorney not found');
    });

    it('should handle database errors gracefully', async () => {
      const mockBcAttorney = {
        id: 1,
        projectId: 1,
        staffId: 5,
        project: { name: 'Test Project' },
        staff: { name: 'Test Attorney' },
      };

      (prisma.projectBcAttorney.findUnique as jest.Mock).mockResolvedValue(mockBcAttorney);
      (prisma.projectBcAttorney.delete as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/projects/1/bc-attorneys/5');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });
});