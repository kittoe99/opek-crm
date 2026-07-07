import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdminAuth, parseBody } from '../_lib/handler.js';
import { getDbClient, invokeEdgeFunction, logEmailSend } from '../_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withAdminAuth(req, res, async (req, res, user) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = parseBody<{ bookingId: string }>(req);
    const { bookingId } = body;

    if (!bookingId) {
      res.status(400).json({ error: 'bookingId is required' });
      return;
    }

    const admin = getDbClient(user.accessToken);
    const { data: booking, error } = await admin.from('bookings').select('*').eq('id', bookingId).single();
    if (error || !booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    const customer = (booking.customer_info as Record<string, string>) || {};
    const location = (booking.location_info as Record<string, string>) || {};
    const details = (booking.booking_details as Record<string, string>) || {};

    const fullAddress = [location.address, location.unit_number, location.city, location.state, location.zip_code]
      .filter(Boolean)
      .join(', ');

    const record = {
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      order_number: booking.order_number,
      preferred_date: details.preferred_date,
      preferred_time: details.preferred_time,
      address: fullAddress,
    };

    const { data, error: fnError } = await invokeEdgeFunction('send-reminder', {
      type: 'appointment_reminder',
      record,
    }, user.accessToken);

    if (fnError) {
      res.status(500).json({ error: fnError.message });
      return;
    }

    try {
      await logEmailSend({
        sentBy: user.userId,
        functionName: 'send-reminder',
        recordType: 'booking',
        recordId: bookingId,
        recipient: customer.email,
      }, user.accessToken);
    } catch {
      // optional log table
    }

    res.status(200).json({ success: true, data });
  });
}
