import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from './prisma';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

if (!JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET environment variable is required. Do NOT derive from JWT_SECRET for security reasons.');
}

export interface JWTPayload {
  userId: number;
  username: string;
  role: string;
}

export const generateToken = (payload: JWTPayload): string => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as any);
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

const PASSWORD_RESET_EXPIRES_IN = process.env.PASSWORD_RESET_EXPIRES_IN || '30m';

export interface PasswordResetPayload {
  userId: number;
  purpose: 'password_reset';
}

export const generatePasswordResetToken = (userId: number): string => {
  const payload: PasswordResetPayload = { userId, purpose: 'password_reset' };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: PASSWORD_RESET_EXPIRES_IN } as any);
};

export const verifyPasswordResetToken = (token: string): PasswordResetPayload => {
  const decoded = jwt.verify(token, JWT_SECRET) as PasswordResetPayload & { purpose?: string };
  if (!decoded || decoded.purpose !== 'password_reset') {
    throw new Error('Invalid password reset token');
  }
  return { userId: decoded.userId, purpose: 'password_reset' };
};

/**
 * Refresh Token Management
 */

const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export interface RefreshTokenPayload {
  userId: number;
  tokenId: string; // Unique identifier for this specific token
}

/**
 * Generate a new refresh token and store it in the database
 */
export const generateRefreshToken = async (userId: number): Promise<string> => {
  // Generate a unique token ID
  const tokenId = crypto.randomBytes(32).toString('hex');

  // Create JWT with token ID
  const token = jwt.sign(
    { userId, tokenId } as RefreshTokenPayload,
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN } as any
  );

  // Calculate expiration date
  const expiresInMs = parseExpiration(REFRESH_TOKEN_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + expiresInMs);

  // Store token in database
  await prisma.refreshToken.create({
    data: {
      token: tokenId,
      userId,
      expiresAt,
    },
  });

  return token;
};

/**
 * Verify refresh token and return payload
 */
export const verifyRefreshToken = async (token: string): Promise<RefreshTokenPayload> => {
  try {
    // Verify JWT signature
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;

    // Check if token exists in database and is not expired
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: decoded.tokenId },
    });

    if (!storedToken) {
      throw new Error('Refresh token not found or has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      // Token expired, delete it
      await prisma.refreshToken.delete({
        where: { token: decoded.tokenId },
      });
      throw new Error('Refresh token has expired');
    }

    if (storedToken.userId !== decoded.userId) {
      throw new Error('Invalid refresh token');
    }

    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

/**
 * Revoke a refresh token (logout)
 */
export const revokeRefreshToken = async (token: string): Promise<void> => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
    await prisma.refreshToken.delete({
      where: { token: decoded.tokenId },
    });
  } catch (error) {
    // Token already invalid or expired, ignore
  }
};

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
export const revokeAllRefreshTokens = async (userId: number): Promise<void> => {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
};

/**
 * Clean up expired refresh tokens (should be run periodically)
 */
export const cleanupExpiredTokens = async (): Promise<number> => {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  return result.count;
};

/**
 * Helper: Parse expiration string to milliseconds
 */
function parseExpiration(exp: string): number {
  const match = exp.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // Default 30 days

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 30 * 24 * 60 * 60 * 1000;
  }
}
