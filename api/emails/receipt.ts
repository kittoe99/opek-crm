import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdminAuth, parseBody } from '../_lib/handler.js';
import { getDbClient, invokeEdgeFunction, logEmailSend } from '../_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withAdminAuth(req, res, async (req, res, user) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = parseBody<{ paymentId: string }>(req);
    const { paymentId } = body;

    if (!paymentId) {
      res.status(400).json({ error: 'paymentId is required' });
      return;
    }

    const admin = getDbClient(user.accessToken);
    const { data: payment, error } = await admin.from('payments').select('*').eq('id', paymentId).single();
    if (error || !payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    const payload = {
      type: 'UPDATE' as const,
      table: 'payments',
      record: payment,
      schema: 'public',
    };

    const { data, error: fnError } = await invokeEdgeFunction('send-payment-receipt', payload, user.accessToken);
    if (fnError) {
      res.status(500).json({ error: fnError.message });
      return;
    }

    try {
      await logEmailSend({
        sentBy: user.userId,
        functionName: 'send-payment-receipt',
        recordType: 'payment',
        recordId: paymentId,
        recipient: payment.customer_email ?? undefined,
      }, user.accessToken);
    } catch {
      // optional log table
    }

    res.status(200).json({ success: true, data });
  });
}
