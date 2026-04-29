# Phase 1 Research — Access, Scope & Resident Identity

**Date:** 2026-04-29
**Phase:** 01-access-scope-resident-identity

## Research Goal

Answer: what must be true to plan Phase 1 well without weakening the existing privacy and Supabase authorization model.

## Current-State Findings

- The app already has working browser auth, route guards, resident/admin shells, resident/kavling CRUD pages, and a public dashboard.
- The main risk is **authorization drift**: current SQL policies still treat `treasurer` as fully admin-like in many places, while Phase 1 decisions require finance-only scope.
- Resident self-service currently supports only `display_name` and `phone` updates via `public.update_own_profile(...)`; notification preferences do not yet exist in a reusable form.
- `kavling_residents` currently stores only `relation`, `is_primary`, and `active`, which is not enough to model explicit handoff history or former-resident billing access windows.
- Public dashboard already uses `get_public_period_summary`, but Phase 1 still needs a plan-level check that the public surface stays aggregate-only and active-period-scoped.

## Relevant Source Contracts

- `features/auth/AuthProvider.tsx` already uses `getSession()` and `onAuthStateChange(...)`, which matches Supabase JS v2 guidance for session persistence and session refresh handling.
- `supabase/migrations/0004_rls_helpers.sql` and `0005_rls_policies.sql` already centralize access control in SQL; this should be extended, not replaced with UI-only checks.
- `features/resident/ResidentHomePage.tsx` and `features/billing/ResidentInvoicesPage.tsx` already assume one account can see multiple kavlings, which aligns with D-13 through D-15.
- `features/residents/KavlingResidentMapping.tsx` already enforces one active primary mapping through DB constraints, but it does not yet provide explicit handoff controls or standardized relation values.

## External Documentation Notes

### Supabase JS auth session handling

Context7 confirms the existing preferred primitives remain:

- `supabase.auth.signInWithPassword(...)` for password-first login
- `supabase.auth.signInWithOtp(...)` for magic-link onboarding fallback
- `supabase.auth.getSession()` for bootstrap
- `supabase.auth.onAuthStateChange(...)` for session updates

Implication: Phase 1 should keep the current auth transport and improve state modeling around active / inactive / unmapped / limited access instead of introducing a new auth stack.

### Supabase RLS patterns

Context7 guidance reinforces that row access should stay enforced in SQL using `auth.uid()`-based predicates and helper functions. This matches the current architecture and supports Phase 1's privacy boundary.

Implication: treasurer/admin/super-admin separation and former-resident history access should be implemented with helper functions + policies, not only hidden nav links.

## Recommended Technical Direction

### 1. Split "admin-like" into narrower SQL capabilities

Keep `public.is_admin_like()` for legacy compatibility only where needed, but introduce narrower helpers in a new migration:

- `public.has_finance_role()` → `treasurer | admin | super_admin`
- `public.has_operator_role()` → `admin | super_admin`
- `public.can_view_finance_audit_log(action_name, entity_table)` → treasurer-safe audit slice
- `public.can_access_invoice_history(target_invoice_id)` → active mapping OR ended mapping whose access window still covers the invoice due date

Why: D-01 through D-06 require treasurer to reach billing/payment/reporting flows but not resident/kavling/settings/import management.

### 2. Add future-ready notification preferences now

Recommended model:

- New table `public.notification_preferences`
- Columns: `id`, `profile_id`, `category`, `in_app_enabled`, `telegram_enabled`, `created_at`, `updated_at`
- Seed categories in-app via code or insert-on-read/write path: `billing_reminders`, `payment_status`, `announcements`, `events`
- Unique key: `(profile_id, category)`

Why: D-11 and D-12 require category-based storage that later Telegram work can reuse without redesign.

### 3. Normalize kavling relationships without losing edge-case flexibility

Recommended model:

- Add `relation_type` with a standardized list (`owner`, `spouse`, `child`, `parent`, `tenant`, `family_other`, `staff`, `other`)
- Keep `relation_label` nullable for custom detail when `relation_type = 'other'`
- Add `started_at` / `ended_at` to `public.kavling_residents`

Why: D-17 requires a standard list with custom option; D-23 through D-26 require explicit history and non-silent handoff.

### 4. Preserve former-resident billing visibility through mapping history, not active access

Recommended rule:

- Active resident portal data (home, current kavling list, later announcements/events) uses `kr.active = true`
- Historical invoice/receipt visibility uses a helper that allows rows only when invoice due date falls within the resident's mapping window

Why: D-25 requires former residents to keep read-only access to their own past records while never seeing future/new-occupant data.

### 5. Model resident access state explicitly in frontend auth helpers

Frontend should derive a single access-state contract from auth/profile/mapping data:

- `active-mapped`
- `active-unmapped`
- `inactive`
- `missing-profile`

Why: D-21 and D-22 require a limited portal for unmapped users and a clear blocked state for inactive users.

## Planning Implications

### Files likely to change

- New migration: `supabase/migrations/0012_m07_access_scope_identity.sql`
- New SQL test: `supabase/tests/sql/m07_phase1_access_identity.sql`
- Auth/frontend: `features/auth/*`, `features/layout/AdminShell.tsx`, `features/layout/ResidentShell.tsx`
- Resident portal: `features/resident/ResidentHomePage.tsx`, `features/billing/ResidentInvoicesPage.tsx`, `features/billing/InvoiceDetailPage.tsx`
- New settings surface: `app/app/settings/page.tsx`, `features/resident/ResidentSettingsPage.tsx`
- Admin ops: `features/residents/*`, `features/kavlings/*`, `features/audit/AuditLogPage.tsx`

### No new external libraries needed

The current Next.js + React + Supabase + zod + Vitest stack is sufficient.

### High-risk areas to plan explicitly

- RLS regressions after narrowing treasurer scope
- Mapping history logic for former residents
- Shared file collisions in `lib/validation.ts`, `ResidentShell.tsx`, and auth hooks
- Admin shell/nav mismatch with backend authorization

## Common Pitfalls To Avoid

- Do **not** rely on hidden navigation alone for role restrictions.
- Do **not** overwrite old primary mappings silently when ownership changes (D-26).
- Do **not** store a single global notifications toggle when the decision is category-based (D-12).
- Do **not** collapse multi-kavling resident data into one household total in resident views (D-14, D-15).
- Do **not** grant former residents access using `active = true` shortcuts; use an invoice-history-specific rule.

## Validation Architecture

- Fast loop: `npm run test:unit`
- Full loop: `npm run test`
- DB safety checks: phase-specific SQL test plus existing `npm run test:sql`
- Build gate: `npm run typecheck && npm run build`
- Every plan should include an automated verification command; DB-changing work must include a blocking schema push before verification.

## Recommended Plan Shape

1. **Database access model first** — helper functions, policies, mapping history, notification preference storage, SQL tests.
2. **Auth/guard plumbing second** — login, session state, inactive/unmapped handling.
3. **Resident/public surfaces next** — public privacy boundary, resident portal scope, settings.
4. **Admin role shaping last** — navigation, finance audit slice, resident/kavling management workflows.

## Research Conclusion

Phase 1 is best executed as one schema/RLS foundation plan followed by multiple UI/application plans that consume that contract. The critical success factor is keeping the trust boundary in Supabase policies and helper functions while the UI mirrors — but does not replace — those checks.
