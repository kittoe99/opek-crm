import { createClient, SupabaseClient } from '@supabase/supabase-js';

let serviceRoleClient: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  const rawUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (rawUrl && rawUrl !== 'your_supabase_url_here') {
    return rawUrl;
  }
  throw new Error('SUPABASE_URL is not configured.');
}

function getAnonKey(): string {
  const key =
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (key && key !== 'your_supabase_anon_key_here') {
    return key;
  }
  throw new Error('VITE_SUPABASE_ANON_KEY is not configured.');
}

function getServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
}

/** Prefer service_role when configured; otherwise use the admin user's JWT (requires CRM RLS policies). */
export function getDbClient(accessToken: string): SupabaseClient {
  const serviceRoleKey = getServiceRoleKey();
  if (serviceRoleKey) {
    if (!serviceRoleClient) {
      serviceRoleClient = createClient(getSupabaseUrl(), serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return serviceRoleClient;
  }

  return createClient(getSupabaseUrl(), getAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** @deprecated Use getDbClient(accessToken) */
export function getSupabaseAdmin(): SupabaseClient {
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. CRM uses your login token instead when running API routes.'
    );
  }
  return getDbClient('');
}

export function getAuthClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function invokeEdgeFunction(
  name: string,
  body: Record<string, unknown>,
  accessToken: string
): Promise<{ data: unknown; error: Error | null }> {
  const client = getServiceRoleKey()
    ? getDbClient(accessToken)
    : createClient(getSupabaseUrl(), getAnonKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

  const { data, error } = await client.functions.invoke(name, { body });
  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  return { data, error: null };
}

export async function logEmailSend(
  params: {
    sentBy: string;
    functionName: string;
    recordType?: string;
    recordId?: string;
    recipient?: string;
  },
  accessToken: string
): Promise<void> {
  const client = getDbClient(accessToken);
  await client.from('crm_email_log').insert({
    sent_by: params.sentBy,
    function_name: params.functionName,
    record_type: params.recordType ?? null,
    record_id: params.recordId ?? null,
    recipient: params.recipient ?? null,
  });
}
