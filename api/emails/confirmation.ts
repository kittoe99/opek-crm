import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdminAuth, parseBody } from '../_lib/handler.js';
import { getDbClient, invokeEdgeFunction, logEmailSend } from '../_lib/supabaseAdmin.js';

type EmailType = 'booking' | 'contact' | 'provider_signup' | 'driver_approved';

const TABLE_MAP: Record<EmailType, string> = {
  booking: 'bookings',
  contact: 'contacts',
  provider_signup: 'provider_signups',
  driver_approved: 'drivers',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withAdminAuth(req, res, async (req, res, user) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = parseBody<{ type: EmailType; recordId: string }>(req);
    const { type, recordId } = body;

    if (!type || !recordId || !TABLE_MAP[type]) {
      res.status(400).json({ error: 'Invalid type or recordId' });
      return;
    }

    const admin = getDbClient(user.accessToken);
    const { data: row, error } = await admin.from(TABLE_MAP[type]).select('*').eq('id', recordId).single();
    if (error || !row) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    const flatRecord = flattenForSendEmail(type, row as Record<string, unknown>);
    const { data, error: fnError } = await invokeEdgeFunction('send-email', { type, record: flatRecord }, user.accessToken);
    if (fnError) {
      res.status(500).json({ error: fnError.message });
      return;
    }

    try {
      await logEmailSend({
        sentBy: user.userId,
        functionName: 'send-email',
        recordType: type,
        recordId,
        recipient: flatRecord.email as string,
      }, user.accessToken);
    } catch {
      // optional log table
    }

    res.status(200).json({ success: true, data });
  });
}

function flattenForSendEmail(type: EmailType, row: Record<string, unknown>) {
  const customer = (row.customer_info as Record<string, string>) || {};
  const location = (row.location_info as Record<string, string>) || {};
  const details = (row.booking_details as Record<string, unknown>) || {};
  const contact = (row.contact_info as Record<string, string>) || {};
  const provider = (row.provider_info as Record<string, string>) || {};

  if (type === 'booking') {
    return {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      order_number: row.order_number,
      service_type: details.service_type,
      preferred_date: details.preferred_date,
      preferred_time: details.preferred_time,
      address: location.address,
      unit_number: location.unit_number,
      city: location.city,
      state: location.state,
      zip_code: location.zip_code,
      price: details.price,
      details: details.details,
    };
  }

  if (type === 'contact') {
    return {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      message: contact.message,
    };
  }

  if (type === 'driver_approved') {
    return {
      name: (row.full_name || row.email) as string,
      email: row.email as string,
      driver_id: row.id as string,
    };
  }

  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    service_area: provider.service_area,
    vehicle_type: provider.vehicle_type,
  };
}
