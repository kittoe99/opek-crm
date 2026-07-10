import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdminAuth, parseBody } from './_lib/handler.js';
import { getDbClient } from './_lib/supabaseAdmin.js';

const DRIVER_STATUSES = ['pending', 'approved', 'suspended'] as const;

type AdminClient = ReturnType<typeof getDbClient>;

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

function statesFromProviderInfo(providerInfo: unknown): string[] {
  if (!providerInfo || typeof providerInfo !== 'object') return [];
  const info = providerInfo as Record<string, unknown>;
  const fromAreas: string[] = [];
  if (Array.isArray(info.service_areas)) {
    for (const area of info.service_areas) {
      if (area && typeof area === 'object' && 'state' in area) {
        const state = String((area as { state?: unknown }).state || '')
          .trim()
          .toUpperCase();
        if (state.length === 2) fromAreas.push(state);
      }
    }
  }
  const fromLegacy = parseStates(info.service_area);
  return [...new Set([...fromAreas, ...fromLegacy])];
}

async function writeServiceAreas(admin: AdminClient, driverId: string, states: string[]) {
  if (!states.length) return;
  await admin.from('driver_service_areas').upsert(
    states.map((state) => ({ driver_id: driverId, state })),
    { onConflict: 'driver_id,state', ignoreDuplicates: true }
  );
}

async function syncServiceAreasFromSignup(admin: AdminClient, driverId: string): Promise<string[]> {
  const { data: existing } = await admin
    .from('driver_service_areas')
    .select('state')
    .eq('driver_id', driverId);
  if ((existing ?? []).length > 0) {
    return (existing ?? []).map((r) => r.state);
  }

  const { data: driver } = await admin
    .from('drivers')
    .select('provider_signup_id')
    .eq('id', driverId)
    .maybeSingle();
  if (!driver?.provider_signup_id) return [];

  const { data: signup } = await admin
    .from('provider_signups')
    .select('provider_info')
    .eq('id', driver.provider_signup_id)
    .maybeSingle();
  const states = statesFromProviderInfo(signup?.provider_info);
  if (!states.length) return [];

  await writeServiceAreas(admin, driverId, states);
  return states;
}

/** Find existing driver by signup id or email (case-insensitive). */
async function findExistingDriver(
  admin: AdminClient,
  opts: { providerSignupId?: string; email?: string }
) {
  if (opts.providerSignupId) {
    const { data } = await admin
      .from('drivers')
      .select('*')
      .eq('provider_signup_id', opts.providerSignupId)
      .maybeSingle();
    if (data) return data;
  }
  const email = opts.email?.trim().toLowerCase();
  if (email) {
    const { data } = await admin
      .from('drivers')
      .select('*')
      .ilike('email', email)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  return null;
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
        has_login: !!d.user_id,
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
        const statesFromSignup = statesFromProviderInfo(provider);
        const statesFromBody = parseStates(body.states);
        const states = [...new Set([...statesFromBody, ...statesFromSignup])];

        if (!states.length) {
          res.status(400).json({
            error:
              'This provider signup has no service areas. Ask the hauler to re-submit coverage, or set states manually.',
          });
          return;
        }

        const email = (customer.email || '').trim().toLowerCase();
        const vehicleType =
          String(provider.vehicle_type || '').trim() ||
          (provider.vehicle && typeof provider.vehicle === 'object'
            ? String((provider.vehicle as { type?: string }).type || '').trim()
            : '') ||
          null;

        const existing = await findExistingDriver(admin, {
          providerSignupId: signup.id,
          email,
        });

        if (existing) {
          const updates: Record<string, unknown> = {
            provider_signup_id: existing.provider_signup_id || signup.id,
            updated_at: new Date().toISOString(),
          };
          if (customer.name) updates.full_name = customer.name;
          if (customer.phone) updates.phone = customer.phone;
          if (vehicleType) updates.vehicle_type = vehicleType;
          if (email && !existing.email) updates.email = email;

          const { data: driver, error: updateError } = await admin
            .from('drivers')
            .update(updates)
            .eq('id', existing.id)
            .select('*')
            .single();

          if (updateError || !driver) {
            res.status(500).json({ error: updateError?.message || 'Failed to update existing driver' });
            return;
          }

          await writeServiceAreas(admin, driver.id, states);
          const { data: areas } = await admin
            .from('driver_service_areas')
            .select('state')
            .eq('driver_id', driver.id)
            .order('state');

          res.status(200).json({
            driver,
            states: (areas ?? []).map((a) => a.state),
            reused: true,
          });
          return;
        }

        const { data: driver, error: insertError } = await admin
          .from('drivers')
          .insert({
            provider_signup_id: signup.id,
            email,
            full_name: customer.name || '',
            phone: customer.phone || '',
            vehicle_type: vehicleType,
            status: 'pending',
          })
          .select('*')
          .single();

        if (insertError) {
          // Unique violation — race with another create; return existing.
          if (insertError.code === '23505') {
            const raced = await findExistingDriver(admin, {
              providerSignupId: signup.id,
              email,
            });
            if (raced) {
              await writeServiceAreas(admin, raced.id, states);
              res.status(200).json({ driver: raced, states, reused: true });
              return;
            }
          }
          res.status(500).json({ error: insertError.message });
          return;
        }

        await writeServiceAreas(admin, driver.id, states);
        res.status(201).json({ driver, states });
        return;
      }

      const email = body.email?.trim().toLowerCase();
      if (!email) {
        res.status(400).json({ error: 'email is required' });
        return;
      }

      const existing = await findExistingDriver(admin, { email });
      if (existing) {
        res.status(409).json({
          error: `A driver already exists for ${email}. Open that profile instead of creating a duplicate.`,
          driver: existing,
        });
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
        if (insertError.code === '23505') {
          res.status(409).json({ error: `A driver already exists for ${email}.` });
          return;
        }
        res.status(500).json({ error: insertError.message });
        return;
      }

      const states = parseStates(body.states);
      await writeServiceAreas(admin, driver.id, states);

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
      }>(req);

      const updates: Record<string, unknown> = {};
      if (body.full_name !== undefined) updates.full_name = body.full_name.trim();
      if (body.phone !== undefined) updates.phone = body.phone.trim();
      if (body.vehicle_type !== undefined) updates.vehicle_type = body.vehicle_type.trim() || null;
      if (body.user_id !== undefined) updates.user_id = body.user_id || null;
      if (body.status && DRIVER_STATUSES.includes(body.status as (typeof DRIVER_STATUSES)[number])) {
        updates.status = body.status;
      }

      if (Object.keys(updates).length) {
        const { error: updateError } = await admin.from('drivers').update(updates).eq('id', id);
        if (updateError) {
          res.status(500).json({ error: updateError.message });
          return;
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
      } else if (updates.status === 'approved') {
        await syncServiceAreasFromSignup(admin, id);
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
