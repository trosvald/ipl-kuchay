# Codebase Concerns

**Analysis Date:** 2026-04-29

## Tech Debt

**Client-heavy data access:**
- Issue: most page modules fetch and mutate data directly from client components instead of going through a thinner server boundary
- Files: `features/billing/BillingPeriodsPage.tsx`, `features/residents/ResidentListPage.tsx`, `features/kavlings/KavlingListPage.tsx`, `features/payments/AdminSubmissionsPage.tsx`
- Impact: duplicated fetch/error/loading patterns, large components, and tighter coupling between UI and Supabase schema
- Fix approach: extract repeated query/mutation flows into shared hooks or server-facing modules while keeping RLS-backed authorization intact

**Duplicated audit helper logic:**
- Issue: audit RPC calls are implemented centrally in `features/audit/writeAuditLog.ts` but also duplicated inline in resident and kavling modules
- Files: `features/audit/writeAuditLog.ts`, `features/residents/ResidentListPage.tsx`, `features/kavlings/KavlingListPage.tsx`
- Impact: changes to audit payload shape can drift across modules
- Fix approach: route all client-side audit writes through the shared helper and keep the payload contract in one place

## Known Bugs / Functional Gaps

**Submission review notifications are stubbed:**
- Symptoms: approving or rejecting a payment submission does not send any external notification
- Files: `features/payments/AdminSubmissionsPage.tsx`, `features/payments/submissionNotificationPlaceholder.ts`
- Trigger: admin completes review flow
- Workaround: none in code; only audit/state changes occur

**Deployment guide is stale relative to current app:**
- Symptoms: `PANDUAN-DEPLOY.md` references Vite files, public storage, and a legacy prototype flow that do not match current Next.js + Supabase Auth architecture
- Files: `PANDUAN-DEPLOY.md`, `package.json`, `app/`, `supabase/`
- Trigger: initializing or deploying from the written guide
- Workaround: use current config and scripts from `README.md`, `package.json`, and `supabase/config.toml` instead of the old guide

## Security Considerations

**CORS is fully open on Edge Functions:**
- Risk: every Edge Function response helper uses `Access-Control-Allow-Origin: *`
- Files: `supabase/functions/_shared/responses.ts`
- Current mitigation: privileged operations still require authenticated JWTs and/or service-role-verified server logic
- Recommendations: restrict allowed origins if the app is deployed to a known domain set

**Frontend depends on browser env presence:**
- Risk: missing `NEXT_PUBLIC_SUPABASE_*` values degrade auth and data features at runtime
- Files: `lib/supabaseClient.ts`, `README.md`
- Current mitigation: one-time `console.warn` and null-client guards
- Recommendations: add startup validation or deployment checks so broken env configuration fails earlier

## Performance Bottlenecks

**Large client components with repeated full reloads:**
- Problem: many admin pages re-fetch full tables after each mutation and keep pagination/filtering entirely in client state
- Files: `features/billing/BillingPeriodsPage.tsx`, `features/residents/ResidentListPage.tsx`, `features/kavlings/KavlingListPage.tsx`, `features/payments/AdminSubmissionsPage.tsx`
- Cause: each page owns fetch, filter, mutation, and render logic in one component
- Improvement path: move filtering/pagination server-side or split data loaders from rendering and mutation flows

## Fragile Areas

**Manual payment submission multi-step workflow:**
- Files: `features/payments/PaymentSubmissionForm.tsx`, `supabase/functions/create-payment-submission/index.ts`, `supabase/functions/attach-payment-proof/index.ts`, `supabase/functions/cancel-payment-submission/index.ts`, `supabase/migrations/0011_m06_verification_audit.sql`
- Why fragile: success depends on creating a submission row, uploading a file, attaching proof metadata, and rollback on failure across multiple services
- Safe modification: preserve the current order of create → upload → attach → recalc, and keep cancellation behavior aligned with submission status rules
- Test coverage: no direct automated tests for this end-to-end path

**RLS and security-definer RPC rules:**
- Files: `supabase/migrations/0004_rls_helpers.sql`, `supabase/migrations/0005_rls_policies.sql`, `supabase/migrations/0009_m03_audit_log_rpc.sql`, `supabase/migrations/0011_m06_verification_audit.sql`
- Why fragile: small policy or helper changes can silently widen or block access across resident and admin flows
- Safe modification: update SQL with matching SQL tests in `supabase/tests/sql/`
- Test coverage: only a small set of SQL checks is present

## Scaling Limits

**Frontend table rendering:**
- Current capacity: pages assume small-to-moderate datasets and slice arrays in memory after loading full result sets
- Limit: resident, kavling, billing, and submission pages can grow expensive as rows increase
- Scaling path: push pagination, search, and aggregation into SQL queries or RPCs

## Dependencies at Risk

**Default lint configuration only:**
- Risk: ESLint dependencies are installed, but no explicit config file pins project-specific rules
- Impact: lint behavior can change with framework defaults and may not catch repository-specific patterns
- Migration plan: add an explicit ESLint config when the team wants stable rule enforcement

## Missing Critical Features

**Runtime Telegram integration:**
- Problem: Telegram tables and notification templates exist, but no Telegram Edge Functions or app UI route are present
- Blocks: notification delivery and account-linking flows implied by schema and placeholders

**Automated CI pipeline:**
- Problem: `.github/workflows/` is absent
- Blocks: automatic validation of `npm run test`, SQL checks, linting, and type safety before merge/deploy

## Test Coverage Gaps

**Feature and Edge Function coverage:**
- What's not tested: React page behavior, auth guards, admin flows, payment review, Edge Functions, and upload orchestration
- Files: `features/**/*.tsx`, `supabase/functions/**/*.ts`
- Risk: regressions in real user workflows can ship without automated detection
- Priority: High

**Policy and RPC regression depth:**
- What's not tested: most RLS policy combinations and many SQL functions beyond the few included CLI scripts
- Files: `supabase/migrations/*.sql`, `supabase/tests/sql/*.sql`
- Risk: access-control or billing logic changes can break data visibility or invoice state transitions silently
- Priority: High

---

*Concerns audit: 2026-04-29*
