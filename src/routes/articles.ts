import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import slugify from 'slugify';

const router = Router();

const ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  thumbnailUrl: true,
  imageUrl: true,
  readTime: true,
  publishedAt: true,
  published: true,
  views: true,
  category: { select: { id: true, name: true, slug: true, color: true } },
  author: { select: { id: true, name: true } },
};

// GET /api/articles/latest?limit=5
router.get('/latest', async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);
  try {
    const articles = await prisma.article.findMany({
      where: { published: true },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: ARTICLE_SELECT,
    });
    res.json(articles);
  } catch {
    res.status(500).json({ error: 'Failed to fetch latest articles' });
  }
});

// GET /api/articles?page=1&pageSize=8&categorySlug=ents
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const pageSize = Math.min(parseInt(req.query.pageSize as string) || 8, 50);
  const categorySlug = req.query.categorySlug as string | undefined;

  const where = {
    published: true,
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
  };

  try {
    const [total, articles] = await prisma.$transaction([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: ARTICLE_SELECT,
      }),
    ]);

    res.json({
      data: articles,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// GET /api/articles/by-id/:id (admin edit)
router.get('/by-id/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const article = await prisma.article.findUnique({
      where: { id },
      select: { ...ARTICLE_SELECT, author: { select: { id: true, name: true } } },
    });
    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }
    res.json(article);
  } catch {
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// GET /api/articles/:slug
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const article = await prisma.article.findUnique({
      where: { slug: req.params.slug },
      select: { ...ARTICLE_SELECT, author: { select: { id: true, name: true } } },
    });
    if (!article || !article.published) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    await prisma.article.update({
      where: { id: article.id },
      data: { views: { increment: 1 } },
    });

    res.json(article);
  } catch {
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// POST /api/articles (Editor/Admin/Author)
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'EDITOR', 'AUTHOR'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { title, excerpt, content, categoryId, readTime, published, thumbnailUrl, imageUrl } = req.body as {
      title: string; excerpt: string; content: string; categoryId: number;
      readTime?: number; published?: boolean; thumbnailUrl?: string; imageUrl?: string;
    };

    if (!title || !excerpt || !content || !categoryId) {
      res.status(400).json({ error: 'title, excerpt, content, categoryId are required' });
      return;
    }

    const slug = slugify(title, { lower: true, strict: true });

    try {
      const article = await prisma.article.create({
        data: {
          title,
          slug,
          excerpt,
          content,
          categoryId: Number(categoryId),
          authorId: req.user!.id,
          readTime: readTime ?? 1,
          published: published ?? false,
          publishedAt: published ? new Date() : null,
          thumbnailUrl: thumbnailUrl || null,
          imageUrl: imageUrl || null,
        },
        select: ARTICLE_SELECT,
      });
      res.status(201).json(article);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('Unique constraint')) {
        res.status(409).json({ error: 'An article with this slug already exists' });
      } else {
        res.status(500).json({ error: 'Failed to create article' });
      }
    }
  }
);

// PUT /api/articles/:id
router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'EDITOR', 'AUTHOR'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params.id);
    const { title, excerpt, content, categoryId, readTime, published, thumbnailUrl, imageUrl } =
      req.body as {
        title?: string; excerpt?: string; content?: string; categoryId?: number;
        readTime?: number; published?: boolean; thumbnailUrl?: string; imageUrl?: string;
      };

    try {
      const existing = await prisma.article.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      if (req.user!.role === 'AUTHOR' && existing.authorId !== req.user!.id) {
        res.status(403).json({ error: "Cannot edit another author's article" });
        return;
      }

      const wasPublished = existing.published;
      const article = await prisma.article.update({
        where: { id },
        data: {
          ...(title && { title, slug: slugify(title, { lower: true, strict: true }) }),
          ...(excerpt && { excerpt }),
          ...(content && { content }),
          ...(categoryId && { categoryId: Number(categoryId) }),
          ...(readTime && { readTime }),
          ...(published !== undefined && {
            published,
            publishedAt: !wasPublished && published ? new Date() : existing.publishedAt,
          }),
          ...(thumbnailUrl !== undefined && { thumbnailUrl }),
          ...(imageUrl !== undefined && { imageUrl }),
        },
        select: ARTICLE_SELECT,
      });
      res.json(article);
    } catch {
      res.status(500).json({ error: 'Failed to update article' });
    }
  }
);

// DELETE /api/articles/:id (Admin/Editor)
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'EDITOR'),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id);
    try {
      await prisma.article.delete({ where: { id } });
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'Failed to delete article' });
    }
  }
);

export default router;
