import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const KEY_MAINTENANCE = 'maintenance_mode';
const KEY_MAINTENANCE_MSG = 'maintenance_message';

const DEFAULT_MESSAGE = 'We are performing scheduled maintenance. Please check back soon.';

const SITE_KEYS = [
  'siteName', 'siteDescription', 'siteUrl', 'logoUrl',
  'email', 'phone', 'address',
  'socialFacebook', 'socialTwitter', 'socialInstagram', 'socialYoutube',
];

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function getAllSettings(): Promise<Record<string, string | null>> {
  const keys = [KEY_MAINTENANCE, KEY_MAINTENANCE_MSG, ...SITE_KEYS];
  const entries = await Promise.all(
    keys.map(async (k) => [k, await getSetting(k)] as const)
  );
  return Object.fromEntries(entries);
}

// GET /api/settings/public
router.get('/public', async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await getAllSettings();
    res.json({
      maintenanceMode: settings[KEY_MAINTENANCE] === 'true',
      maintenanceMessage: settings[KEY_MAINTENANCE_MSG] ?? DEFAULT_MESSAGE,
    });
  } catch {
    res.json({ maintenanceMode: false, maintenanceMessage: DEFAULT_MESSAGE });
  }
});

// GET /api/settings — admin only
router.get(
  '/',
  authenticate,
  requireRole('ADMIN', 'EDITOR'),
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const settings = await getAllSettings();
      const result: Record<string, any> = {
        maintenanceMode: settings[KEY_MAINTENANCE] === 'true',
        maintenanceMessage: settings[KEY_MAINTENANCE_MSG] ?? DEFAULT_MESSAGE,
      };
      for (const key of SITE_KEYS) {
        result[key] = settings[key] ?? '';
      }
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Failed to load settings' });
    }
  }
);

// PUT /api/settings — admin only
router.put(
  '/',
  authenticate,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const body = req.body as any;
    try {
      if (typeof body.maintenanceMode === 'boolean') {
        await setSetting(KEY_MAINTENANCE, body.maintenanceMode ? 'true' : 'false');
      }
      if (typeof body.maintenanceMessage === 'string') {
        await setSetting(KEY_MAINTENANCE_MSG, body.maintenanceMessage.trim() || DEFAULT_MESSAGE);
      }
      for (const key of SITE_KEYS) {
        if (typeof body[key] === 'string') {
          await setSetting(key, body[key]);
        }
      }
      const settings = await getAllSettings();
      const result: Record<string, any> = {
        maintenanceMode: settings[KEY_MAINTENANCE] === 'true',
        maintenanceMessage: settings[KEY_MAINTENANCE_MSG] ?? DEFAULT_MESSAGE,
      };
      for (const key of SITE_KEYS) {
        result[key] = settings[key] ?? '';
      }
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

export default router;
