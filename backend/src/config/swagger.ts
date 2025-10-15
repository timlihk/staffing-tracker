import swaggerJsdoc from 'swagger-jsdoc';
import config from '../config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Staffing Tracker API',
      version: '1.0.0',
      description: 'Kirkland & Ellis Staffing Tracker - Internal project and team management system',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: config.nodeEnv === 'production'
          ? 'https://staffing-tracker-production.up.railway.app/api'
          : `http://localhost:${config.port}/api`,
        description: config.nodeEnv === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer <token>',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
          description: 'HTTP-only cookie for refresh token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'editor', 'viewer'] },
            staffId: { type: 'integer', nullable: true },
            lastLogin: { type: 'string', format: 'date-time', nullable: true },
            lastActivity: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            category: { type: 'string' },
            status: { type: 'string' },
            priority: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            sector: { type: 'string', nullable: true },
            side: { type: 'string', nullable: true },
            elStatus: { type: 'string', nullable: true },
            timetable: { type: 'string', nullable: true },
            filingDate: { type: 'string', format: 'date', nullable: true },
            listingDate: { type: 'string', format: 'date', nullable: true },
            lastConfirmedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Staff: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            email: { type: 'string', nullable: true },
            position: { type: 'string' },
            department: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['active', 'inactive'] },
            notes: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Assignment: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            projectId: { type: 'integer' },
            staffId: { type: 'integer' },
            jurisdiction: { type: 'string', nullable: true },
            startDate: { type: 'string', format: 'date', nullable: true },
            endDate: { type: 'string', format: 'date', nullable: true },
            notes: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        BillingProject: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            clientName: { type: 'string', nullable: true },
            matterNumber: { type: 'string', nullable: true },
            totalBilled: { type: 'number', format: 'decimal', nullable: true },
            totalCollected: { type: 'number', format: 'decimal', nullable: true },
            outstandingAR: { type: 'number', format: 'decimal', nullable: true },
            status: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Engagement: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            billingProjectId: { type: 'integer' },
            engagementNumber: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
            feeType: { type: 'string', nullable: true },
            totalFee: { type: 'number', format: 'decimal', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        FeeMilestone: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            engagementId: { type: 'integer' },
            description: { type: 'string' },
            amount: { type: 'number', format: 'decimal' },
            dueDate: { type: 'string', format: 'date', nullable: true },
            status: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        EmailSettings: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            enabled: { type: 'boolean' },
            reminderFrequency: { type: 'string', nullable: true },
            recipients: {
              type: 'array',
              items: { type: 'string' },
              nullable: true,
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        DashboardSummary: {
          type: 'object',
          properties: {
            totalProjects: { type: 'integer' },
            activeProjects: { type: 'integer' },
            totalStaff: { type: 'integer' },
            activeStaff: { type: 'integer' },
            totalAssignments: { type: 'integer' },
            projectsNeedingAttention: { type: 'integer' },
          },
        },
        ChangeHistory: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            entityType: { type: 'string' },
            entityId: { type: 'integer' },
            changedBy: { type: 'string' },
            changeType: { type: 'string' },
            changes: { type: 'object' },
            changedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      { name: 'Authentication', description: 'User authentication and authorization' },
      { name: 'Projects', description: 'Project management operations' },
      { name: 'Staff', description: 'Staff member management' },
      { name: 'Assignments', description: 'Project-staff assignment operations' },
      { name: 'Dashboard', description: 'Dashboard data and statistics' },
      { name: 'Reports', description: 'Report generation and export' },
      { name: 'Users', description: 'User management (admin only)' },
      { name: 'Settings', description: 'Application settings' },
      { name: 'Billing', description: 'Billing and collection module' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
