import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdminAuth, parseBody } from './_lib/handler.js';
import { getDbClient } from './_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withAdminAuth(req, res, async (req, res, user) => {
    const admin = getDbClient(user.accessToken);
    const bookingId = typeof req.query.booking_id === 'string' ? req.query.booking_id : undefined;

    if (req.method === 'GET' && bookingId) {
      const { data, error } = await admin
        .from('job_assignments')
        .select('*, drivers(id, full_name, email, phone, status)')
        .eq('booking_id', bookingId)
        .order('assigned_at', { ascending: false });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ items: data ?? [] });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody<{
        booking_id?: string;
        driver_id?: string;
        note?: string;
        enforce_state?: boolean;
      }>(req);

      if (!body.booking_id || !body.driver_id) {
        res.status(400).json({ error: 'booking_id and driver_id are required' });
        return;
      }

      const { data, error } = await admin.rpc('assign_job', {
        p_booking_id: body.booking_id,
        p_driver_id: body.driver_id,
        p_note: body.note ?? null,
        p_enforce_state: body.enforce_state !== false,
      });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(201).json({ assignment: data });
      return;
    }

    if (req.method === 'PATCH') {
      const assignmentId = typeof req.query.id === 'string' ? req.query.id : undefined;
      if (!assignmentId) {
        res.status(400).json({ error: 'id is required' });
        return;
      }

      const body = parseBody<{ action?: string; note?: string }>(req);
      if (body.action !== 'cancel') {
        res.status(400).json({ error: 'action must be cancel' });
        return;
      }

      const { data, error } = await admin.rpc('cancel_job_assignment', {
        p_assignment_id: assignmentId,
        p_note: body.note ?? null,
      });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(200).json({ assignment: data });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  });
}
