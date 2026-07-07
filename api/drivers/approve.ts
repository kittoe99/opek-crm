import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdminAuth, parseBody } from '../_lib/handler.js';
import { getDbClient, invokeEdgeFunction, logEmailSend } from '../_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withAdminAuth(req, res, async (req, res, user) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = parseBody<{ id: string }>(req);
    const driverId = body.id;

    if (!driverId) {
      res.status(400).json({ error: 'Driver id is required' });
      return;
    }

    const admin = getDbClient(user.accessToken);

    const { data: driver, error: driverError } = await admin
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();

    if (driverError || !driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    const { error: updateError } = await admin
      .from('drivers')
      .update({ status: 'approved' })
      .eq('id', driverId);

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }

    const driverEmail = driver.email as string;
    const driverName = (driver.full_name as string) || driverEmail;

    const record = {
      name: driverName,
      email: driverEmail,
      driver_id: driverId,
    };

    const { error: fnError } = await invokeEdgeFunction(
      'send-email',
      { type: 'driver_approved', record },
      user.accessToken
    );

    if (fnError) {
      console.error('Failed to send welcome email:', fnError.message);
    }

    try {
      await logEmailSend(
        {
          sentBy: user.userId,
          functionName: 'send-email',
          recordType: 'driver_approved',
          recordId: driverId,
          recipient: driverEmail,
        },
        user.accessToken
      );
    } catch {
      // optional log table — silently ignore
    }

    res.status(200).json({
      message: `Driver ${driverName} approved and welcome email sent to ${driverEmail}.`,
    });
  });
}
