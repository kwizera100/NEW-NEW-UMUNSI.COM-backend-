import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const USER_SELECT = { id: true, name: true, firstName: true, lastName: true, username: true, email: true, role: true, avatar: true, profileUrl: true, isVerified: true, createdAt: true };

// GET /api/users - Admin only
router.get('/', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({ select: USER_SELECT, orderBy: { createdAt: 'desc' } });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/profile/:username - PUBLIC endpoint for author profile page
// IMPORTANT: This must be defined BEFORE /:id to avoid route conflict
router.get('/profile/:username', async (req: Request, res: Response): Promise<void> => {
  try {
    const username = req.params.username;
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, firstName: true, lastName: true, username: true, avatar: true, profileUrl: true, role: true, isVerified: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users - Admin only
router.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['ADMIN', 'EDITOR', 'AUTHOR']).withMessage('Role must be ADMIN, EDITOR, or AUTHOR'),
    body('username').optional().trim().notEmpty().withMessage('Username cannot be empty'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, firstName, lastName, username, email, password, role } = req.body as any;
    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      const finalUsername = username || email.split('@')[0];
      const existingUsername = await prisma.user.findUnique({ where: { username: finalUsername } });
      if (existingUsername) {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          name,
          firstName: firstName || null,
          lastName: lastName || null,
          username: finalUsername,
          email,
          passwordHash,
          role: role as 'ADMIN' | 'EDITOR' | 'AUTHOR',
        },
        select: USER_SELECT,
      });
      res.status(201).json(user);
    } catch (err: any) {
      console.error('Create user error:', err.message);
      res.status(500).json({ error: 'Internal server error', message: err.message });
    }
  }
);

// PUT /api/users/:id - Admin OR self (self can only update profile fields, not role)
router.put(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params.id);
    const body = req.body as any;

    try {
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const isSelf = req.user?.id === id;
      const isAdmin = req.user?.role === 'ADMIN';

      if (!isSelf && !isAdmin) {
        res.status(403).json({ error: 'Cannot update another user profile' });
        return;
      }

      const data: any = {};

      // Profile fields anyone can update on themselves
      if (body.name !== undefined) data.name = body.name;
      if (body.firstName !== undefined) data.firstName = body.firstName;
      if (body.lastName !== undefined) data.lastName = body.lastName;
      if (body.avatar !== undefined) data.avatar = body.avatar;
      if (body.profileUrl !== undefined) data.profileUrl = body.profileUrl;

      // Admin-only fields
      if (isAdmin) {
        if (body.role !== undefined) data.role = body.role;
        if (body.email !== undefined) data.email = body.email;
        if (body.username !== undefined) data.username = body.username;
        if (body.isVerified !== undefined) data.isVerified = body.isVerified;
      }

      const user = await prisma.user.update({
        where: { id },
        data,
        select: USER_SELECT,
      });
      res.json(user);
    } catch (err: any) {
      console.error('Update user error:', err.message);
      res.status(404).json({ error: 'User not found' });
    }
  }
);

// DELETE /api/users/:id - Admin only
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  if (req.user?.id === id) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

export default router;
