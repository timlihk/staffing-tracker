import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
} from '../controllers/staff.controller';
import prisma from '../utils/prisma';

// Mock dependencies
jest.mock('../utils/changeTracking', () => ({
  trackFieldChanges: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    staff: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
    staffChangeHistory: {
      create: jest.fn(),
    },
  },
}));

// Create test app
const app = express();
app.use(express.json());

// Mock auth middleware
const mockAuth = (req: Partial<Request>, res: Partial<Response>, next: NextFunction) => {
  (req as any).user = { userId: 1, username: 'testuser', role: 'admin' };
  next();
};

// Setup routes
app.get('/api/staff', mockAuth, getAllStaff);
app.get('/api/staff/:id', mockAuth, getStaffById);
app.post('/api/staff', mockAuth, createStaff);
app.put('/api/staff/:id', mockAuth, updateStaff);
app.delete('/api/staff/:id', mockAuth, deleteStaff);

describe('Staff Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/staff', () => {
    it('should get all staff members', async () => {
      const mockStaff = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          position: 'Partner',
          department: 'US Law',
          status: 'active',
          assignments: [],
        },
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane@example.com',
          position: 'Associate',
          department: 'HK Law',
          status: 'active',
          assignments: [],
        },
      ];

      (prisma.staff.findMany as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app).get('/api/staff');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        id: 1,
        name: 'John Doe',
        position: 'Partner',
      });
    });

    it('should filter staff by position', async () => {
      const mockStaff = [
        {
          id: 1,
          name: 'John Doe',
          position: 'Partner',
          assignments: [],
        },
      ];

      (prisma.staff.findMany as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app).get('/api/staff?position=Partner');

      expect(response.status).toBe(200);
      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ position: 'Partner' }),
        })
      );
    });

    it('should filter staff by department', async () => {
      (prisma.staff.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/staff?department=US%20Law');

      expect(response.status).toBe(200);
      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ department: 'US Law' }),
        })
      );
    });

    it('should filter staff by status', async () => {
      (prisma.staff.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/staff?status=active');

      expect(response.status).toBe(200);
      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        })
      );
    });

    it('should search staff by name', async () => {
      const mockStaff = [
        {
          id: 1,
          name: 'John Doe',
          assignments: [],
        },
      ];

      (prisma.staff.findMany as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app).get('/api/staff?search=John');

      expect(response.status).toBe(200);
      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.anything() }),
            ]),
          }),
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      (prisma.staff.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app).get('/api/staff');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('GET /api/staff/:id', () => {
    it('should get staff member by id', async () => {
      const mockStaff = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        position: 'Partner',
        department: 'US Law',
        status: 'active',
        assignments: [],
      };

      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app).get('/api/staff/1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        position: 'Partner',
      });
    });

    it('should return 404 for non-existent staff member', async () => {
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/staff/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Staff member not found');
    });

    it('should include assignments in response', async () => {
      const mockStaff = {
        id: 1,
        name: 'John Doe',
        assignments: [
          {
            id: 1,
            projectId: 5,
            project: {
              id: 5,
              name: 'Project Alpha',
            },
          },
        ],
      };

      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);

      const response = await request(app).get('/api/staff/1');

      expect(response.status).toBe(200);
      expect(response.body.assignments).toHaveLength(1);
      expect(response.body.assignments[0].project.name).toBe('Project Alpha');
    });
  });

  describe('POST /api/staff', () => {
    it('should create a new staff member', async () => {
      const newStaff = {
        name: 'New Staff',
        email: 'newstaff@example.com',
        role: 'Associate',
        department: 'HK Law',
        status: 'active',
      };

      const mockCreatedStaff = {
        id: 3,
        name: 'New Staff',
        email: 'newstaff@example.com',
        position: 'Associate',
        department: 'HK Law',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.staff.create as jest.Mock).mockResolvedValue(mockCreatedStaff);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/staff')
        .send(newStaff);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: 3,
        name: 'New Staff',
        email: 'newstaff@example.com',
        position: 'Associate',
      });
    });

    it('should return 400 for missing required fields', async () => {
      const invalidStaff = {
        email: 'test@example.com',
        // missing name and role
      };

      const response = await request(app)
        .post('/api/staff')
        .send(invalidStaff);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Name and role are required');
    });

    it('should default status to active if not provided', async () => {
      const newStaff = {
        name: 'New Staff',
        email: 'newstaff@example.com',
        role: 'Associate',
      };

      const mockCreatedStaff = {
        id: 3,
        ...newStaff,
        position: 'Associate',
        status: 'active',
      };

      (prisma.staff.create as jest.Mock).mockResolvedValue(mockCreatedStaff);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await request(app).post('/api/staff').send(newStaff);

      expect(prisma.staff.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'active',
          }),
        })
      );
    });

    it('should create activity log on staff creation', async () => {
      const newStaff = {
        name: 'New Staff',
        role: 'Associate',
      };

      const mockCreatedStaff = { id: 3, ...newStaff, position: 'Associate' };

      (prisma.staff.create as jest.Mock).mockResolvedValue(mockCreatedStaff);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await request(app).post('/api/staff').send(newStaff);

      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 1,
            actionType: 'create',
            entityType: 'staff',
            entityId: 3,
          }),
        })
      );
    });
  });

  describe('PUT /api/staff/:id', () => {
    it('should update a staff member', async () => {
      const existingStaff = {
        id: 1,
        name: 'Old Name',
        position: 'Associate',
        email: 'old@example.com',
      };

      const updatedData = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      const mockUpdatedStaff = {
        ...existingStaff,
        ...updatedData,
      };

      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(existingStaff);
      (prisma.staff.update as jest.Mock).mockResolvedValue(mockUpdatedStaff);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .put('/api/staff/1')
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        name: 'Updated Name',
        email: 'updated@example.com',
      });
    });

    it('should return 404 when updating non-existent staff', async () => {
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/staff/999')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Staff member not found');
    });

    it('should track field changes in change history', async () => {
      const existingStaff = {
        id: 1,
        name: 'Old Name',
        email: 'old@example.com',
        position: 'Associate',
      };

      const updatedData = {
        name: 'New Name',
      };

      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(existingStaff);
      (prisma.staff.update as jest.Mock).mockResolvedValue({ ...existingStaff, ...updatedData });
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (prisma.staffChangeHistory.create as jest.Mock).mockResolvedValue({});

      await request(app).put('/api/staff/1').send(updatedData);

      expect(prisma.activityLog.create).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/staff/:id', () => {
    it('should delete a staff member', async () => {
      const mockStaff = {
        id: 1,
        name: 'Staff to Delete',
      };

      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.staff.delete as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app).delete('/api/staff/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        'message',
        'Staff member deleted successfully'
      );
      expect(prisma.staff.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return 404 when deleting non-existent staff', async () => {
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).delete('/api/staff/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Staff member not found');
    });

    it('should create activity log on deletion', async () => {
      const mockStaff = { id: 1, name: 'Staff' };

      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.staff.delete as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await request(app).delete('/api/staff/1');

      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 1,
            actionType: 'delete',
            entityType: 'staff',
            entityId: 1,
          }),
        })
      );
    });
  });
});
