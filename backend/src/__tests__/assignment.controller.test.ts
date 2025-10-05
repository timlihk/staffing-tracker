import request from 'supertest';
import express from 'express';
import {
  getAllAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  bulkCreateAssignments,
} from '../controllers/assignment.controller';
import prisma from '../utils/prisma';

// Mock dependencies
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    projectAssignment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    staff: {
      findUnique: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
    projectChangeHistory: {
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
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { userId: 1, username: 'testuser', role: 'admin' };
  next();
};

// Setup routes
app.get('/api/assignments', mockAuth, getAllAssignments);
app.get('/api/assignments/:id', mockAuth, getAssignmentById);
app.post('/api/assignments', mockAuth, createAssignment);
app.put('/api/assignments/:id', mockAuth, updateAssignment);
app.delete('/api/assignments/:id', mockAuth, deleteAssignment);
app.post('/api/assignments/bulk', mockAuth, bulkCreateAssignments);

describe('Assignment Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/assignments', () => {
    it('should get all assignments', async () => {
      const mockAssignments = [
        {
          id: 1,
          projectId: 1,
          staffId: 1,
          jurisdiction: 'US',
          project: { id: 1, name: 'Project Alpha' },
          staff: { id: 1, name: 'John Doe', position: 'Partner' },
        },
        {
          id: 2,
          projectId: 2,
          staffId: 2,
          jurisdiction: 'HK',
          project: { id: 2, name: 'Project Beta' },
          staff: { id: 2, name: 'Jane Smith', position: 'Associate' },
        },
      ];

      (prisma.projectAssignment.findMany as jest.Mock).mockResolvedValue(
        mockAssignments
      );

      const response = await request(app).get('/api/assignments');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        id: 1,
        projectId: 1,
        staffId: 1,
      });
    });

    it('should filter assignments by projectId', async () => {
      const mockAssignments = [
        {
          id: 1,
          projectId: 5,
          staffId: 1,
          project: { id: 5, name: 'Project Alpha' },
          staff: { id: 1, name: 'John Doe' },
        },
      ];

      (prisma.projectAssignment.findMany as jest.Mock).mockResolvedValue(
        mockAssignments
      );

      const response = await request(app).get('/api/assignments?projectId=5');

      expect(response.status).toBe(200);
      expect(prisma.projectAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 5 }),
        })
      );
    });

    it('should filter assignments by staffId', async () => {
      const mockAssignments = [
        {
          id: 1,
          projectId: 1,
          staffId: 3,
          project: { id: 1, name: 'Project Alpha' },
          staff: { id: 3, name: 'John Doe' },
        },
      ];

      (prisma.projectAssignment.findMany as jest.Mock).mockResolvedValue(
        mockAssignments
      );

      const response = await request(app).get('/api/assignments?staffId=3');

      expect(response.status).toBe(200);
      expect(prisma.projectAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ staffId: 3 }),
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      (prisma.projectAssignment.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app).get('/api/assignments');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('GET /api/assignments/:id', () => {
    it('should get assignment by id', async () => {
      const mockAssignment = {
        id: 1,
        projectId: 1,
        staffId: 1,
        jurisdiction: 'US',
        project: { id: 1, name: 'Project Alpha' },
        staff: { id: 1, name: 'John Doe', position: 'Partner' },
      };

      (prisma.projectAssignment.findUnique as jest.Mock).mockResolvedValue(
        mockAssignment
      );

      const response = await request(app).get('/api/assignments/1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        projectId: 1,
        staffId: 1,
        jurisdiction: 'US',
      });
    });

    it('should return 404 for non-existent assignment', async () => {
      (prisma.projectAssignment.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/assignments/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Assignment not found');
    });
  });

  describe('POST /api/assignments', () => {
    it('should create a new assignment', async () => {
      const newAssignment = {
        projectId: 1,
        staffId: 1,
        jurisdiction: 'US',
      };

      const mockProject = { id: 1, name: 'Project Alpha' };
      const mockStaff = { id: 1, name: 'John Doe', position: 'Partner' };
      const mockCreatedAssignment = {
        id: 1,
        ...newAssignment,
        project: mockProject,
        staff: mockStaff,
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.projectAssignment.create as jest.Mock).mockResolvedValue(
        mockCreatedAssignment
      );
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (prisma.projectChangeHistory.create as jest.Mock).mockResolvedValue({});
      (prisma.staffChangeHistory.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/assignments')
        .send(newAssignment);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: 1,
        projectId: 1,
        staffId: 1,
        jurisdiction: 'US',
      });
    });

    it('should return 400 for missing required fields', async () => {
      const invalidAssignment = {
        projectId: 1,
        // missing staffId
      };

      const response = await request(app)
        .post('/api/assignments')
        .send(invalidAssignment);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'error',
        'ProjectId and staffId are required'
      );
    });

    it('should return 404 for non-existent project', async () => {
      const newAssignment = {
        projectId: 999,
        staffId: 1,
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'John Doe',
      });

      const response = await request(app)
        .post('/api/assignments')
        .send(newAssignment);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Project not found');
    });

    it('should return 404 for non-existent staff', async () => {
      const newAssignment = {
        projectId: 1,
        staffId: 999,
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Project Alpha',
      });
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/assignments')
        .send(newAssignment);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Staff member not found');
    });

    it('should return 400 for duplicate assignment', async () => {
      const newAssignment = {
        projectId: 1,
        staffId: 1,
      };

      const mockProject = { id: 1, name: 'Project Alpha' };
      const mockStaff = { id: 1, name: 'John Doe', position: 'Partner' };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.projectAssignment.create as jest.Mock).mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint failed',
      });

      const response = await request(app)
        .post('/api/assignments')
        .send(newAssignment);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'error',
        'This assignment already exists'
      );
    });

    it('should create activity log and change history', async () => {
      const newAssignment = {
        projectId: 1,
        staffId: 1,
        jurisdiction: 'US',
      };

      const mockProject = { id: 1, name: 'Project Alpha' };
      const mockStaff = { id: 1, name: 'John Doe', position: 'Partner' };
      const mockCreatedAssignment = {
        id: 1,
        ...newAssignment,
        project: mockProject,
        staff: mockStaff,
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.projectAssignment.create as jest.Mock).mockResolvedValue(
        mockCreatedAssignment
      );
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (prisma.projectChangeHistory.create as jest.Mock).mockResolvedValue({});
      (prisma.staffChangeHistory.create as jest.Mock).mockResolvedValue({});

      await request(app).post('/api/assignments').send(newAssignment);

      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 1,
            actionType: 'assign',
            entityType: 'assignment',
          }),
        })
      );

      expect(prisma.projectChangeHistory.create).toHaveBeenCalled();
      expect(prisma.staffChangeHistory.create).toHaveBeenCalled();
    });
  });

  describe('PUT /api/assignments/:id', () => {
    it('should update an assignment', async () => {
      const existingAssignment = {
        id: 1,
        projectId: 1,
        staffId: 1,
        jurisdiction: 'US',
        project: { id: 1, name: 'Project Alpha' },
        staff: { id: 1, name: 'John Doe' },
      };

      const updatedData = {
        jurisdiction: 'HK',
        notes: 'Updated notes',
      };

      const mockUpdatedAssignment = {
        ...existingAssignment,
        ...updatedData,
      };

      (prisma.projectAssignment.findUnique as jest.Mock).mockResolvedValue(
        existingAssignment
      );
      (prisma.projectAssignment.update as jest.Mock).mockResolvedValue(
        mockUpdatedAssignment
      );
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .put('/api/assignments/1')
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        jurisdiction: 'HK',
        notes: 'Updated notes',
      });
    });

    it('should return 404 when updating non-existent assignment', async () => {
      (prisma.projectAssignment.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/assignments/999')
        .send({ jurisdiction: 'HK' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Assignment not found');
    });

    it('should create activity log on update', async () => {
      const existingAssignment = {
        id: 1,
        projectId: 1,
        staffId: 1,
        project: { id: 1, name: 'Project Alpha' },
        staff: { id: 1, name: 'John Doe' },
      };

      (prisma.projectAssignment.findUnique as jest.Mock).mockResolvedValue(
        existingAssignment
      );
      (prisma.projectAssignment.update as jest.Mock).mockResolvedValue(
        existingAssignment
      );
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await request(app).put('/api/assignments/1').send({ jurisdiction: 'HK' });

      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 1,
            actionType: 'update',
            entityType: 'assignment',
          }),
        })
      );
    });
  });

  describe('DELETE /api/assignments/:id', () => {
    it('should delete an assignment', async () => {
      const mockAssignment = {
        id: 1,
        projectId: 1,
        staffId: 1,
        jurisdiction: 'US',
        project: { id: 1, name: 'Project Alpha' },
        staff: { id: 1, name: 'John Doe', position: 'Partner' },
      };

      (prisma.projectAssignment.findUnique as jest.Mock).mockResolvedValue(
        mockAssignment
      );
      (prisma.projectAssignment.delete as jest.Mock).mockResolvedValue(
        mockAssignment
      );
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (prisma.projectChangeHistory.create as jest.Mock).mockResolvedValue({});
      (prisma.staffChangeHistory.create as jest.Mock).mockResolvedValue({});

      const response = await request(app).delete('/api/assignments/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        'message',
        'Assignment deleted successfully'
      );
      expect(prisma.projectAssignment.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return 404 when deleting non-existent assignment', async () => {
      (prisma.projectAssignment.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).delete('/api/assignments/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Assignment not found');
    });

    it('should create activity log and change history on deletion', async () => {
      const mockAssignment = {
        id: 1,
        projectId: 1,
        staffId: 1,
        jurisdiction: 'US',
        project: { id: 1, name: 'Project Alpha' },
        staff: { id: 1, name: 'John Doe', position: 'Partner' },
      };

      (prisma.projectAssignment.findUnique as jest.Mock).mockResolvedValue(
        mockAssignment
      );
      (prisma.projectAssignment.delete as jest.Mock).mockResolvedValue(
        mockAssignment
      );
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (prisma.projectChangeHistory.create as jest.Mock).mockResolvedValue({});
      (prisma.staffChangeHistory.create as jest.Mock).mockResolvedValue({});

      await request(app).delete('/api/assignments/1');

      expect(prisma.activityLog.create).toHaveBeenCalled();
      expect(prisma.projectChangeHistory.create).toHaveBeenCalled();
      expect(prisma.staffChangeHistory.create).toHaveBeenCalled();
    });
  });

  describe('POST /api/assignments/bulk', () => {
    it('should create multiple assignments', async () => {
      const bulkAssignments = {
        assignments: [
          { projectId: 1, staffId: 1, jurisdiction: 'US' },
          { projectId: 1, staffId: 2, jurisdiction: 'HK' },
        ],
      };

      const mockCreatedAssignments = [
        {
          id: 1,
          projectId: 1,
          staffId: 1,
          jurisdiction: 'US',
          project: { id: 1, name: 'Project Alpha' },
          staff: { id: 1, name: 'John Doe' },
        },
        {
          id: 2,
          projectId: 1,
          staffId: 2,
          jurisdiction: 'HK',
          project: { id: 1, name: 'Project Alpha' },
          staff: { id: 2, name: 'Jane Smith' },
        },
      ];

      (prisma.projectAssignment.create as jest.Mock)
        .mockResolvedValueOnce(mockCreatedAssignments[0])
        .mockResolvedValueOnce(mockCreatedAssignments[1]);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/assignments/bulk')
        .send(bulkAssignments);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('count', 2);
      expect(response.body.assignments).toHaveLength(2);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/assignments/bulk')
        .send({ assignments: [] });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'error',
        'Assignments array is required'
      );
    });

    it('should skip duplicate assignments', async () => {
      const bulkAssignments = {
        assignments: [
          { projectId: 1, staffId: 1, jurisdiction: 'US' },
          { projectId: 1, staffId: 1, jurisdiction: 'US' }, // Duplicate
        ],
      };

      const mockCreatedAssignment = {
        id: 1,
        projectId: 1,
        staffId: 1,
        jurisdiction: 'US',
        project: { id: 1, name: 'Project Alpha' },
        staff: { id: 1, name: 'John Doe' },
      };

      (prisma.projectAssignment.create as jest.Mock)
        .mockResolvedValueOnce(mockCreatedAssignment)
        .mockRejectedValueOnce({ code: 'P2002' }); // Duplicate error
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/assignments/bulk')
        .send(bulkAssignments);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('count', 1);
    });

    it('should skip invalid entries with missing fields', async () => {
      const bulkAssignments = {
        assignments: [
          { projectId: 1, staffId: 1, jurisdiction: 'US' },
          { projectId: 1 }, // Missing staffId
        ],
      };

      const mockCreatedAssignment = {
        id: 1,
        projectId: 1,
        staffId: 1,
        jurisdiction: 'US',
        project: { id: 1, name: 'Project Alpha' },
        staff: { id: 1, name: 'John Doe' },
      };

      (prisma.projectAssignment.create as jest.Mock).mockResolvedValue(
        mockCreatedAssignment
      );
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/assignments/bulk')
        .send(bulkAssignments);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('count', 1);
      expect(prisma.projectAssignment.create).toHaveBeenCalledTimes(1);
    });
  });
});
