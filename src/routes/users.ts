import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const USER_SELECT = { id: true, name: true, firstName: true, lastName: true, username: true, email: true, role: true, avatar: true, isVerified: true, createdAt: true };

// GET /api/users — Admin only
router.get('/', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({ select: USER_SELECT, orderBy: { createdAt: 'desc' } });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users — Admin only
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

// PUT /api/users/:id — Admin only
router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  [body('role').optional().isIn(['ADMIN', 'EDITOR', 'AUTHOR'])],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params.id);
    const { role, name } = req.body as { role?: string; name?: string };
    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(role ? { role: role as 'ADMIN' | 'EDITOR' | 'AUTHOR' } : {}),
          ...(name ? { name } : {}),
        },
        select: USER_SELECT,
      });
      res.json(user);
    } catch {
      res.status(404).json({ error: 'User not found' });
    }
  }
);

// DELETE /api/users/:id — Admin only
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
