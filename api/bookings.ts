import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdminAuth, parseBody } from './_lib/handler.js';
import { getDbClient } from './_lib/supabaseAdmin.js';

const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'scheduled',
  'en_route',
  'in_progress',
  'completed',
  'cancelled',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withAdminAuth(req, res, async (req, res, user) => {
    const admin = getDbClient(user.accessToken);
    const id = typeof req.query.id === 'string' ? req.query.id : undefined;

    if (req.method === 'GET') {
      if (id) {
        const { data: booking, error } = await admin
          .from('bookings')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !booking) {
          res.status(404).json({ error: 'Booking not found' });
          return;
        }

        const [{ data: payments }, { data: history }, { data: assignments }] = await Promise.all([
          admin.from('payments').select('*').eq('booking_id', id).order('created_at', { ascending: false }),
          admin.from('order_status_history').select('*').eq('booking_id', id).order('created_at', { ascending: true }),
          admin
            .from('job_assignments')
            .select('*, drivers(id, full_name, email, phone, status)')
            .eq('booking_id', id)
            .order('assigned_at', { ascending: false }),
        ]);

        res.status(200).json({
          booking,
          payments: payments ?? [],
          history: history ?? [],
          assignments: assignments ?? [],
        });
        return;
      }

      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
      const offset = parseInt(String(req.query.offset || '0'), 10) || 0;

      let query = admin
        .from('bookings')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(
          `order_number.ilike.%${search}%,customer_info->>email.ilike.%${search}%,customer_info->>phone.ilike.%${search}%,customer_info->>name.ilike.%${search}%`
        );
      }

      const { data, error, count } = await query;
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const items = (data ?? []).map(flattenBooking);
      res.status(200).json({ items, total: count ?? 0, limit, offset });
      return;
    }

    if (req.method === 'PATCH' && id) {
      const body = parseBody<{ status?: string; note?: string }>(req);
      const { status, note } = body;

      if (!status || !BOOKING_STATUSES.includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }

      const { data: existing, error: fetchError } = await admin
        .from('bookings')
        .select('id, status')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }

      const { data: updated, error: updateError } = await admin
        .from('bookings')
        .update({ status })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        res.status(500).json({ error: updateError.message });
        return;
      }

      if (existing.status !== status) {
        await admin.from('order_status_history').insert({
          booking_id: id,
          status,
          note: note?.trim() || null,
        });
      }

      res.status(200).json({ booking: updated });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  });
}

function flattenBooking(row: Record<string, unknown>) {
  const customer = (row.customer_info as Record<string, string>) || {};
  const details = (row.booking_details as Record<string, string>) || {};
  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    name: customer.name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    preferred_date: details.preferred_date || '',
    preferred_time: details.preferred_time || '',
    service_type: details.service_type || '',
    created_at: row.created_at,
  };
}
