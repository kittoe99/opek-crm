import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdmin, type AdminUser } from './auth.js';
import { handleOptions, setCorsHeaders } from './cors.js';

export async function withAdminAuth(
  req: VercelRequest,
  res: VercelResponse,
  handler: (req: VercelRequest, res: VercelResponse, user: AdminUser) => Promise<void>
): Promise<void> {
  if (handleOptions(req, res)) return;
  setCorsHeaders(req, res);

  const user = await verifyAdmin(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await handler(req, res, user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}

export function parseBody<T>(req: VercelRequest): T {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body) as T;
  }
  return (req.body ?? {}) as T;
}
