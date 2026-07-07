import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdminAuth, parseBody } from '../_lib/handler.js';
import { getDbClient, invokeEdgeFunction, logEmailSend } from '../_lib/supabaseAdmin.js';

const TABLE_MAP: Record<string, string> = {
  bookings: 'bookings',
  contacts: 'contacts',
  prebookings: 'Prebooking',
  providers: 'provider_signups',
  visits: 'schedule_visits',
  estimates: 'in_home_estimates',
};

const WEBHOOK_TABLE_MAP: Record<string, string> = {
  bookings: 'bookings',
  contacts: 'contacts',
  providers: 'provider_signups',
  visits: 'schedule_visits',
  estimates: 'in_home_estimates',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withAdminAuth(req, res, async (req, res, user) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = parseBody<{ recordType: string; recordId: string }>(req);
    const { recordType, recordId } = body;

    const table = TABLE_MAP[recordType];
    const webhookTable = WEBHOOK_TABLE_MAP[recordType];
    if (!table || !webhookTable || !recordId) {
      res.status(400).json({ error: 'Invalid recordType or recordId' });
      return;
    }

    const admin = getDbClient(user.accessToken);
    const { data: record, error } = await admin.from(table).select('*').eq('id', recordId).single();
    if (error || !record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    const payload = {
      type: 'INSERT' as const,
      table: webhookTable,
      record,
      schema: 'public',
    };

    const { data, error: fnError } = await invokeEdgeFunction('send-form-notification', payload, user.accessToken);
    if (fnError) {
      res.status(500).json({ error: fnError.message });
      return;
    }

    const recipient = (record.customer_info as Record<string, string>)?.email;
    try {
      await logEmailSend({
        sentBy: user.userId,
        functionName: 'send-form-notification',
        recordType,
        recordId,
        recipient,
      }, user.accessToken);
    } catch {
      // crm_email_log may not exist yet
    }

    res.status(200).json({ success: true, data });
  });
}
