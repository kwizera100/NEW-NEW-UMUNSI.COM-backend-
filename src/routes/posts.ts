import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import slugify from 'slugify';

const router = Router();

const POST_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  featuredImage: true,
  status: true,
  isFeatured: true,
  isPremium: true,
  isPinned: true,
  allowComments: true,
  likeCount: true,
  commentCount: true,
  shareCount: true,
  views: true,
  tags: true,
  metaTitle: true,
  metaDescription: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  categoryId: true,
  author: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      avatar: true,
      profileUrl: true,
      role: true,
      isVerified: true,
    },
  },
  category: {
    select: { id: true, name: true, slug: true, color: true },
  },
};

// GET /api/posts?status=PUBLISHED&limit=20&page=1&sortBy=publishedAt&sortOrder=desc&category=<id>&search=<q>
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const status = req.query.status as string | undefined;
  const categoryId = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;
  const sortBy = (req.query.sortBy as string) || 'publishedAt';
  const sortOrder = (req.query.sortOrder as string) || 'desc';

  const where: any = {};
  if (status) where.status = status;
  if (categoryId) where.categoryId = Number(categoryId);
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { excerpt: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderBy: any = {};
  orderBy[sortBy] = sortOrder;

  try {
    const [total, posts] = await prisma.$transaction([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: POST_SELECT,
      }),
    ]);

    const pages = Math.ceil(total / limit);
    res.json({
      success: true,
      data: posts,
      pagination: { page, limit, total, pages },
    });
  } catch (err: any) {
    console.error('Fetch posts error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch posts' });
  }
});

// GET /api/posts/:slug
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const post = await prisma.post.findUnique({
      where: { slug: req.params.slug },
      select: POST_SELECT,
    });
    if (!post || post.status !== 'PUBLISHED') {
      res.status(404).json({ success: false, error: 'Post not found' });
      return;
    }

    await prisma.post.update({
      where: { id: post.id },
      data: { views: { increment: 1 } },
    });

    res.json({ success: true, data: post });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch post' });
  }
});

// GET /api/posts/by-id/:id (admin edit)
router.get('/by-id/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const post = await prisma.post.findUnique({
      where: { id },
      select: POST_SELECT,
    });
    if (!post) {
      res.status(404).json({ success: false, error: 'Post not found' });
      return;
    }
    res.json({ success: true, data: post });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch post' });
  }
});

// POST /api/posts
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'EDITOR', 'AUTHOR'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const {
      title, excerpt, content, categoryId, featuredImage, status,
      isFeatured, isPremium, isPinned, allowComments, tags,
      metaTitle, metaDescription,
    } = req.body as any;

    if (!title || !content || !categoryId) {
      res.status(400).json({ success: false, error: 'title, content, categoryId are required' });
      return;
    }

    const slug = slugify(title, { lower: true, strict: true });
    const postStatus = status || 'DRAFT';

    try {
      const post = await prisma.post.create({
        data: {
          title,
          slug,
          excerpt: excerpt || '',
          content,
          categoryId: Number(categoryId),
          authorId: req.user!.id,
          featuredImage: featuredImage || null,
          status: postStatus,
          isFeatured: isFeatured ?? false,
          isPremium: isPremium ?? false,
          isPinned: isPinned ?? false,
          allowComments: allowComments ?? true,
          tags: tags || [],
          metaTitle: metaTitle || null,
          metaDescription: metaDescription || null,
          publishedAt: postStatus === 'PUBLISHED' ? new Date() : null,
        },
        select: POST_SELECT,
      });
      res.status(201).json({ success: true, data: post });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('Unique constraint')) {
        res.status(409).json({ success: false, error: 'A post with this slug already exists' });
      } else {
        res.status(500).json({ success: false, error: 'Failed to create post' });
      }
    }
  }
);

// PUT /api/posts/:id
router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'EDITOR', 'AUTHOR'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params.id);
    const body = req.body as any;

    try {
      const existing = await prisma.post.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, error: 'Post not found' });
        return;
      }

      if (req.user!.role === 'AUTHOR' && existing.authorId !== req.user!.id) {
        res.status(403).json({ success: false, error: "Cannot edit another author's post" });
        return;
      }

      const wasPublished = existing.status === 'PUBLISHED';
      const data: any = {};
      if (body.title) { data.title = body.title; data.slug = slugify(body.title, { lower: true, strict: true }); }
      if (body.excerpt !== undefined) data.excerpt = body.excerpt;
      if (body.content) data.content = body.content;
      if (body.categoryId) data.categoryId = Number(body.categoryId);
      if (body.featuredImage !== undefined) data.featuredImage = body.featuredImage;
      if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured;
      if (body.isPremium !== undefined) data.isPremium = body.isPremium;
      if (body.isPinned !== undefined) data.isPinned = body.isPinned;
      if (body.allowComments !== undefined) data.allowComments = body.allowComments;
      if (body.tags !== undefined) data.tags = body.tags;
      if (body.metaTitle !== undefined) data.metaTitle = body.metaTitle;
      if (body.metaDescription !== undefined) data.metaDescription = body.metaDescription;
      if (body.status !== undefined) {
        data.status = body.status;
        if (!wasPublished && body.status === 'PUBLISHED') {
          data.publishedAt = new Date();
        }
      }

      const post = await prisma.post.update({ where: { id }, data, select: POST_SELECT });
      res.json({ success: true, data: post });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to update post' });
    }
  }
);

// DELETE /api/posts/:id
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'EDITOR'),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id);
    try {
      await prisma.post.delete({ where: { id } });
      res.status(204).send();
    } catch {
      res.status(500).json({ success: false, error: 'Failed to delete post' });
    }
  }
);

export default router;
