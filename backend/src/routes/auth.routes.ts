import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema, resetPasswordSchema } from '../schemas/auth.schema';
import { passwordResetLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login to the system
 *     description: Authenticate user with username and password, returns JWT access token and sets HTTP-only refresh token cookie
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 format: password
 *                 example: StrongPassword123!
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 accessToken:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many requests (rate limited)
 */
router.post('/login', validate(loginSchema), asyncHandler(authController.login));

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, role]
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [admin, editor, viewer]
 *               staffId:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       201:
 *         description: User created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.post('/register', authenticate, authorize('admin'), validate(registerSchema), asyncHandler(authController.register));

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user info
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, asyncHandler(authController.me));

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Reset user password (Admin only)
 *     description: Reset a user's password. Rate limited to 3 attempts per 15 minutes.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), asyncHandler(authController.resetPassword));

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh access token
 *     description: Get a new access token using the refresh token from HTTP-only cookie
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: New access token generated
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', asyncHandler(authController.refresh));

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout from current session
 *     description: Invalidates the refresh token from the current session
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', asyncHandler(authController.logout));

/**
 * @openapi
 * /auth/logout-all:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout from all sessions
 *     description: Invalidates all refresh tokens for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all sessions successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/logout-all', authenticate, asyncHandler(authController.logoutAll));

export default router;
