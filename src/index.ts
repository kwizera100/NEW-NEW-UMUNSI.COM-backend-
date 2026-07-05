import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

import authRoutes from './routes/auth';
import postsRoutes from './routes/posts';
import categoriesRoutes from './routes/categories';
import mediaRoutes from './routes/media';
import usersRoutes from './routes/users';
import statsRoutes from './routes/stats';
import settingsRoutes from './routes/settings';
import adsRoutes from './routes/ads';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.set('trust proxy', 1);

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = [
  process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  'http://localhost:3000',
  'https://umunsi.com',
  'https://www.umunsi.com',
  'https://umunsi.vercel.app',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || /\.vercel\.app$/.test(new URL(origin).hostname)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Global rate limiter: 200 req / 15 min per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  })
);

// Auth endpoints: tighter limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please wait.' },
});

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'development' });
});

// ─── Root ─────────────────────────────────────────────────────────────────────
app.get('/api', (_req, res) => {
  res.json({ success: true, message: 'Umunsi API is running', health: '/api/health' });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ads', adsRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'The requested resource was not found' });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong' });
});

app.listen(PORT, () => {
  console.log(`🚀 Umunsi API running on port ${PORT}`);
});

export default app;
