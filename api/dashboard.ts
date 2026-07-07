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

    const [
      { count: bookingsTotal },
      { data: bookingsByStatus },
      { count: contactsTotal },
      { count: prebookingsTotal },
      { count: paymentsTotal },
      { count: customersTotal },
      { count: unpaidDeposits },
    ] = await Promise.all([
      admin.from('bookings').select('*', { count: 'exact', head: true }),
      admin.from('bookings').select('status'),
      admin.from('contacts').select('*', { count: 'exact', head: true }),
      admin.from('Prebooking').select('*', { count: 'exact', head: true }),
      admin.from('payments').select('*', { count: 'exact', head: true }),
      admin.from('customers').select('*', { count: 'exact', head: true }),
      admin
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .filter('booking_details->>deposit_paid', 'neq', 'true'),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of bookingsByStatus ?? []) {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    }

    res.status(200).json({
      bookings: { total: bookingsTotal ?? 0, byStatus: statusCounts },
      contacts: contactsTotal ?? 0,
      prebookings: prebookingsTotal ?? 0,
      payments: paymentsTotal ?? 0,
      customers: customersTotal ?? 0,
      unpaidDeposits: unpaidDeposits ?? 0,
    });
  });
}
