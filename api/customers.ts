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
    const email = typeof req.query.email === 'string' ? decodeURIComponent(req.query.email).toLowerCase() : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    if (email) {
      const { data: customer } = await admin.from('customers').select('*').eq('email', email).maybeSingle();

      const bookingsQuery = customer?.id
        ? admin.from('bookings').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false })
        : admin.from('bookings').select('*').filter('customer_info->>email', 'ilike', email).order('created_at', { ascending: false });

      const [bookings, contacts, prebookings, payments, stripeCustomers] = await Promise.all([
        bookingsQuery,
        admin.from('contacts').select('*').filter('customer_info->>email', 'ilike', email).order('created_at', { ascending: false }),
        admin.from('Prebooking').select('*').filter('customer_info->>email', 'ilike', email).order('created_at', { ascending: false }),
        admin.from('payments').select('*').or(`customer_email.ilike.${email}`).order('created_at', { ascending: false }),
        admin.from('stripe_customers').select('*').ilike('email', email),
      ]);

      res.status(200).json({
        customer: customer ?? null,
        email,
        bookings: bookings.data ?? [],
        contacts: contacts.data ?? [],
        prebookings: prebookings.data ?? [],
        payments: payments.data ?? [],
        stripeCustomers: stripeCustomers.data ?? [],
      });
      return;
    }

    const { data, error } = await admin.rpc('crm_customer_summary', { p_search: search || null });

    if (error || !data?.length) {
      const items = await listCustomersFromTable(admin, search);
      res.status(200).json({ items });
      return;
    }

    res.status(200).json({ items: data });
  });
}

async function listCustomersFromTable(
  admin: ReturnType<typeof getDbClient>,
  search: string
) {
  let query = admin
    .from('customers')
    .select('id, email, name, phone, booking_count, last_booking_at')
    .order('last_booking_at', { ascending: false });

  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data: customers } = await query;
  return (customers ?? []).map((c) => ({
    id: c.id,
    email: c.email,
    name: c.name,
    phone: c.phone,
    bookings: c.booking_count ?? 0,
    contacts: 0,
    prebookings: 0,
    latest_at: c.last_booking_at,
  }));
}
