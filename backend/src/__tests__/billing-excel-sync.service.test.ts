import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { applyChanges, SyncResult } from '../services/billing-excel-sync.service';

// Mock prisma
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
    activityLog: { create: jest.fn() },
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock('../config', () => ({
  __esModule: true,
  default: { isDevelopment: false, isProduction: false, nodeEnv: 'test' },
}));

const mockPrisma = prisma as any;

// Minimal ExcelRow for testing
function makeRow(cmNo: string, rowNum: number, overrides: Record<string, any> = {}) {
  return {
    rowNum,
    projectName: `Project ${cmNo}`,
    clientName: 'Test Client',
    cmNo,
    attorneyInCharge: 'Test Attorney',
    sca: '',
    billingUsd: 100,
    collectionUsd: 50,
    billingCreditUsd: null,
    ubtUsd: 50,
    arUsd: null,
    billingCreditCny: null,
    ubtCny: null,
    billedButUnpaid: null,
    unbilledPerEl: null,
    financeRemarks: null,
    matterNotes: null,
    engagements: [],
    isSubRow: false,
    ...overrides,
  };
}

describe('Billing Excel Sync Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('applyChanges', () => {
    it('should initialize failedRows as empty array', async () => {
      // No rows → no processing
      const result = await applyChanges([]);
      expect(result.failedRows).toEqual([]);
    });

    it('should track failed rows when processRow throws', async () => {
      // Make $transaction throw to simulate row failure
      mockPrisma.$transaction.mockRejectedValue(new Error('DB connection lost'));

      const rows = [makeRow('12345-00001', 5), makeRow('12345-00002', 6)];
      const result = await applyChanges(rows);

      expect(result.failedRows).toHaveLength(2);
      expect(result.failedRows[0]).toEqual({
        cmNo: '12345-00001',
        rowNum: 5,
        error: 'DB connection lost',
      });
      expect(result.failedRows[1]).toEqual({
        cmNo: '12345-00002',
        rowNum: 6,
        error: 'DB connection lost',
      });
    });

    it('should skip TBC rows without entering a transaction', async () => {
      const rows = [makeRow('TBC', 5)];
      const result = await applyChanges(rows);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(result.unmatchedCmNumbers).toContain('TBC');
      expect(result.syncRunData.skippedCms).toContain('TBC');
    });

    it('should call $transaction with 30s timeout for each row', async () => {
      mockPrisma.$transaction.mockResolvedValue(null); // processRowCore returns null (no auto-link needed)

      const rows = [makeRow('12345-00001', 5)];
      await applyChanges(rows);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 30000 },
      );
    });

    it('should continue processing remaining rows after a failure', async () => {
      mockPrisma.$transaction
        .mockRejectedValueOnce(new Error('First row failed'))
        .mockResolvedValueOnce(null);

      const rows = [makeRow('FAIL-001', 5), makeRow('OK-001', 6)];
      const result = await applyChanges(rows);

      expect(result.failedRows).toHaveLength(1);
      expect(result.failedRows[0].cmNo).toBe('FAIL-001');
      // Second row processed successfully via $transaction
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('should run auto-link outside transaction when new project is created', async () => {
      // Transaction returns link info (meaning new project was created)
      mockPrisma.$transaction.mockResolvedValue({ projectId: BigInt(42) });
      // Auto-link queries use global prisma (not tx)
      mockPrisma.$queryRaw.mockResolvedValue([]); // no staffing match

      const rows = [makeRow('NEW-001', 5)];
      const result = await applyChanges(rows);

      // $queryRaw was called outside the transaction (for autoLink)
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(result.syncRunData.unmatchedNewCms).toEqual([
        { cmNo: 'NEW-001', projectName: 'Project NEW-001' },
      ]);
    });
  });
});
