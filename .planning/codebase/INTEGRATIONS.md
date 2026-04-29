# External Integrations

**Analysis Date:** 2026-04-29

## APIs & External Services

**Backend platform:**
- Supabase - database, auth, storage, RPCs, and Edge Functions used throughout the codebase
  - SDK/Client: `@supabase/supabase-js` in `lib/supabaseClient.ts`
  - Auth: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, plus server-side `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `supabase/functions/_shared/supabase.ts`

**Email invite flow:**
- Supabase Auth admin invite - user creation/invite flow in `supabase/functions/admin-invite-user/index.ts`
  - SDK/Client: service-role client from `supabase/functions/_shared/supabase.ts`
  - Auth: caller JWT via `Authorization` header plus service-role secret

**File access:**
- Supabase Storage signed URLs - proof preview flow in `supabase/functions/get-proof-signed-url/index.ts`
  - Bucket: `payment-proofs` from `supabase/migrations/0006_storage.sql`
  - Auth: caller JWT plus service-role secret for signed URL generation

## Data Storage

**Databases:**
- Supabase Postgres
  - Connection: managed through Supabase client configuration in `lib/supabaseClient.ts` and `supabase/functions/_shared/supabase.ts`
  - Client: direct Supabase query builder and RPC usage; no ORM detected

**File Storage:**
- Supabase Storage buckets `payment-proofs` and `report-files` defined in `supabase/migrations/0006_storage.sql`

**Caching:**
- Not detected

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: browser session bootstrap and auth state listener in `features/auth/AuthProvider.tsx`; route guards in `features/auth/RequireAuth.tsx`, `features/auth/RequireAdminLike.tsx`, and `features/auth/RequireSuperAdmin.tsx`

## Monitoring & Observability

**Error Tracking:**
- No external error tracking service detected

**Logs:**
- Audit logging persisted to `public.audit_logs` via RPC `public.log_admin_action` in `supabase/migrations/0009_m03_audit_log_rpc.sql`
- Direct audit inserts also occur in `supabase/functions/admin-invite-user/index.ts`, `supabase/functions/get-proof-signed-url/index.ts`, and SQL functions in `supabase/migrations/0011_m06_verification_audit.sql`
- Client-side warnings use `console.warn` in `lib/supabaseClient.ts`

## CI/CD & Deployment

**Hosting:**
- `PANDUAN-DEPLOY.md` documents Vercel for the web app and Supabase for backend services
- No deployment config for another hosting platform detected in repository code

**CI Pipeline:**
- None detected; `.github/workflows/` is absent

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - browser client in `lib/supabaseClient.ts`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - browser client in `lib/supabaseClient.ts`
- `SUPABASE_URL` - Edge Functions in `supabase/functions/_shared/supabase.ts`
- `SUPABASE_ANON_KEY` - Edge Functions in `supabase/functions/_shared/supabase.ts`
- `SUPABASE_SERVICE_ROLE_KEY` - Edge Functions in `supabase/functions/_shared/supabase.ts`

**Secrets location:**
- Browser-safe values are expected in `.env.local`, per `README.md`
- Edge Function secrets are expected in Supabase function environment or `supabase/functions/.env`, referenced by `package.json` `functions:serve`

## Webhooks & Callbacks

**Incoming:**
- Not detected in runtime code

**Outgoing:**
- Not detected in runtime code

## Notable Gaps / Unknowns

- Telegram notification templates and schema exist in `supabase/migrations/0002_tables.sql` and `supabase/migrations/0007_seed_initial_data.sql`, but no Telegram runtime functions are present under `supabase/functions/`
- `features/payments/submissionNotificationPlaceholder.ts` is a no-op placeholder, so review actions do not currently dispatch external notifications
- `public.payment_gateway_transactions` includes `provider default 'midtrans'` in `supabase/migrations/0002_tables.sql`, but no Midtrans integration code is present

---

*Integration audit: 2026-04-29*
