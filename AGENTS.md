## Project

**IPL Jatiloka Residence**

IPL Jatiloka Residence is a neighborhood operations app for managing resident billing, payment confirmation, collection tracking, and neighborhood communication in one place. It serves residents, treasurers, admins, and super admins with a secure web app backed by Supabase, while keeping public access limited to aggregate collection visibility only. The product is intended to replace spreadsheet-driven operations with a resident self-service experience that also includes announcements and event coordination.

**Core Value:** Residents can reliably check what they owe, submit payment, track status, and receive neighborhood updates without confusion or manual admin follow-up.

### Constraints

- **Stack**: Keep the existing Next.js + TypeScript + Supabase direction — it already reflects current implementation reality
- **Security**: Proof files must remain private, privileged access must rely on Auth/RLS/RPCs/Edge Functions, and browser code must not hold secrets
- **Messaging**: Telegram is the supported messaging channel; WhatsApp is excluded
- **Public Access**: Launch public experience is aggregate-only, not per-kavling status
- **Payments**: Manual transfer must fully support launch; QRIS is not required for initial go-live
- **Delivery Quality**: Use pragmatic TDD project-wide, with stricter test-first practice for critical and security-sensitive flows
- **Rollout**: Target is a real full rollout for neighborhood use, not just an internal prototype or pilot
- **UX Language**: User-facing copy should fit the neighborhood context and use Indonesian where appropriate

## Technology Stack

## Languages
- TypeScript - application code in `app/**/*.tsx`, `features/**/*.tsx`, `lib/**/*.ts`, and `supabase/functions/**/*.ts`
- SQL (PostgreSQL / Supabase) - schema, RLS, RPCs, and seed data in `supabase/migrations/*.sql` and `supabase/tests/sql/*.sql`
- CSS - global styling and theme tokens in `app/globals.css`
- TOML - local Supabase configuration in `supabase/config.toml`
## Runtime
- Node.js runtime for the Next.js app (version not pinned; no `.nvmrc` or `.node-version` detected)
- Deno-compatible runtime for Supabase Edge Functions in `supabase/functions/*/index.ts`
- npm - scripts and dependency management in `package.json`
- Lockfile: present in `package-lock.json`
## Frameworks
- Next.js `^16.2.4` - App Router UI and routing from `app/`
- React `^19.2.5` - client components across `features/**/*.tsx`
- Supabase JS `^2.105.1` - browser client in `lib/supabaseClient.ts`
- Vitest `^4.0.2` - unit tests in `lib/__tests__/*.test.ts`
- Supabase CLI SQL checks - database acceptance tests via `package.json` `test:sql`
- TypeScript `^6.0.3` - strict typing in `tsconfig.json`
- Tailwind CSS `^4.2.4` - utility styling from `app/globals.css`
- PostCSS with `@tailwindcss/postcss` - config in `postcss.config.mjs`
- ESLint `^9.39.1` with `eslint-config-next` - lint dependency present in `package.json`
## Key Dependencies
- `@supabase/supabase-js` `^2.105.1` - auth, database, RPC, storage, and Edge Function invocation across `features/**` and `lib/supabaseClient.ts`
- `zod` `^4.3.6` - form and payload validation in `lib/validation.ts`
- `date-fns` `^4.1.0` - Indonesian date formatting in `lib/date.ts` and `lib/format.ts`
- `@radix-ui/react-slot` `^1.2.4` - polymorphic UI primitives in `components/ui/button.tsx`
- `class-variance-authority` `^0.7.1` - component variants in `components/ui/button.tsx`
- `clsx` `^2.1.1` and `tailwind-merge` `^3.5.0` - class composition in `lib/utils.ts`
- `lucide-react` `^1.12.0` - icon set across `features/**/*.tsx`
## Configuration
- Browser app requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, read in `lib/supabaseClient.ts`
- Supabase Edge Functions require server-side secrets such as `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`, read in `supabase/functions/_shared/supabase.ts`
- `.env.local` and `.env.example` are present but not read
- `tsconfig.json` sets `strict: true`, `baseUrl: "."`, and `@/*` aliasing
- `next.config.ts` enables `reactStrictMode` and sets `allowedDevOrigins`
- `vitest.config.ts` aliases `@` to repo root and limits tests to `lib/__tests__/**/*.test.ts`
- `postcss.config.mjs` enables Tailwind CSS PostCSS plugin
## Platform Requirements
- Next.js app served with `npm run dev`
- Supabase local stack expected for database work via `npm run supabase:start` and `npm run supabase:reset`
- Supabase CLI required for SQL tests and local functions, referenced in `package.json`
- Hosting target for the web app is not declared in code, but `PANDUAN-DEPLOY.md` documents Vercel for the frontend and Supabase for backend services
- External dependencies assume hosted Supabase project for auth, Postgres, storage, and Edge Functions

