import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const KEY_MAINTENANCE = 'maintenance_mode';
const KEY_MAINTENANCE_MSG = 'maintenance_message';

const DEFAULT_MESSAGE = 'We are performing scheduled maintenance. Please check back soon.';

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

// GET /api/settings/public
router.get('/public', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [mode, message] = await Promise.all([
      getSetting(KEY_MAINTENANCE),
      getSetting(KEY_MAINTENANCE_MSG),
    ]);
    res.json({
      maintenanceMode: mode === 'true',
      maintenanceMessage: message ?? DEFAULT_MESSAGE,
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
      const [mode, message] = await Promise.all([
        getSetting(KEY_MAINTENANCE),
        getSetting(KEY_MAINTENANCE_MSG),
      ]);
      res.json({
        maintenanceMode: mode === 'true',
        maintenanceMessage: message ?? DEFAULT_MESSAGE,
      });
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
    const { maintenanceMode, maintenanceMessage } = req.body as {
      maintenanceMode?: boolean;
      maintenanceMessage?: string;
    };
    try {
      if (typeof maintenanceMode === 'boolean') {
        await setSetting(KEY_MAINTENANCE, maintenanceMode ? 'true' : 'false');
      }
      if (typeof maintenanceMessage === 'string') {
        await setSetting(KEY_MAINTENANCE_MSG, maintenanceMessage.trim() || DEFAULT_MESSAGE);
      }
      const [mode, message] = await Promise.all([
        getSetting(KEY_MAINTENANCE),
        getSetting(KEY_MAINTENANCE_MSG),
      ]);
      res.json({
        maintenanceMode: mode === 'true',
        maintenanceMessage: message ?? DEFAULT_MESSAGE,
      });
    } catch {
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

export default router;
