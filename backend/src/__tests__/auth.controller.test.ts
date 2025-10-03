import request from 'supertest';
import express from 'express';
import { login, register } from '../controllers/auth.controller';
import prisma from '../utils/prisma';
import * as jwtUtils from '../utils/jwt';
import * as bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../utils/jwt');
jest.mock('bcryptjs');

// Create test app
const app = express();
app.use(express.json());

// Add mock auth middleware for tests
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { id: 1, username: 'admin', role: 'admin' };
  next();
};

app.post('/api/auth/login', login);
app.post('/api/auth/register', mockAuth, register);

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashedPassword',
        role: 'viewer',
        mustResetPassword: false,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtUtils.generateToken as jest.Mock).mockReturnValue('mock-token');

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token', 'mock-token');
      expect(response.body.user).toMatchObject({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'viewer',
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 401 for invalid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'wronguser', password: 'wrongpass' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should return 401 for incorrect password', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        passwordHash: 'hashedPassword',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should flag password reset requirement', async () => {
      const mockUser = {
        id: 1,
        username: 'newuser',
        email: 'new@example.com',
        passwordHash: 'hashedPassword',
        role: 'viewer',
        mustResetPassword: true,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtUtils.generatePasswordResetToken as jest.Mock).mockReturnValue('reset-token');

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'newuser', password: 'temppass123' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('requiresPasswordReset', true);
      expect(response.body).toHaveProperty('resetToken', 'reset-token');
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Username and password are required');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 2,
        username: 'newuser',
        email: 'newuser@example.com',
        passwordHash: 'hashedPassword',
        role: 'viewer',
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (jwtUtils.generateToken as jest.Mock).mockReturnValue('new-token');

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token', 'new-token');
      expect(response.body.user.username).toBe('newuser');
    });

    it('should return 400 if username already exists', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 1, username: 'existing' });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'existing',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Username or email already exists');
    });
  });
});
