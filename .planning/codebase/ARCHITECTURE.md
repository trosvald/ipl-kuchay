# Architecture

**Analysis Date:** 2026-04-29

## Pattern Overview

**Overall:** App Router frontend over a Supabase backend with browser-driven data access and a small set of privileged Edge Functions.

**Key Characteristics:**
- Route files in `app/` are thin entry points that delegate to feature modules in `features/`
- Most reads and many writes happen directly from client components through `@supabase/supabase-js` in `lib/supabaseClient.ts`
- Authorization is enforced primarily by Supabase Auth, RLS policies, and security-definer SQL functions in `supabase/migrations/*.sql`

## Layers

**Routing layer:**
- Purpose: Define URL structure and page/layout entry points
- Location: `app/`
- Contains: `page.tsx`, `layout.tsx`, `not-found.tsx`, `providers.tsx`
- Depends on: `features/**`, `lib/constants.ts`, `app/globals.css`
- Used by: Next.js runtime

**Feature UI layer:**
- Purpose: Implement page logic, forms, tables, and user actions
- Location: `features/`
- Contains: portal pages, admin screens, auth guards, shells, payment review flows
- Depends on: `components/ui/**`, `lib/**`, and Supabase browser client
- Used by: route files in `app/**/page.tsx` and `app/**/layout.tsx`

**Shared UI primitives:**
- Purpose: Reusable presentational components
- Location: `components/ui/`
- Contains: `button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `table.tsx`, `separator.tsx`
- Depends on: `@radix-ui/react-slot`, `class-variance-authority`, `lib/utils.ts`
- Used by: nearly all feature modules in `features/**`

**Client utility layer:**
- Purpose: Shared validation, formatting, date helpers, storage path logic, and Supabase client creation
- Location: `lib/`
- Contains: `validation.ts`, `format.ts`, `date.ts`, `storage.ts`, `supabaseClient.ts`, `utils.ts`
- Depends on: `zod`, `date-fns`, `@supabase/supabase-js`
- Used by: `features/**`, unit tests in `lib/__tests__/**`

**Database / policy layer:**
- Purpose: Define schema, data rules, access control, and server-side business functions
- Location: `supabase/migrations/`
- Contains: tables, enums, indexes, storage bucket policies, RLS helpers, RPCs
- Depends on: Supabase Postgres and storage
- Used by: browser queries, RPC calls, and Edge Functions

**Edge Function layer:**
- Purpose: Handle privileged flows that need service role access or signed URLs
- Location: `supabase/functions/`
- Contains: `admin-invite-user`, `create-payment-submission`, `attach-payment-proof`, `cancel-payment-submission`, `get-proof-signed-url`
- Depends on: shared auth helpers in `supabase/functions/_shared/*`
- Used by: browser calls from `features/residents/ResidentListPage.tsx`, `features/payments/PaymentSubmissionForm.tsx`, and `features/payments/ProofPreviewButton.tsx`

## Data Flow

**Authenticated page boot:**
1. `app/providers.tsx` wraps the app with `features/auth/AuthProvider.tsx`
2. `AuthProvider` creates the browser client via `lib/supabaseClient.ts`, reads session, and loads the current row from `profiles`
3. Layout guards such as `features/auth/RequireAuth.tsx` and `features/auth/RequireAdminLike.tsx` either render the shell or redirect

**Manual payment submission:**
1. `features/billing/InvoiceDetailPage.tsx` renders `features/payments/PaymentSubmissionForm.tsx`
2. The form validates input with `lib/validation.ts` and file metadata with `lib/storage.ts`
3. The browser invokes Edge Function `create-payment-submission`, uploads to Storage bucket `payment-proofs`, then invokes `attach-payment-proof`
4. SQL function `public.recalculate_invoice_status` updates invoice status after submission changes

**Admin review:**
1. `features/payments/AdminSubmissionsPage.tsx` loads `payment_submissions` and related invoice/profile data
2. Admin actions call RPCs `verify_payment_submission` or `reject_payment_submission`
3. SQL functions in `supabase/migrations/0011_m06_verification_audit.sql` update submission state, create payments or rejection metadata, recalculate invoice status, and append audit logs

**State Management:**
- Local component state via React hooks is the dominant pattern in `features/**/*.tsx`
- Shared auth state lives in React context from `features/auth/AuthProvider.tsx`
- No global client state library detected

## Key Abstractions

**Auth context:**
- Purpose: expose session, profile, role, and auth actions
- Examples: `features/auth/AuthProvider.tsx`, `features/auth/authHooks.ts`
- Pattern: React context plus small hooks (`useAuth`, `useIsAdminLike`, `useIsSuperAdmin`)

**Feature page modules:**
- Purpose: hold real page behavior outside route files
- Examples: `features/dashboard/PublicDashboardPage.tsx`, `features/billing/BillingPeriodsPage.tsx`, `features/residents/ResidentListPage.tsx`
- Pattern: exported React component per page, imported by a route stub

**Database RPC business logic:**
- Purpose: centralize privileged or multi-step data rules inside Postgres
- Examples: `supabase/migrations/0004_rls_helpers.sql`, `supabase/migrations/0009_m03_audit_log_rpc.sql`, `supabase/migrations/0011_m06_verification_audit.sql`
- Pattern: `security definer` SQL / PLpgSQL functions invoked from browser or Edge Functions

## Entry Points

**Root app layout:**
- Location: `app/layout.tsx`
- Triggers: all routes
- Responsibilities: global metadata, font setup, CSS, provider injection

**Public dashboard:**
- Location: `app/page.tsx`
- Triggers: `/`
- Responsibilities: render `features/dashboard/PublicDashboardPage.tsx`

**Resident portal:**
- Location: `app/app/layout.tsx` and `app/app/page.tsx`
- Triggers: `/app` routes
- Responsibilities: auth guard, resident shell, resident home and invoices views

**Admin portal:**
- Location: `app/admin/layout.tsx` and `app/admin/**/*.tsx`
- Triggers: `/admin` routes
- Responsibilities: admin-like guard, admin shell, management pages for residents, kavlings, billing, submissions, audit, and settings

**Privileged backend endpoints:**
- Location: `supabase/functions/*/index.ts`
- Triggers: `client.functions.invoke(...)` from browser code
- Responsibilities: admin invite, submission creation/cleanup, proof attachment, signed proof URLs

## Error Handling

**Strategy:** optimistic client-side flows with inline error message state, plus server-side guard clauses that return typed JSON errors.

**Patterns:**
- Feature pages keep `errorMessage` state and render alert cards, for example `features/billing/ResidentInvoicesPage.tsx` and `features/billing/BillingPeriodsPage.tsx`
- Edge Functions throw `HttpError` and serialize errors through `jsonResponse` from `supabase/functions/_shared/responses.ts`
- Browser auth bootstrap swallows failures into loading fallback in `features/auth/AuthProvider.tsx`

## Cross-Cutting Concerns

**Logging:** Audit trail stored in `public.audit_logs` via `features/audit/writeAuditLog.ts`, `supabase/migrations/0009_m03_audit_log_rpc.sql`, and direct inserts in privileged flows.

**Validation:** Client-side input validation uses `zod` in `lib/validation.ts`; backend validation in Edge Functions is implemented with manual parsing and guard functions.

**Authentication:** Session and profile loading happen in `features/auth/AuthProvider.tsx`; data authorization depends on RLS and helper functions in `supabase/migrations/0004_rls_helpers.sql` and `supabase/migrations/0005_rls_policies.sql`.

---

*Architecture analysis: 2026-04-29*
