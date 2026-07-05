import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/categories
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { articles: { where: { published: true } } } } },
    });
    res.json(categories);
  } catch {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/categories/:slug
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await prisma.category.findUnique({
      where: { slug: req.params.slug },
      include: { _count: { select: { articles: { where: { published: true } } } } },
    });
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    res.json(category);
  } catch {
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// POST /api/categories (Admin only)
router.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { name, slug, description, color } = req.body as {
      name: string; slug: string; description?: string; color?: string;
    };
    if (!name || !slug) {
      res.status(400).json({ error: 'Name and slug are required' });
      return;
    }
    try {
      const category = await prisma.category.create({
        data: { name, slug, description, color: color ?? '#DC2626' },
      });
      res.status(201).json(category);
    } catch {
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
);

// PUT /api/categories/:id (Admin only)
router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid category id' });
      return;
    }
    const { name, slug, description, color } = req.body as {
      name: string; slug: string; description?: string; color?: string;
    };
    if (!name || !slug) {
      res.status(400).json({ error: 'Name and slug are required' });
      return;
    }
    try {
      const updated = await prisma.category.update({
        where: { id },
        data: { name, slug, description, color },
      });
      res.json(updated);
    } catch {
      res.status(500).json({ error: 'Failed to update category' });
    }
  }
);

// DELETE /api/categories/:id (Admin only)
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid category id' });
      return;
    }
    try {
      const count = await prisma.article.count({ where: { categoryId: id } });
      if (count > 0) {
        res.status(409).json({ error: `Cannot delete: ${count} article(s) use this category` });
        return;
      }
      await prisma.category.delete({ where: { id } });
      res.json({ success: true });
    } catch {
      res.status(404).json({ error: 'Category not found' });
    }
  }
);

export default router;