## Conventions

## Naming Patterns
- Use PascalCase for React feature/component files such as `features/billing/BillingPeriodsPage.tsx` and `features/residents/ResidentForm.tsx`
- Use lowercase or lower camelCase for utility modules such as `lib/supabaseClient.ts`, `lib/validation.ts`, and `features/audit/writeAuditLog.ts`
- Use Next.js reserved route file names in `app/`: `page.tsx`, `layout.tsx`, `not-found.tsx`
- Use camelCase for helpers and event handlers such as `loadPeriods`, `handleCreate`, `formatRupiah`, and `getSupabaseBrowserClient`
- Prefix event callbacks with `handle` in form-heavy components like `features/billing/BillingPeriodsPage.tsx` and `features/payments/PaymentSubmissionForm.tsx`
- Use descriptive camelCase names such as `errorMessage`, `pendingByInvoice`, `outstandingAmount`, and `canManageSuperAdmin`
- Use ALL_CAPS only for constants, for example `APP_NAME` in `lib/constants.ts` and `PAYMENT_PROOF_MAX_SIZE_BYTES` in `lib/storage.ts`
- Use PascalCase for interfaces and exported types such as `Profile`, `BillingPeriodRow`, `AuditLogInput`, and `PaymentProofMimeType`
- Use union literals for domain enums in TS when mirroring SQL roles/statuses, for example `AppRole` in `features/auth/AuthProvider.tsx`
## Code Style
- Formatter config file is not detected
- Source formatting is consistent with 2-space indentation, semicolons, trailing commas, and double quotes, as seen in `features/auth/AuthProvider.tsx` and `lib/validation.ts`
- ESLint is installed through `eslint` and `eslint-config-next` in `package.json`
- No custom ESLint config file is present; rely on Next.js defaults unless a config is added
## Import Organization
- Use `@/*` for repo-root imports, configured in `tsconfig.json`
## Error Handling
- Keep request failures in component state via `const [errorMessage, setErrorMessage] = useState<string | null>(null)` and render inline alerts, as in `features/billing/ResidentInvoicesPage.tsx`
- Return early on missing client/session/profile conditions, as in `features/payments/PaymentSubmissionForm.tsx` and `features/residents/ResidentListPage.tsx`
- In Edge Functions, parse input manually and throw `HttpError`, then map that to JSON in the outer `serve` handler, as in `supabase/functions/create-payment-submission/index.ts`
## Logging
- Use `writeAuditLog` or direct audit inserts for admin-side mutations, for example `features/audit/writeAuditLog.ts` and `supabase/migrations/0011_m06_verification_audit.sql`
- Use `console.warn` only for non-fatal local configuration issues, as in `lib/supabaseClient.ts`
## Comments
- Comments are sparse in app code
- Use comments mainly for environment/runtime quirks, such as the Deno import note in `supabase/functions/*/index.ts`
## Function Design
- Simple shared helpers stay small in `lib/*.ts`
- Page components are allowed to be large and contain load/mutate/render logic together, such as `features/billing/BillingPeriodsPage.tsx` and `features/payments/AdminSubmissionsPage.tsx`
- Prefer typed object parameters for multi-field helpers, for example `buildPaymentProofPath(input)` in `lib/storage.ts` and `writeAuditLog(payload)` in `features/audit/writeAuditLog.ts`
- Prefer typed event parameters for form handlers, for example `FormEvent<HTMLFormElement>`
- Helpers usually return explicit primitives or nullable values, such as `string | null` and `Date | null`
- Guard-style functions return early instead of nesting deeply
## Module Design
- Prefer named exports across the codebase, for example `export function BillingPeriodsPage()` and `export const billingPeriodFormSchema = ...`
- Default exports are mostly reserved for Next.js route/layout files in `app/`
## Prescriptive Patterns to Match
- Put route logic in `features/**` and keep `app/**/page.tsx` thin
- Reuse `@/*` imports instead of long relative paths
- Validate form payloads with `zod` schemas from `lib/validation.ts`
- Keep admin mutations auditable through `features/audit/writeAuditLog.ts` or the SQL audit functions

## Architecture

