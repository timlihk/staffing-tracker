import request from 'supertest';
import express, { NextFunction, Request, Response } from 'express';
import { getBestPracticeGuide } from '../controllers/best-practices.controller';

const app = express();

const mockAuth = (req: Partial<Request>, res: Partial<Response>, next: NextFunction) => {
  (req as any).user = { userId: 1, username: 'tester', role: 'admin' };
  next();
};

app.get('/api/best-practices', mockAuth, getBestPracticeGuide);

describe('Best Practices Controller', () => {
  it('returns structured role-based best practice guidance', async () => {
    const response = await request(app).get('/api/best-practices');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('firstPrinciple');
    expect(response.body).toHaveProperty('roles');
    expect(response.body).toHaveProperty('project');
    expect(response.body).toHaveProperty('billing');

    expect(response.body.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'deal_team' }),
        expect.objectContaining({ key: 'finance_team' }),
        expect.objectContaining({ key: 'managers' }),
      ])
    );

    expect(response.body.project.statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'Active' }),
        expect.objectContaining({ value: 'Slow-down' }),
        expect.objectContaining({ value: 'Suspended' }),
        expect.objectContaining({ value: 'Terminated' }),
        expect.objectContaining({ value: 'Closed' }),
      ])
    );

    expect(response.body.billing.criticalFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'signed_date' }),
        expect.objectContaining({ field: 'lsd_date' }),
      ])
    );
  });
});

