import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdminAuth, parseBody } from './_lib/handler.js';
import { getDbClient } from './_lib/supabaseAdmin.js';

const RECORD_TYPES: Record<string, { table: string; hasStatus: boolean }> = {
  contacts: { table: 'contacts', hasStatus: false },
  prebookings: { table: 'Prebooking', hasStatus: true },
  providers: { table: 'provider_signups', hasStatus: true },
  visits: { table: 'schedule_visits', hasStatus: true },
  estimates: { table: 'in_home_estimates', hasStatus: false },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withAdminAuth(req, res, async (req, res, user) => {
    const admin = getDbClient(user.accessToken);
    const type = typeof req.query.type === 'string' ? req.query.type : '';
    const config = RECORD_TYPES[type];

    if (!config) {
      res.status(400).json({ error: 'Invalid type. Use: contacts, prebookings, providers, visits, estimates' });
      return;
    }

    const id = typeof req.query.id === 'string' ? req.query.id : undefined;

    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await admin.from(config.table).select('*').eq('id', id).single();
        if (error || !data) {
          res.status(404).json({ error: 'Record not found' });
          return;
        }
        res.status(200).json({ record: data });
        return;
      }

      const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
      const offset = parseInt(String(req.query.offset || '0'), 10) || 0;

      const { data, error, count } = await admin
        .from(config.table)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const items = (data ?? []).map((row) => flattenRecord(row as Record<string, unknown>));
      res.status(200).json({ items, total: count ?? 0, type, limit, offset });
      return;
    }

    if (req.method === 'PATCH' && id && config.hasStatus) {
      const body = parseBody<{ status?: string }>(req);
      if (!body.status?.trim()) {
        res.status(400).json({ error: 'status is required' });
        return;
      }

      const { data, error } = await admin
        .from(config.table)
        .update({ status: body.status.trim() })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ record: data });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  });
}

function flattenRecord(row: Record<string, unknown>) {
  const customer = (row.customer_info as Record<string, string>) || {};
  return {
    id: row.id,
    status: row.status as string | undefined,
    name: customer.name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    created_at: row.created_at,
    raw: row,
  };
}
