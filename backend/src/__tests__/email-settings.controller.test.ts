import { Request, Response } from 'express';
import { getEmailSettings, updateEmailSettings } from '../controllers/email-settings.controller';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

// Mock Prisma
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    emailSettings: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
  },
}));

describe('Email Settings Controller', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let responseData: any;
  let responseStatus: number;

  beforeEach(() => {
    responseData = null;
    responseStatus = 200;

    mockRequest = {
      user: {
        userId: 1,
        username: 'admin',
        role: 'admin',
      },
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn((data) => {
        responseData = data;
        return mockResponse as Response;
      }),
    };

    jest.clearAllMocks();
  });

  describe('getEmailSettings', () => {
    it('should return existing settings if they exist', async () => {
      const mockSettings = {
        id: 1,
        emailNotificationsEnabled: true,
        notifyPartner: true,
        notifyAssociate: false,
        notifyJuniorFlic: false,
        notifySeniorFlic: false,
        notifyIntern: false,
        notifyBCWorkingAttorney: true,
        updatedAt: new Date(),
        updatedBy: 1,
      };

      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue(mockSettings);

      await getEmailSettings(mockRequest as AuthRequest, mockResponse as Response);

      expect(prisma.emailSettings.findFirst).toHaveBeenCalledTimes(1);
      expect(mockResponse.json).toHaveBeenCalledWith(mockSettings);
    });

    it('should create default settings if none exist', async () => {
      const mockCreatedSettings = {
        id: 1,
        emailNotificationsEnabled: true,
        notifyPartner: true,
        notifyAssociate: true,
        notifyJuniorFlic: true,
        notifySeniorFlic: true,
        notifyIntern: true,
        notifyBCWorkingAttorney: true,
        updatedAt: new Date(),
        updatedBy: null,
      };

      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.emailSettings.create as jest.Mock).mockResolvedValue(mockCreatedSettings);

      await getEmailSettings(mockRequest as AuthRequest, mockResponse as Response);

      expect(prisma.emailSettings.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.emailSettings.create).toHaveBeenCalledWith({
        data: {
          emailNotificationsEnabled: true,
          notifyPartner: true,
          notifyAssociate: true,
          notifyJuniorFlic: true,
          notifySeniorFlic: true,
          notifyIntern: true,
          notifyBCWorkingAttorney: true,
        },
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockCreatedSettings);
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database error');
      (prisma.emailSettings.findFirst as jest.Mock).mockRejectedValue(mockError);

      await getEmailSettings(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Failed to get email settings',
      });
    });
  });

  describe('updateEmailSettings', () => {
    it('should update existing settings', async () => {
      const existingSettings = {
        id: 1,
        emailNotificationsEnabled: true,
        notifyPartner: true,
        notifyAssociate: true,
        notifyJuniorFlic: true,
        notifySeniorFlic: true,
        notifyIntern: true,
        notifyBCWorkingAttorney: true,
      };

      const updatedSettings = {
        ...existingSettings,
        notifyAssociate: false,
        notifyJuniorFlic: false,
        updatedBy: 1,
      };

      mockRequest.body = {
        notifyAssociate: false,
        notifyJuniorFlic: false,
      };

      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue(existingSettings);
      (prisma.emailSettings.update as jest.Mock).mockResolvedValue(updatedSettings);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await updateEmailSettings(mockRequest as AuthRequest, mockResponse as Response);

      expect(prisma.emailSettings.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          emailNotificationsEnabled: true,
          notifyPartner: true,
          notifyAssociate: false,
          notifyJuniorFlic: false,
          notifySeniorFlic: true,
          notifyIntern: true,
          notifyBCWorkingAttorney: true,
          updatedBy: 1,
        },
      });

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          actionType: 'update',
          entityType: 'email_settings',
          entityId: 1,
          description: 'Updated email notification settings',
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith(updatedSettings);
    });

    it('should create settings if they do not exist', async () => {
      const newSettings = {
        id: 1,
        emailNotificationsEnabled: false,
        notifyPartner: true,
        notifyAssociate: true,
        notifyJuniorFlic: true,
        notifySeniorFlic: true,
        notifyIntern: true,
        notifyBCWorkingAttorney: true,
        updatedBy: 1,
      };

      mockRequest.body = {
        emailNotificationsEnabled: false,
      };

      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.emailSettings.create as jest.Mock).mockResolvedValue({
        id: 1,
        emailNotificationsEnabled: true,
        notifyPartner: true,
        notifyAssociate: true,
        notifyJuniorFlic: true,
        notifySeniorFlic: true,
        notifyIntern: true,
        notifyBCWorkingAttorney: true,
      });
      (prisma.emailSettings.update as jest.Mock).mockResolvedValue(newSettings);
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await updateEmailSettings(mockRequest as AuthRequest, mockResponse as Response);

      expect(prisma.emailSettings.create).toHaveBeenCalled();
      expect(prisma.emailSettings.update).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database error');
      (prisma.emailSettings.findFirst as jest.Mock).mockRejectedValue(mockError);

      await updateEmailSettings(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Failed to update email settings',
      });
    });

    it('should only update provided fields', async () => {
      const existingSettings = {
        id: 1,
        emailNotificationsEnabled: true,
        notifyPartner: true,
        notifyAssociate: true,
        notifyJuniorFlic: true,
        notifySeniorFlic: true,
        notifyIntern: true,
        notifyBCWorkingAttorney: true,
      };

      mockRequest.body = {
        notifyPartner: false,
      };

      (prisma.emailSettings.findFirst as jest.Mock).mockResolvedValue(existingSettings);
      (prisma.emailSettings.update as jest.Mock).mockResolvedValue({
        ...existingSettings,
        notifyPartner: false,
      });
      (prisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await updateEmailSettings(mockRequest as AuthRequest, mockResponse as Response);

      expect(prisma.emailSettings.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          notifyPartner: false,
          notifyAssociate: true,
          notifyJuniorFlic: true,
        }),
      });
    });
  });
});
