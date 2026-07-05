import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/stats — authenticated users only
router.get('/', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [articles, published, categories, users] = await Promise.all([
      prisma.article.count(),
      prisma.article.count({ where: { published: true } }),
      prisma.category.count(),
      prisma.user.count(),
    ]);
    res.json({ articles, published, draft: articles - published, categories, users });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
