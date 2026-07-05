import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/ads — public
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const banners = await prisma.adBanner.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(banners);
  } catch {
    res.status(500).json({ error: 'Failed to load banners' });
  }
});

// GET /api/ads/all — admin only
router.get(
  '/all',
  authenticate,
  requireRole('ADMIN', 'EDITOR'),
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const banners = await prisma.adBanner.findMany({ orderBy: { sortOrder: 'asc' } });
      res.json(banners);
    } catch {
      res.status(500).json({ error: 'Failed to load banners' });
    }
  }
);

// GET /api/ads/:position — public
router.get('/:position', async (req: Request, res: Response): Promise<void> => {
  const { position } = req.params;
  try {
    const banner = await prisma.adBanner.findUnique({ where: { position } });
    if (!banner) {
      res.status(404).json({ error: 'Banner not found' });
      return;
    }
    res.json(banner);
  } catch {
    res.status(500).json({ error: 'Failed to load banner' });
  }
});

// PUT /api/ads/:position — admin only
router.put(
  '/:position',
  authenticate,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { position } = req.params;
    const { imageUrl, linkUrl, altText, width, height, active, sortOrder } = req.body as {
      imageUrl?: string; linkUrl?: string | null; altText?: string | null;
      width?: number; height?: number; active?: boolean; sortOrder?: number;
    };

    if (!imageUrl || typeof imageUrl !== 'string') {
      res.status(400).json({ error: 'imageUrl is required' });
      return;
    }

    try {
      const banner = await prisma.adBanner.upsert({
        where: { position },
        create: {
          position, imageUrl,
          linkUrl: linkUrl ?? null,
          altText: altText ?? null,
          width: typeof width === 'number' ? width : 100,
          height: typeof height === 'number' ? height : 100,
          active: typeof active === 'boolean' ? active : true,
          sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
        },
        update: {
          imageUrl,
          linkUrl: linkUrl ?? null,
          altText: altText ?? null,
          width: typeof width === 'number' ? width : undefined,
          height: typeof height === 'number' ? height : undefined,
          active: typeof active === 'boolean' ? active : undefined,
          sortOrder: typeof sortOrder === 'number' ? sortOrder : undefined,
        },
      });
      res.json(banner);
    } catch (err: any) {
      console.error('AdBanner upsert error:', err.message);
      res.status(500).json({ error: 'Failed to save banner' });
    }
  }
);

// DELETE /api/ads/:position — admin only
router.delete(
  '/:position',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { position } = req.params;
    try {
      await prisma.adBanner.delete({ where: { position } });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete banner' });
    }
  }
);

export default router;
