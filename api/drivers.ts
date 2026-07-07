import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdminAuth, parseBody } from './_lib/handler.js';
import { getDbClient, invokeEdgeFunction, logEmailSend } from './_lib/supabaseAdmin.js';

const DRIVER_STATUSES = ['pending', 'approved', 'suspended'] as const;

function parseStates(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((s) => String(s).trim().toUpperCase()).filter((s) => s.length === 2);
  }
  if (typeof input === 'string') {
    return input
      .split(/[,;\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length === 2);
  }
  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withAdminAuth(req, res, async (req, res, user) => {
    const admin = getDbClient(user.accessToken);
    const id = typeof req.query.id === 'string' ? req.query.id : undefined;

    if (req.method === 'GET') {
      if (id) {
        const { data: driver, error } = await admin.from('drivers').select('*').eq('id', id).single();
        if (error || !driver) {
          res.status(404).json({ error: 'Driver not found' });
          return;
        }
        const { data: areas } = await admin
          .from('driver_service_areas')
          .select('state')
          .eq('driver_id', id)
          .order('state');
        res.status(200).json({ driver, states: (areas ?? []).map((a) => a.state) });
        return;
      }

      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      let query = admin.from('drivers').select('*').order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const drivers = data ?? [];
      const driverIds = drivers.map((d) => d.id);
      const { data: allAreas } = driverIds.length
        ? await admin.from('driver_service_areas').select('driver_id, state').in('driver_id', driverIds)
        : { data: [] };

      const statesByDriver: Record<string, string[]> = {};
      for (const row of allAreas ?? []) {
        if (!statesByDriver[row.driver_id]) statesByDriver[row.driver_id] = [];
        statesByDriver[row.driver_id].push(row.state);
      }

      const items = drivers.map((d) => ({
        ...d,
        states: (statesByDriver[d.id] ?? []).sort(),
      }));

      res.status(200).json({ items });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody<{
        provider_signup_id?: string;
        email?: string;
        full_name?: string;
        phone?: string;
        vehicle_type?: string;
        states?: string[] | string;
        status?: string;
      }>(req);

      if (body.provider_signup_id) {
        const { data: signup, error: signupError } = await admin
          .from('provider_signups')
          .select('*')
          .eq('id', body.provider_signup_id)
          .single();

        if (signupError || !signup) {
          res.status(404).json({ error: 'Provider signup not found' });
          return;
        }

        const customer = (signup.customer_info as Record<string, string>) || {};
        const provider = (signup.provider_info as Record<string, unknown>) || {};
        const serviceArea = String(provider.service_area || '');
        const statesFromArea = parseStates(serviceArea);

        const { data: driver, error: insertError } = await admin
          .from('drivers')
          .insert({
            provider_signup_id: signup.id,
            email: customer.email || '',
            full_name: customer.name || '',
            phone: customer.phone || '',
            vehicle_type: String(provider.vehicle_type || '') || null,
            status: 'pending',
          })
          .select('*')
          .single();

        if (insertError) {
          res.status(500).json({ error: insertError.message });
          return;
        }

        const states = parseStates(body.states).length ? parseStates(body.states) : statesFromArea;
        if (states.length) {
          await admin.from('driver_service_areas').insert(
            states.map((state) => ({ driver_id: driver.id, state }))
          );
        }

        res.status(201).json({ driver, states });
        return;
      }

      const email = body.email?.trim().toLowerCase();
      if (!email) {
        res.status(400).json({ error: 'email is required' });
        return;
      }

      const { data: driver, error: insertError } = await admin
        .from('drivers')
        .insert({
          email,
          full_name: body.full_name?.trim() || email,
          phone: body.phone?.trim() || '',
          vehicle_type: body.vehicle_type?.trim() || null,
          status: DRIVER_STATUSES.includes(body.status as (typeof DRIVER_STATUSES)[number])
            ? body.status
            : 'pending',
        })
        .select('*')
        .single();

      if (insertError) {
        res.status(500).json({ error: insertError.message });
        return;
      }

      const states = parseStates(body.states);
      if (states.length) {
        await admin.from('driver_service_areas').insert(
          states.map((state) => ({ driver_id: driver.id, state }))
        );
      }

      res.status(201).json({ driver, states });
      return;
    }

    if (req.method === 'PATCH' && id) {
      const body = parseBody<{
        status?: string;
        full_name?: string;
        phone?: string;
        vehicle_type?: string;
        user_id?: string | null;
        states?: string[] | string;
        approve_and_email?: boolean;
      }>(req);

      const updates: Record<string, unknown> = {};
      if (body.full_name !== undefined) updates.full_name = body.full_name.trim();
      if (body.phone !== undefined) updates.phone = body.phone.trim();
      if (body.vehicle_type !== undefined) updates.vehicle_type = body.vehicle_type.trim() || null;
      if (body.user_id !== undefined) updates.user_id = body.user_id || null;
      if (body.status && DRIVER_STATUSES.includes(body.status as (typeof DRIVER_STATUSES)[number])) {
        updates.status = body.status;
      }

      const shouldSendEmail = body.approve_and_email && body.status === 'approved';

      if (Object.keys(updates).length) {
        const { error: updateError } = await admin.from('drivers').update(updates).eq('id', id);
        if (updateError) {
          res.status(500).json({ error: updateError.message });
          return;
        }
      }

      if (shouldSendEmail) {
        const { data: driver } = await admin.from('drivers').select('*').eq('id', id).single();
        if (driver) {
          const driverEmail = driver.email as string;
          const driverName = (driver.full_name as string) || driverEmail;

          const record = { name: driverName, email: driverEmail, driver_id: id };

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
              { sentBy: user.userId, functionName: 'send-email', recordType: 'driver_approved', recordId: id, recipient: driverEmail },
              user.accessToken
            );
          } catch { /* optional log table */ }
        }
      }

      if (body.states !== undefined) {
        const states = parseStates(body.states);
        await admin.from('driver_service_areas').delete().eq('driver_id', id);
        if (states.length) {
          const { error: areaError } = await admin
            .from('driver_service_areas')
            .insert(states.map((state) => ({ driver_id: id, state })));
          if (areaError) {
            res.status(500).json({ error: areaError.message });
            return;
          }
        }
      }

      const { data: driver } = await admin.from('drivers').select('*').eq('id', id).single();
      const { data: areas } = await admin
        .from('driver_service_areas')
        .select('state')
        .eq('driver_id', id)
        .order('state');

      res.status(200).json({ driver, states: (areas ?? []).map((a) => a.state) });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  });
}
