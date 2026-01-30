import jwt from 'jsonwebtoken';
import {
  generateToken,
  verifyToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  generateRefreshToken,
  verifyRefreshToken,
  JWTPayload,
} from '../../utils/jwt';
import prisma from '../../utils/prisma';

// Mock jsonwebtoken and prisma
jest.mock('jsonwebtoken');
jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../../config', () => ({
  __esModule: true,
  default: {
    jwt: {
      secret: 'test-secret',
      refreshSecret: 'test-refresh-secret',
      expiresIn: '7d',
      refreshExpiresIn: '30d',
      passwordResetExpiresIn: '30m',
    },
  },
}));

describe('JWT Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a JWT token', () => {
      const payload: JWTPayload = { userId: 1, username: 'testuser', role: 'admin' };
      (jwt.sign as jest.Mock).mockReturnValue('mock-token');

      const token = generateToken(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        'test-secret',
        expect.objectContaining({ expiresIn: '7d' })
      );
      expect(token).toBe('mock-token');
    });
  });

  describe('verifyToken', () => {
    it('should verify and return payload for valid token', () => {
      const mockPayload: JWTPayload = { userId: 1, username: 'testuser', role: 'admin' };
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const result = verifyToken('valid-token');

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(result).toEqual(mockPayload);
    });

    it('should throw error for invalid token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => verifyToken('invalid-token')).toThrow('Invalid token');
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should generate password reset token', () => {
      (jwt.sign as jest.Mock).mockReturnValue('reset-token');

      const token = generatePasswordResetToken(1);

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 1, purpose: 'password_reset' },
        'test-secret',
        expect.objectContaining({ expiresIn: '30m' })
      );
      expect(token).toBe('reset-token');
    });
  });

  describe('verifyPasswordResetToken', () => {
    it('should verify valid password reset token', () => {
      const mockPayload = { userId: 1, purpose: 'password_reset' };
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const result = verifyPasswordResetToken('valid-reset-token');

      expect(result).toEqual({ userId: 1, purpose: 'password_reset' });
    });

    it('should throw error for token with wrong purpose', () => {
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 1, purpose: 'wrong_purpose' });

      expect(() => verifyPasswordResetToken('wrong-purpose-token')).toThrow(
        'Invalid password reset token'
      );
    });

    it('should throw error for token without purpose', () => {
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 1 });

      expect(() => verifyPasswordResetToken('no-purpose-token')).toThrow(
        'Invalid password reset token'
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate and store refresh token', async () => {
      (jwt.sign as jest.Mock).mockReturnValue('refresh-token');
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const token = await generateRefreshToken(1);

      expect(token).toBe('refresh-token');
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 1,
            expiresAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', async () => {
      const mockDecoded = { userId: 1, tokenId: 'token-123' };
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        token: 'token-123',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await verifyRefreshToken('valid-refresh-token');

      expect(result).toEqual(mockDecoded);
    });

    it('should throw error when token not found in database', async () => {
      const mockDecoded = { userId: 1, tokenId: 'missing-token' };
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(verifyRefreshToken('invalid-refresh-token')).rejects.toThrow(
        'Invalid refresh token'
      );
    });

    it('should throw error when token is expired', async () => {
      const mockDecoded = { userId: 1, tokenId: 'expired-token' };
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago
      });

      await expect(verifyRefreshToken('expired-refresh-token')).rejects.toThrow(
        'Refresh token expired'
      );
    });

    it('should throw error for invalid JWT', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(verifyRefreshToken('invalid-jwt')).rejects.toThrow('Invalid token');
    });
  });
});
