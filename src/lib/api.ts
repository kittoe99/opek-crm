import { supabase } from './supabase';

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiError('Not authenticated', 401);
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message === 'Failed to fetch'
        ? 'Could not reach the server. Check that the dev server is running.'
        : err instanceof Error
          ? err.message
          : 'Network error';
    throw new ApiError(message, 0);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const preview = (await res.text()).slice(0, 80);
    throw new ApiError(
      preview.startsWith('<!DOCTYPE') || preview.startsWith('<html')
        ? 'API returned HTML instead of JSON. Restart the dev server and try again.'
        : 'API returned a non-JSON response.',
      res.status
    );
  }

  const data = await res.json().catch(() => null);
  if (data === null || typeof data !== 'object') {
    throw new ApiError('Invalid API response', res.status);
  }
  if (!res.ok) {
    throw new ApiError(
      typeof (data as { error?: string }).error === 'string'
        ? (data as { error: string }).error
        : res.statusText,
      res.status
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
