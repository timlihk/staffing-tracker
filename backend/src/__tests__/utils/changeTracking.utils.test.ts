import { trackFieldChanges } from '../../utils/changeTracking';
import prisma from '../../utils/prisma';

// Mock prisma
jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    projectChangeHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
    staffChangeHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Change Tracking Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackFieldChanges', () => {
    it('should track project field changes', async () => {
      const entityId = 1;
      const entityType = 'project' as const;
      const oldData = { name: 'Old Project', status: 'Active' };
      const newData = { name: 'New Project', status: 'Active' };
      const changedBy = 1;

      await trackFieldChanges(entityId, entityType, oldData, newData, changedBy);

      expect(prisma.projectChangeHistory.create).toHaveBeenCalledTimes(1);
      expect(prisma.projectChangeHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: entityId,
            fieldName: 'name',
            oldValue: 'Old Project',
            newValue: 'New Project',
            changedBy,
            changeType: 'update',
          }),
        })
      );
    });

    it('should track multiple field changes', async () => {
      const entityId = 1;
      const entityType = 'project' as const;
      const oldData = { name: 'Old', status: 'Active', priority: 'Low' };
      const newData = { name: 'New', status: 'Completed', priority: 'Low' };
      const changedBy = 1;

      await trackFieldChanges(entityId, entityType, oldData, newData, changedBy);

      // Should create records for both name and status changes
      expect(prisma.projectChangeHistory.create).toHaveBeenCalledTimes(2);
    });

    it('should track staff field changes', async () => {
      const entityId = 1;
      const entityType = 'staff' as const;
      const oldData = { name: 'John Doe', position: 'Associate' };
      const newData = { name: 'John Doe', position: 'Partner' };
      const changedBy = 1;

      await trackFieldChanges(entityId, entityType, oldData, newData, changedBy);

      expect(prisma.staffChangeHistory.create).toHaveBeenCalledTimes(1);
      expect(prisma.staffChangeHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            staffId: entityId,
            fieldName: 'position',
            oldValue: 'Associate',
            newValue: 'Partner',
            changedBy,
            changeType: 'update',
          }),
        })
      );
    });

    it('should not create records when no changes detected', async () => {
      const entityId = 1;
      const entityType = 'project' as const;
      const oldData = { name: 'Same', status: 'Active' };
      const newData = { name: 'Same', status: 'Active' };
      const changedBy = 1;

      await trackFieldChanges(entityId, entityType, oldData, newData, changedBy);

      expect(prisma.projectChangeHistory.create).not.toHaveBeenCalled();
      expect(prisma.staffChangeHistory.create).not.toHaveBeenCalled();
    });

    it('should handle null/undefined values correctly', async () => {
      const entityId = 1;
      const entityType = 'project' as const;
      const oldData = { name: null, status: 'Active' };
      const newData = { name: 'New Name', status: 'Active' };
      const changedBy = 1;

      await trackFieldChanges(entityId, entityType, oldData, newData, changedBy);

      expect(prisma.projectChangeHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            oldValue: null,
            newValue: 'New Name',
          }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const entityId = 1;
      const entityType = 'project' as const;
      const oldData = { name: 'Old' };
      const newData = { name: 'New' };
      const changedBy = 1;

      (prisma.projectChangeHistory.create as jest.Mock).mockRejectedValue(new Error('DB Error'));

      // Should not throw
      await expect(
        trackFieldChanges(entityId, entityType, oldData, newData, changedBy)
      ).resolves.not.toThrow();
    });

    it('should handle unknown entity type', async () => {
      const entityId = 1;
      const entityType = 'unknown' as any;
      const oldData = { name: 'Old' };
      const newData = { name: 'New' };
      const changedBy = 1;

      // Should not throw but also not create any records
      await trackFieldChanges(entityId, entityType, oldData, newData, changedBy);

      expect(prisma.projectChangeHistory.create).not.toHaveBeenCalled();
      expect(prisma.staffChangeHistory.create).not.toHaveBeenCalled();
    });

    it('should ignore id, createdAt, and updatedAt fields', async () => {
      const entityId = 1;
      const entityType = 'project' as const;
      const oldData = { id: 1, name: 'Old', createdAt: '2024-01-01', updatedAt: '2024-01-01' };
      const newData = { id: 2, name: 'New', createdAt: '2024-06-01', updatedAt: '2024-06-01' };
      const changedBy = 1;

      await trackFieldChanges(entityId, entityType, oldData, newData, changedBy);

      // Should only track 'name' change, not id or timestamps
      expect(prisma.projectChangeHistory.create).toHaveBeenCalledTimes(1);
      expect(prisma.projectChangeHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fieldName: 'name',
            oldValue: 'Old',
            newValue: 'New',
          }),
        })
      );
    });
  });
});
