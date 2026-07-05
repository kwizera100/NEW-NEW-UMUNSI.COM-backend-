import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, cb) { cb(null, UPLOAD_DIR); },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const name = crypto.randomBytes(12).toString('hex');
    cb(null, `${name}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// GET /api/media — authenticated, list all uploaded files
router.get('/', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
      .map(f => ({
        name: f,
        url: `/uploads/${f}`,
        type: 'image',
        size: fs.statSync(path.join(UPLOAD_DIR, f)).size,
      }))
      .reverse();
    res.json(files);
  } catch {
    res.json([]);
  }
});

// POST /api/media/upload — authenticated, upload single file
router.post('/upload', authenticate, upload.single('file'), (req: AuthRequest, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ error: 'No valid image file provided. Allowed: JPEG, PNG, WebP, GIF (max 10MB)' });
    return;
  }
  res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename });
});

export default router;