## Pattern Overview
- Route files in `app/` are thin entry points that delegate to feature modules in `features/`
- Most reads and many writes happen directly from client components through `@supabase/supabase-js` in `lib/supabaseClient.ts`
- Authorization is enforced primarily by Supabase Auth, RLS policies, and security-definer SQL functions in `supabase/migrations/*.sql`
## Layers
- Purpose: Define URL structure and page/layout entry points
- Location: `app/`
- Contains: `page.tsx`, `layout.tsx`, `not-found.tsx`, `providers.tsx`
- Depends on: `features/**`, `lib/constants.ts`, `app/globals.css`
- Used by: Next.js runtime
- Purpose: Implement page logic, forms, tables, and user actions
- Location: `features/`
- Contains: portal pages, admin screens, auth guards, shells, payment review flows
- Depends on: `components/ui/**`, `lib/**`, and Supabase browser client
- Used by: route files in `app/**/page.tsx` and `app/**/layout.tsx`
- Purpose: Reusable presentational components
- Location: `components/ui/`
- Contains: `button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `table.tsx`, `separator.tsx`
- Depends on: `@radix-ui/react-slot`, `class-variance-authority`, `lib/utils.ts`
- Used by: nearly all feature modules in `features/**`
- Purpose: Shared validation, formatting, date helpers, storage path logic, and Supabase client creation
- Location: `lib/`
- Contains: `validation.ts`, `format.ts`, `date.ts`, `storage.ts`, `supabaseClient.ts`, `utils.ts`
- Depends on: `zod`, `date-fns`, `@supabase/supabase-js`
- Used by: `features/**`, unit tests in `lib/__tests__/**`
- Purpose: Define schema, data rules, access control, and server-side business functions
- Location: `supabase/migrations/`
- Contains: tables, enums, indexes, storage bucket policies, RLS helpers, RPCs
- Depends on: Supabase Postgres and storage
- Used by: browser queries, RPC calls, and Edge Functions
- Purpose: Handle privileged flows that need service role access or signed URLs
- Location: `supabase/functions/`
- Contains: `admin-invite-user`, `create-payment-submission`, `attach-payment-proof`, `cancel-payment-submission`, `get-proof-signed-url`
- Depends on: shared auth helpers in `supabase/functions/_shared/*`
- Used by: browser calls from `features/residents/ResidentListPage.tsx`, `features/payments/PaymentSubmissionForm.tsx`, and `features/payments/ProofPreviewButton.tsx`
## Data Flow
- Local component state via React hooks is the dominant pattern in `features/**/*.tsx`
- Shared auth state lives in React context from `features/auth/AuthProvider.tsx`
- No global client state library detected
## Key Abstractions
- Purpose: expose session, profile, role, and auth actions
- Examples: `features/auth/AuthProvider.tsx`, `features/auth/authHooks.ts`
- Pattern: React context plus small hooks (`useAuth`, `useIsAdminLike`, `useIsSuperAdmin`)
- Purpose: hold real page behavior outside route files
- Examples: `features/dashboard/PublicDashboardPage.tsx`, `features/billing/BillingPeriodsPage.tsx`, `features/residents/ResidentListPage.tsx`
- Pattern: exported React component per page, imported by a route stub
- Purpose: centralize privileged or multi-step data rules inside Postgres
- Examples: `supabase/migrations/0004_rls_helpers.sql`, `supabase/migrations/0009_m03_audit_log_rpc.sql`, `supabase/migrations/0011_m06_verification_audit.sql`
- Pattern: `security definer` SQL / PLpgSQL functions invoked from browser or Edge Functions
## Entry Points
- Location: `app/layout.tsx`
- Triggers: all routes
- Responsibilities: global metadata, font setup, CSS, provider injection
- Location: `app/page.tsx`
- Triggers: `/`
- Responsibilities: render `features/dashboard/PublicDashboardPage.tsx`
- Location: `app/app/layout.tsx` and `app/app/page.tsx`
- Triggers: `/app` routes
- Responsibilities: auth guard, resident shell, resident home and invoices views
- Location: `app/admin/layout.tsx` and `app/admin/**/*.tsx`
- Triggers: `/admin` routes
- Responsibilities: admin-like guard, admin shell, management pages for residents, kavlings, billing, submissions, audit, and settings
- Location: `supabase/functions/*/index.ts`
- Triggers: `client.functions.invoke(...)` from browser code
- Responsibilities: admin invite, submission creation/cleanup, proof attachment, signed proof URLs
## Error Handling
- Feature pages keep `errorMessage` state and render alert cards, for example `features/billing/ResidentInvoicesPage.tsx` and `features/billing/BillingPeriodsPage.tsx`
- Edge Functions throw `HttpError` and serialize errors through `jsonResponse` from `supabase/functions/_shared/responses.ts`
- Browser auth bootstrap swallows failures into loading fallback in `features/auth/AuthProvider.tsx`
## Cross-Cutting Concerns
