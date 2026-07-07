# Opek CRM

Internal admin CRM for Opek Junk Removal. Connects to the same Supabase project as opek-junk-master.

## Setup

```bash
cp .env.example .env
# Fill in VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS
npm install
```

## Development

Requires [Vercel CLI](https://vercel.com/docs/cli) for API routes:

```bash
# Frontend only (login works; API shows a helpful error)
npm run dev

# Full CRM with /api routes
npm run dev:full
```

Opens at http://localhost:5173

## Deploy (Vercel)

1. Create a new Vercel project linked to this directory (`vercel link` then `vercel --prod`).
2. Set environment variables in Vercel:
   - `VITE_SUPABASE_URL` = `https://mjgwoukwyqwoectxfwqv.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL` = same as above
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_EMAILS` = comma-separated admin emails (must match Supabase Auth users)
   - `ALLOWED_ORIGINS` = `https://crm.opekjunkremoval.com,http://localhost:5173`
3. Configure custom domain e.g. `crm.opekjunkremoval.com`.
4. Database migration `20260628000000_crm_support.sql` adds `crm_email_log` and `crm_customer_summary()` RPC (already applied).
5. Edge function `send-reminder` is deployed for appointment reminder emails from booking detail pages.

## Auth

Admins sign in with Supabase Auth (email/password). The API verifies the JWT and checks the email against `ADMIN_EMAILS`. All database access uses the service role key server-side.

Example `.env` for local dev:

```
VITE_SUPABASE_URL=https://mjgwoukwyqwoectxfwqv.supabase.co
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=https://mjgwoukwyqwoectxfwqv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_EMAILS=your@email.com
```
