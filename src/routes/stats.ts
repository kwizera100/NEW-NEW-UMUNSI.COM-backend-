import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/stats — authenticated users only
router.get('/', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [posts, published, categories, users] = await Promise.all([
      prisma.post.count(),
      prisma.post.count({ where: { status: 'PUBLISHED' } }),
      prisma.category.count(),
      prisma.user.count(),
    ]);
    res.json({ posts, published, draft: posts - published, categories, users });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
