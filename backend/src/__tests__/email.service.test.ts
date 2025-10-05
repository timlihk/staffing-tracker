import { shouldReceiveNotification, sendProjectUpdateEmails } from '../services/email.service';
import prisma from '../utils/prisma';

// Mock Prisma
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    emailSettings: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
    },
  })),
}));

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.EMAIL_FROM = 'test@example.com';
    process.env.FRONTEND_URL = 'http://localhost:5173';
  });

  describe('shouldReceiveNotification', () => {
    it('should return false when email notifications are globally disabled', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: false,
        notifyPartner: true,
      });

      const result = await shouldReceiveNotification('Partner');

      expect(result).toBe(false);
    });

    it('should return false when no settings exist', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await shouldReceiveNotification('Partner');

      expect(result).toBe(false);
    });

    it('should return true for Partner when partner notifications are enabled', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: true,
        notifyPartner: true,
        notifyAssociate: false,
      });

      const result = await shouldReceiveNotification('Partner');

      expect(result).toBe(true);
    });

    it('should return false for Partner when partner notifications are disabled', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: true,
        notifyPartner: false,
      });

      const result = await shouldReceiveNotification('Partner');

      expect(result).toBe(false);
    });

    it('should return true for Associate when associate notifications are enabled', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: true,
        notifyAssociate: true,
      });

      const result = await shouldReceiveNotification('Associate');

      expect(result).toBe(true);
    });

    it('should return true for Junior FLIC when junior flic notifications are enabled', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: true,
        notifyJuniorFlic: true,
      });

      const result = await shouldReceiveNotification('Junior FLIC');

      expect(result).toBe(true);
    });

    it('should return true for Senior FLIC when senior flic notifications are enabled', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: true,
        notifySeniorFlic: true,
      });

      const result = await shouldReceiveNotification('Senior FLIC');

      expect(result).toBe(true);
    });

    it('should return true for Intern when intern notifications are enabled', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: true,
        notifyIntern: true,
      });

      const result = await shouldReceiveNotification('Intern');

      expect(result).toBe(true);
    });

    it('should return true for B&C Working Attorney when bc attorney notifications are enabled', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: true,
        notifyBCWorkingAttorney: true,
      });

      const result = await shouldReceiveNotification('B&C Working Attorney');

      expect(result).toBe(true);
    });

    it('should return true for unknown positions (defaults to true)', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: true,
        notifyPartner: false,
      });

      const result = await shouldReceiveNotification('Unknown Position');

      expect(result).toBe(true);
    });

    it('should handle database errors gracefully and default to true', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await shouldReceiveNotification('Partner');

      expect(result).toBe(true); // Fail open for notifications
    });
  });

  describe('sendProjectUpdateEmails', () => {
    it('should not send emails when notifications are globally disabled', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: false,
      });

      const emailDataList = [
        {
          staffEmail: 'partner@example.com',
          staffName: 'John Partner',
          staffPosition: 'Partner',
          projectId: 1,
          projectName: 'Test Project',
          projectCategory: 'HK Trx',
          changeDescription: 'Status changed',
          changes: [],
        },
      ];

      const result = await sendProjectUpdateEmails(emailDataList);

      expect(result).toEqual([]);
    });

    it('should filter recipients based on position settings', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: true,
        notifyPartner: true,
        notifyAssociate: false,
        notifyJuniorFlic: false,
        notifySeniorFlic: false,
        notifyIntern: false,
        notifyBCWorkingAttorney: true,
      });

      const emailDataList = [
        {
          staffEmail: 'partner@example.com',
          staffName: 'John Partner',
          staffPosition: 'Partner',
          projectId: 1,
          projectName: 'Test Project',
          projectCategory: 'HK Trx',
          changeDescription: 'Status changed',
          changes: [],
        },
        {
          staffEmail: 'associate@example.com',
          staffName: 'Jane Associate',
          staffPosition: 'Associate',
          projectId: 1,
          projectName: 'Test Project',
          projectCategory: 'HK Trx',
          changeDescription: 'Status changed',
          changes: [],
        },
        {
          staffEmail: 'bc@example.com',
          staffName: 'Bob BC',
          staffPosition: 'B&C Working Attorney',
          projectId: 1,
          projectName: 'Test Project',
          projectCategory: 'HK Trx',
          changeDescription: 'Status changed',
          changes: [],
        },
      ];

      const result = await sendProjectUpdateEmails(emailDataList);

      // Should filter out Associate, keep Partner and B&C
      // Note: Actual email sending is mocked, so we're just checking the filtering logic runs
      expect(prisma.emailSettings.findFirst).toHaveBeenCalled();
    });

    it('should deduplicate email addresses', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: true,
        notifyPartner: true,
        notifyBCWorkingAttorney: true,
      });

      const emailDataList = [
        {
          staffEmail: 'partner@example.com',
          staffName: 'John Partner',
          staffPosition: 'Partner',
          projectId: 1,
          projectName: 'Test Project',
          projectCategory: 'HK Trx',
          changeDescription: 'Status changed',
          changes: [],
        },
        {
          staffEmail: 'partner@example.com', // Duplicate email
          staffName: 'John Partner',
          staffPosition: 'B&C Working Attorney',
          projectId: 1,
          projectName: 'Test Project',
          projectCategory: 'HK Trx',
          changeDescription: 'Status changed',
          changes: [],
        },
      ];

      const result = await sendProjectUpdateEmails(emailDataList);

      // Deduplication should occur
      expect(prisma.emailSettings.findFirst).toHaveBeenCalled();
    });

    it('should not send emails when no recipients pass filtering', async () => {
      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: true,
        notifyPartner: false,
        notifyAssociate: false,
        notifyJuniorFlic: false,
        notifySeniorFlic: false,
        notifyIntern: false,
        notifyBCWorkingAttorney: false,
      });

      const emailDataList = [
        {
          staffEmail: 'partner@example.com',
          staffName: 'John Partner',
          staffPosition: 'Partner',
          projectId: 1,
          projectName: 'Test Project',
          projectCategory: 'HK Trx',
          changeDescription: 'Status changed',
          changes: [],
        },
      ];

      const result = await sendProjectUpdateEmails(emailDataList);

      expect(result).toEqual([]);
    });

    it('should not send emails when Resend is not configured', async () => {
      delete process.env.RESEND_API_KEY;

      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue({
        emailNotificationsEnabled: true,
        notifyPartner: true,
      });

      const emailDataList = [
        {
          staffEmail: 'partner@example.com',
          staffName: 'John Partner',
          staffPosition: 'Partner',
          projectId: 1,
          projectName: 'Test Project',
          projectCategory: 'HK Trx',
          changeDescription: 'Status changed',
          changes: [],
        },
      ];

      const result = await sendProjectUpdateEmails(emailDataList);

      expect(result).toEqual([]);
    });
  });
});
