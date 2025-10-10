import request from 'supertest';
import express from 'express';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/project.controller';
import prisma from '../utils/prisma';
import * as emailService from '../services/email.service';

// Mock dependencies
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
    changeHistory: {
      create: jest.fn(),
    },
    projectAssignment: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../services/email.service');
jest.mock('../utils/changeTracking', () => ({
  trackFieldChanges: jest.fn().mockResolvedValue(undefined),
}));

// Create test app
const app = express();
app.use(express.json());

// Mock auth middleware
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { userId: 1, username: 'testuser', role: 'admin' };
  next();
};

// Setup routes
app.get('/api/projects', mockAuth, getAllProjects);
app.get('/api/projects/:id', mockAuth, getProjectById);
app.post('/api/projects', mockAuth, createProject);
app.put('/api/projects/:id', mockAuth, updateProject);
app.delete('/api/projects/:id', mockAuth, deleteProject);

describe('Project Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    it('should get all projects with pagination', async () => {
      const mockProjects = [
        {
          id: 1,
          name: 'Project Alpha',
          category: 'HK Trx',
          status: 'Active',
          assignments: [],
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: 'Project Beta',
          category: 'US Trx',
          status: 'Active',
          assignments: [],
          updatedAt: new Date(),
        },
      ];

      (prisma.project.findMany as jest.Mock).mockResolvedValue(mockProjects);
      (prisma.project.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app).get('/api/projects?page=1&limit=50');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1,
      });
    });

    it('should filter projects by status', async () => {
      const mockProjects = [
        {
          id: 1,
          name: 'Project Alpha',
          status: 'Active',
          assignments: [],
        },
      ];

      (prisma.project.findMany as jest.Mock).mockResolvedValue(mockProjects);
      (prisma.project.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/api/projects?status=Active');

      expect(response.status).toBe(200);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'Active' }),
        })
      );
    });

    it('should filter projects by category', async () => {
      (prisma.project.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.project.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app).get('/api/projects?category=HK%20Trx');

      expect(response.status).toBe(200);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'HK Trx' }),
        })
      );
    });

    it('should search projects by name', async () => {
      const mockProjects = [
        {
          id: 1,
          name: 'Alpha Project',
          assignments: [],
        },
      ];

      (prisma.project.findMany as jest.Mock).mockResolvedValue(mockProjects);
      (prisma.project.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/api/projects?search=Alpha');

      expect(response.status).toBe(200);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.anything() }),
            ]),
          }),
        })
      );
    });

    it('should filter projects by staffId', async () => {
      const mockProjects = [
        {
          id: 1,
          name: 'Project with Staff',
          assignments: [{ staffId: 5 }],
        },
      ];

      (prisma.project.findMany as jest.Mock).mockResolvedValue(mockProjects);
      (prisma.project.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/api/projects?staffId=5');

      expect(response.status).toBe(200);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignments: {
              some: {
                staffId: 5,
              },
            },
          }),
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      (prisma.project.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should get project by id', async () => {
      const mockProject = {
        id: 1,
        name: 'Project Alpha',
        category: 'HK Trx',
        status: 'Active',
        assignments: [],
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);

      const response = await request(app).get('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        name: 'Project Alpha',
        category: 'HK Trx',
        status: 'Active',
      });
    });

    it('should return 404 for non-existent project', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/projects/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Project not found');
    });

    it('should handle invalid id format', async () => {
      (prisma.project.findUnique as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid input syntax for type integer');
      });

      const response = await request(app).get('/api/projects/invalid');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const newProject = {
        name: 'New Project',
        category: 'HK Trx',
        status: 'Active',
        priority: 'High',
      };

      const mockCreatedProject = {
        id: 3,
        ...newProject,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.project.create as jest.Mock).mockResolvedValue(mockCreatedProject);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/projects')
        .send(newProject);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: 3,
        name: 'New Project',
        category: 'HK Trx',
        status: 'Active',
      });
      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'New Project',
            category: 'HK Trx',
            status: 'Active',
          }),
        })
      );
    });

    it('should return 400 for missing required fields', async () => {
      const invalidProject = {
        category: 'HK Trx',
        // missing name
      };

      const response = await request(app)
        .post('/api/projects')
        .send(invalidProject);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should create activity log on project creation', async () => {
      const newProject = {
        name: 'New Project',
        category: 'HK Trx',
        status: 'Active',
      };

      const mockCreatedProject = { id: 3, ...newProject };

      (prisma.project.create as jest.Mock).mockResolvedValue(mockCreatedProject);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await request(app).post('/api/projects').send(newProject);

      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 1,
            actionType: 'create',
            entityType: 'project',
            entityId: 3,
          }),
        })
      );
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update a project', async () => {
      const existingProject = {
        id: 1,
        name: 'Old Name',
        status: 'Active',
        category: 'HK Trx',
      };

      const updatedData = {
        name: 'Updated Name',
        status: 'Slow-down',
      };

      const mockUpdatedProject = {
        ...existingProject,
        ...updatedData,
        assignments: [],
        lastConfirmedAt: new Date(),
        confirmedBy: {
          id: 1,
          username: 'testuser',
          staff: { id: 1, name: 'Test Staff' },
        },
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(existingProject);
      (prisma.project.update as jest.Mock).mockResolvedValue(mockUpdatedProject);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (prisma.projectAssignment.findMany as jest.Mock).mockResolvedValue([]);
      (emailService.detectProjectChanges as jest.Mock).mockReturnValue([]);

      const response = await request(app)
        .put('/api/projects/1')
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        name: 'Updated Name',
        status: 'Slow-down',
      });
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastConfirmedAt: expect.any(Date),
            confirmedBy: {
              connect: { id: 1 },
            },
          }),
        })
      );
    });

    it('should return 404 when updating non-existent project', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/projects/999')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Project not found');
    });

    it('should detect and send email notifications on changes', async () => {
      const existingProject = {
        id: 1,
        name: 'Project',
        status: 'Active',
      };

      const updatedData = {
        status: 'Suspended',
      };

      const mockUpdatedProject = {
        ...existingProject,
        ...updatedData,
        assignments: [],
        lastConfirmedAt: new Date(),
        confirmedBy: {
          id: 1,
          username: 'testuser',
          staff: { id: 1, name: 'Test Staff' },
        },
      };

      const mockAssignments = [
        {
          id: 1,
          projectId: 1,
          staffId: 1,
          staff: {
            id: 1,
            name: 'Test Staff',
            email: 'test@example.com',
            position: 'Partner',
          },
        },
      ];

      const mockChanges = [{ field: 'status', oldValue: 'Active', newValue: 'Suspended' }];

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(existingProject);
      (prisma.project.update as jest.Mock).mockResolvedValue(mockUpdatedProject);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (prisma.projectAssignment.findMany as jest.Mock).mockResolvedValue(mockAssignments);
      (emailService.detectProjectChanges as jest.Mock).mockReturnValue(mockChanges);
      (emailService.sendProjectUpdateEmails as jest.Mock).mockResolvedValue(undefined);

      await request(app).put('/api/projects/1').send(updatedData);

      expect(emailService.detectProjectChanges).toHaveBeenCalledWith(
        existingProject,
        mockUpdatedProject
      );
      expect(emailService.sendProjectUpdateEmails).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project', async () => {
      const mockProject = {
        id: 1,
        name: 'Project to Delete',
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (prisma.project.delete as jest.Mock).mockResolvedValue(mockProject);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app).delete('/api/projects/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        'message',
        'Project deleted successfully'
      );
      expect(prisma.project.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return 404 when deleting non-existent project', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).delete('/api/projects/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Project not found');
    });

    it('should create activity log on deletion', async () => {
      const mockProject = { id: 1, name: 'Project' };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (prisma.project.delete as jest.Mock).mockResolvedValue(mockProject);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await request(app).delete('/api/projects/1');

      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 1,
            actionType: 'delete',
            entityType: 'project',
            entityId: 1,
          }),
        })
      );
    });
  });
});
