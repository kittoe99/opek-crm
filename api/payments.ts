import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdminAuth } from './_lib/handler.js';
import { getDbClient } from './_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withAdminAuth(req, res, async (req, res, user) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const admin = getDbClient(user.accessToken);
    const id = typeof req.query.id === 'string' ? req.query.id : undefined;

    if (id) {
      const { data, error } = await admin.from('payments').select('*').eq('id', id).single();
      if (error || !data) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }
      res.status(200).json({ payment: data });
      return;
    }

    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const offset = parseInt(String(req.query.offset || '0'), 10) || 0;

    const { data, error, count } = await admin
      .from('payments')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const items = (data ?? []).map((p) => ({
      id: p.id,
      stripe_payment_intent_id: p.stripe_payment_intent_id,
      amount_cents: p.amount_cents,
      currency: p.currency,
      status: p.status,
      customer_email: p.customer_email,
      booking_id: p.booking_id,
      payment_type: p.payment_type,
      receipt_sent_at: p.receipt_sent_at,
      created_at: p.created_at,
    }));

    res.status(200).json({ items, total: count ?? 0, limit, offset });
  });
}
