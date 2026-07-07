import type { VercelRequest } from '@vercel/node';
import { getAuthClient } from './supabaseAdmin.js';

export interface AdminUser {
  userId: string;
  email: string;
  accessToken: string;
}

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyAdmin(req: VercelRequest): Promise<AdminUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const accessToken = authHeader.slice(7);
  const client = getAuthClient();
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user?.email) {
    return null;
  }

  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    return null;
  }

  if (!adminEmails.includes(data.user.email.toLowerCase())) {
    return null;
  }

  return { userId: data.user.id, email: data.user.email, accessToken };
}
