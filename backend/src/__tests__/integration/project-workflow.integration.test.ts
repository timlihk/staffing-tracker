import request from 'supertest';
import express from 'express';
import { setupTestDatabase, teardownTestDatabase, prisma } from './setup';
import projectRoutes from '../../routes/project.routes';
import staffRoutes from '../../routes/staff.routes';
import assignmentRoutes from '../../routes/assignment.routes';
import authRoutes from '../../routes/auth.routes';
import bcrypt from 'bcryptjs';

// Create test app with real routes
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/assignments', assignmentRoutes);

describe('Project Workflow Integration Tests', () => {
  let authToken: string;
  let userId: number;

  beforeAll(async () => {
    await setupTestDatabase();

    // Create test user
    const hashedPassword = await bcrypt.hash('testpassword', 10);
    const user = await prisma.user.create({
      data: {
        username: 'integrationtest',
        email: 'integration@test.com',
        passwordHash: hashedPassword,
        role: 'admin',
        mustResetPassword: false,
      },
    });
    userId = user.id;

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'integrationtest',
        password: 'testpassword',
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  afterEach(async () => {
    // Clean up data after each test but keep the user
    await prisma.projectAssignment.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.staff.deleteMany({});
    await prisma.activityLog.deleteMany({});
    await prisma.projectChangeHistory.deleteMany({});
    await prisma.staffChangeHistory.deleteMany({});
  });

  describe('Complete Project Lifecycle', () => {
    it('should handle full project workflow: create project, add staff, create assignments, update project', async () => {
      // Step 1: Create a project
      const projectData = {
        name: 'Integration Test Project',
        category: 'HK Trx',
        status: 'Active',
        priority: 'High',
      };

      const createProjectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData);

      expect(createProjectResponse.status).toBe(201);
      expect(createProjectResponse.body).toMatchObject({
        name: 'Integration Test Project',
        category: 'HK Trx',
        status: 'Active',
      });

      const projectId = createProjectResponse.body.id;

      // Step 2: Create staff members
      const staff1Data = {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'Partner',
        department: 'US Law',
      };

      const staff2Data = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'Associate',
        department: 'HK Law',
      };

      const createStaff1Response = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${authToken}`)
        .send(staff1Data);

      const createStaff2Response = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${authToken}`)
        .send(staff2Data);

      expect(createStaff1Response.status).toBe(201);
      expect(createStaff2Response.status).toBe(201);

      const staffId1 = createStaff1Response.body.id;
      const staffId2 = createStaff2Response.body.id;

      // Step 3: Create assignments
      const assignment1Data = {
        projectId,
        staffId: staffId1,
        jurisdiction: 'US',
      };

      const assignment2Data = {
        projectId,
        staffId: staffId2,
        jurisdiction: 'HK',
      };

      const createAssignment1Response = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(assignment1Data);

      const createAssignment2Response = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(assignment2Data);

      expect(createAssignment1Response.status).toBe(201);
      expect(createAssignment2Response.status).toBe(201);

      // Step 4: Verify project has assignments
      const getProjectResponse = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getProjectResponse.status).toBe(200);
      expect(getProjectResponse.body.assignments).toHaveLength(2);

      // Step 5: Update project
      const updateProjectResponse = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'Suspended', notes: 'Project on hold' });

      expect(updateProjectResponse.status).toBe(200);
      expect(updateProjectResponse.body.status).toBe('Suspended');
      expect(updateProjectResponse.body.notes).toBe('Project on hold');

      // Step 6: Verify activity logs were created
      const activityLogs = await prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      expect(activityLogs.length).toBeGreaterThan(0);

      // Verify we have logs for create project, create staff, create assignments, update project
      const actionTypes = activityLogs.map((log) => log.actionType);
      expect(actionTypes).toContain('create');
      expect(actionTypes).toContain('assign');
      expect(actionTypes).toContain('update');

      // Step 7: Delete an assignment
      const assignment1Id = createAssignment1Response.body.id;
      const deleteAssignmentResponse = await request(app)
        .delete(`/api/assignments/${assignment1Id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteAssignmentResponse.status).toBe(200);

      // Step 8: Verify assignment was deleted
      const getProjectAfterDeleteResponse = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getProjectAfterDeleteResponse.body.assignments).toHaveLength(1);
    });

    it('should filter projects by status and category', async () => {
      // Create multiple projects
      const projects = [
        {
          name: 'Active HK Project',
          category: 'HK Trx',
          status: 'Active',
        },
        {
          name: 'Suspended US Project',
          category: 'US Trx',
          status: 'Suspended',
        },
        {
          name: 'Active US Project',
          category: 'US Trx',
          status: 'Active',
        },
      ];

      for (const project of projects) {
        await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send(project);
      }

      // Filter by status
      const activeProjectsResponse = await request(app)
        .get('/api/projects?status=Active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(activeProjectsResponse.status).toBe(200);
      expect(activeProjectsResponse.body.data).toHaveLength(2);
      expect(
        activeProjectsResponse.body.data.every((p: any) => p.status === 'Active')
      ).toBe(true);

      // Filter by category
      const usProjectsResponse = await request(app)
        .get('/api/projects?category=US%20Trx')
        .set('Authorization', `Bearer ${authToken}`);

      expect(usProjectsResponse.status).toBe(200);
      expect(usProjectsResponse.body.data).toHaveLength(2);
      expect(
        usProjectsResponse.body.data.every((p: any) => p.category === 'US Trx')
      ).toBe(true);

      // Filter by both
      const filteredResponse = await request(app)
        .get('/api/projects?status=Active&category=US%20Trx')
        .set('Authorization', `Bearer ${authToken}`);

      expect(filteredResponse.status).toBe(200);
      expect(filteredResponse.body.data).toHaveLength(1);
      expect(filteredResponse.body.data[0].name).toBe('Active US Project');
    });

    it('should handle bulk assignment creation', async () => {
      // Create project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Bulk Assignment Project',
          category: 'HK Trx',
          status: 'Active',
        });

      const projectId = projectResponse.body.id;

      // Create multiple staff
      const staffIds = [];
      for (let i = 0; i < 3; i++) {
        const staffResponse = await request(app)
          .post('/api/staff')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Staff Member ${i + 1}`,
            email: `staff${i + 1}@example.com`,
            role: 'Associate',
            department: 'HK Law',
          });
        staffIds.push(staffResponse.body.id);
      }

      // Bulk create assignments
      const bulkAssignmentResponse = await request(app)
        .post('/api/assignments/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assignments: staffIds.map((staffId) => ({
            projectId,
            staffId,
            jurisdiction: 'HK',
          })),
        });

      expect(bulkAssignmentResponse.status).toBe(201);
      expect(bulkAssignmentResponse.body.count).toBe(3);
      expect(bulkAssignmentResponse.body.assignments).toHaveLength(3);

      // Verify all assignments were created
      const getProjectResponse = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getProjectResponse.body.assignments).toHaveLength(3);
    });

    it('should handle staff filtering by assignments', async () => {
      // Create project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Staff Filter Project',
          category: 'HK Trx',
          status: 'Active',
        });

      const projectId = projectResponse.body.id;

      // Create staff
      const staffResponse = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Assigned Staff',
          email: 'assigned@example.com',
          role: 'Partner',
          department: 'US Law',
        });

      const staffId = staffResponse.body.id;

      // Create assignment
      await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          staffId,
          jurisdiction: 'US',
        });

      // Filter projects by staff
      const filterByStaffResponse = await request(app)
        .get(`/api/projects?staffId=${staffId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(filterByStaffResponse.status).toBe(200);
      expect(filterByStaffResponse.body.data).toHaveLength(1);
      expect(filterByStaffResponse.body.data[0].id).toBe(projectId);
    });
  });

  describe('Error Handling', () => {
    it('should handle duplicate assignment creation gracefully', async () => {
      // Create project and staff
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Duplicate Test Project',
          category: 'HK Trx',
          status: 'Active',
        });

      const staffResponse = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Staff',
          email: 'duplicate@example.com',
          role: 'Associate',
        });

      const projectId = projectResponse.body.id;
      const staffId = staffResponse.body.id;

      // Create first assignment
      const firstAssignmentResponse = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          staffId,
          jurisdiction: 'US',
        });

      expect(firstAssignmentResponse.status).toBe(201);

      // Try to create duplicate assignment
      const duplicateAssignmentResponse = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          staffId,
          jurisdiction: 'US',
        });

      expect(duplicateAssignmentResponse.status).toBe(400);
      expect(duplicateAssignmentResponse.body.error).toContain('already exists');
    });

    it('should return 404 for non-existent resources', async () => {
      // Try to get non-existent project
      const getProjectResponse = await request(app)
        .get('/api/projects/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(getProjectResponse.status).toBe(404);

      // Try to get non-existent staff
      const getStaffResponse = await request(app)
        .get('/api/staff/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(getStaffResponse.status).toBe(404);

      // Try to get non-existent assignment
      const getAssignmentResponse = await request(app)
        .get('/api/assignments/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(getAssignmentResponse.status).toBe(404);
    });
  });
});
