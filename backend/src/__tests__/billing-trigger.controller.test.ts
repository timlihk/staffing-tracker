import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import {
  getTriggers,
  getFinanceSummary,
  getLongStopRisks,
  getUnpaidInvoices,
  getOverdueByAttorney,
} from '../controllers/billing-trigger.controller';
import prisma from '../utils/prisma';

// Mock prisma — jest.mock is hoisted, so use getter to access the mock
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    user: { findUnique: jest.fn() },
    billing_project_bc_attorney: { findFirst: jest.fn() },
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock('../config', () => ({
  __esModule: true,
  default: { isDevelopment: false, isProduction: false },
}));

// Mock trigger queue service to avoid deep prisma calls
jest.mock('../services/billing-trigger-queue.service', () => ({
  BillingTriggerQueueService: {
    getTriggers: jest.fn().mockResolvedValue([]),
    getOverdueByAttorney: jest.fn().mockResolvedValue([]),
  },
}));

// Mock sweep services to prevent import-time errors
jest.mock('../services/billing-milestone-date-sweep.service', () => ({
  BillingMilestoneDateSweepService: { runDailySweep: jest.fn() },
}));
jest.mock('../services/billing-milestone-ai-sweep.service', () => ({
  BillingMilestoneAISweepService: { runDailySweep: jest.fn() },
}));
jest.mock('../services/billing-pipeline-insights.service', () => ({
  BillingPipelineInsightsService: { getInsights: jest.fn() },
}));

const mockPrisma = prisma as any;

// --- Helpers to create test apps with different user roles ---

function createApp(userOverrides: Record<string, any> = {}) {
  const mockAuth = (req: Partial<Request>, _res: Partial<Response>, next: NextFunction) => {
    (req as any).user = { userId: 1, username: 'testuser', role: 'admin', ...userOverrides };
    next();
  };

  const app = express();
  app.use(express.json());
  app.get('/triggers', mockAuth, getTriggers);
  app.get('/finance-summary', mockAuth, getFinanceSummary);
  app.get('/long-stop-risks', mockAuth, getLongStopRisks);
  app.get('/unpaid-invoices', mockAuth, getUnpaidInvoices);
  app.get('/overdue-by-attorney', mockAuth, getOverdueByAttorney);
  return app;
}

// --- Tests ---

describe('Billing Trigger Controller - Authorization Scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Admin callers', () => {
    const adminApp = createApp({ role: 'admin' });

    it('admin can query any attorneyId on /finance-summary', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { billing_usd: 100, collection_usd: 50, ubt_usd: 50, project_count: 1n },
      ]);

      const res = await request(adminApp).get('/finance-summary?attorneyId=99');
      expect(res.status).toBe(200);
    });

    it('admin can query any attorneyId on /long-stop-risks', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      const res = await request(adminApp).get('/long-stop-risks?attorneyId=99');
      expect(res.status).toBe(200);
    });

    it('admin can query any attorneyId on /unpaid-invoices', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      const res = await request(adminApp).get('/unpaid-invoices?attorneyId=99');
      expect(res.status).toBe(200);
    });

    it('admin can query without attorneyId (sees all)', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { billing_usd: 100, collection_usd: 50, ubt_usd: 50, project_count: 1n },
      ]);
      const res = await request(adminApp).get('/finance-summary');
      expect(res.status).toBe(200);
    });
  });

  describe('Non-admin callers (B&C attorney)', () => {
    // User ID 10, linked to staff ID 42
    const bcApp = createApp({ userId: 10, role: 'editor' });

    beforeEach(() => {
      // resolveBillingAccessScope looks up user.staffId
      mockPrisma.user.findUnique.mockResolvedValue({ staffId: 42 });
    });

    it('non-admin is forced to own staffId on /finance-summary', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { billing_usd: 100, collection_usd: 50, ubt_usd: 50, project_count: 1n },
      ]);

      const res = await request(bcApp).get('/finance-summary');
      expect(res.status).toBe(200);
      // The query should have been called with the user's own staffId (42)
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
      const firstCallArgs = mockPrisma.$queryRawUnsafe.mock.calls[0];
      expect(firstCallArgs[1]).toBe(42); // attorneyId param forced to 42
    });

    it('non-admin gets 403 when querying another attorney on /finance-summary', async () => {
      const res = await request(bcApp).get('/finance-summary?attorneyId=99');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/other attorneys/i);
    });

    it('non-admin gets 403 when querying another attorney on /long-stop-risks', async () => {
      const res = await request(bcApp).get('/long-stop-risks?attorneyId=99');
      expect(res.status).toBe(403);
    });

    it('non-admin gets 403 when querying another attorney on /unpaid-invoices', async () => {
      const res = await request(bcApp).get('/unpaid-invoices?attorneyId=99');
      expect(res.status).toBe(403);
    });

    it('non-admin can query with own staffId explicitly', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { billing_usd: 10, collection_usd: 5, ubt_usd: 5, project_count: 1n },
      ]);

      const res = await request(bcApp).get('/finance-summary?attorneyId=42');
      expect(res.status).toBe(200);
    });
  });

  describe('Invalid attorneyId validation', () => {
    const adminApp = createApp({ role: 'admin' });

    it('returns 400 for non-numeric attorneyId on /triggers', async () => {
      const res = await request(adminApp).get('/triggers?attorneyId=abc');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid attorneyid/i);
    });

    it('returns 400 for non-numeric attorneyId on /finance-summary', async () => {
      const res = await request(adminApp).get('/finance-summary?attorneyId=abc');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid attorneyid/i);
    });

    it('returns 400 for non-numeric attorneyId on /long-stop-risks', async () => {
      const res = await request(adminApp).get('/long-stop-risks?attorneyId=abc');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid attorneyid/i);
    });

    it('returns 400 for non-numeric attorneyId on /unpaid-invoices', async () => {
      const res = await request(adminApp).get('/unpaid-invoices?attorneyId=abc');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid attorneyid/i);
    });

    it('returns 400 for non-numeric attorneyId on /overdue-by-attorney', async () => {
      const res = await request(adminApp).get('/overdue-by-attorney?attorneyId=abc');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid attorneyid/i);
    });

    it('returns 400 for partially numeric attorneyId like "42abc"', async () => {
      const res = await request(adminApp).get('/finance-summary?attorneyId=42abc');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid attorneyid/i);
    });

    it('returns 400 for float attorneyId like "3.5"', async () => {
      const res = await request(adminApp).get('/triggers?attorneyId=3.5');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid attorneyid/i);
    });
  });

  describe('Non-admin without staff record', () => {
    const noStaffApp = createApp({ userId: 99, role: 'viewer' });

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ staffId: null });
    });

    it('returns 403 with no staff record message', async () => {
      const res = await request(noStaffApp).get('/finance-summary');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/no staff record/i);
    });
  });
});
