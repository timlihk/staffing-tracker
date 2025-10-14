import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export interface JWTPayload {
  userId: number;
  username: string;
  role: string;
}

export const generateToken = (payload: JWTPayload): string => {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as string | number;
  const options: SignOptions = { expiresIn };
  return jwt.sign(payload, JWT_SECRET, options);
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
  const options: SignOptions = { expiresIn: PASSWORD_RESET_EXPIRES_IN as string | number };
  return jwt.sign(payload, JWT_SECRET, options);
};

export const verifyPasswordResetToken = (token: string): PasswordResetPayload => {
  const decoded = jwt.verify(token, JWT_SECRET) as PasswordResetPayload & { purpose?: string };
  if (!decoded || decoded.purpose !== 'password_reset') {
    throw new Error('Invalid password reset token');
  }
  return { userId: decoded.userId, purpose: 'password_reset' };
};
