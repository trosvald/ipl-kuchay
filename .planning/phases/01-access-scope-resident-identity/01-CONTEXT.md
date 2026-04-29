# Phase 1: Access, Scope & Resident Identity - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Secure resident and operator access so each user can reach only the data and actions that belong to them, preserve the aggregate-only public privacy boundary, add resident self-profile management and future-ready notification preferences, and ensure resident-to-kavling identity mapping is correct. Billing configuration, payment workflows, announcements/events, Telegram linking, imports, and QRIS remain separate phases.

</domain>

<decisions>
## Implementation Decisions

### Role boundaries
- **D-01:** `/admin` is not one universal admin area. `treasurer` gets finance-only access: billing period operations, payment verification, reporting, and finance-related audit views.
- **D-02:** `treasurer` does not manage residents, kavlings, imports, communication content, or non-finance settings.
- **D-03:** `treasurer` can handle billing period operations, but fee types, fee overrides, and other structural billing configuration stay with `admin`.
- **D-04:** `admin` handles normal day-to-day operations. `super_admin` is mainly reserved for role elevation, first-run bootstrap, and the most sensitive account controls.
- **D-05:** Navigation should hide disallowed sections per role, while direct URL access is still blocked by guards and backend authorization.
- **D-06:** `treasurer` gets a finance-only audit slice covering billing, verification, payment, and report actions. Broader system audit remains for `admin` and `super_admin`.

### Resident profile and preferences
- **D-07:** Resident self-service account management lives on a dedicated resident settings page.
- **D-08:** Residents can edit `display_name`, `phone`, and notification preferences in Phase 1.
- **D-09:** `full_name`, login email, role, and active status are protected identity fields and are not self-editable.
- **D-10:** Protected fields stay visible as read-only with explanation. Login email is shown read-only.
- **D-11:** Notification preferences are stored in Phase 1 even before Telegram linking is built, so later phases can reuse them instead of inventing a new model.
- **D-12:** Notification preferences should be organized by message category, not a single global toggle.

### Kavling identity model
- **D-13:** One resident account may span multiple active kavling links under one login.
- **D-14:** Resident-facing experiences should show all linked kavlings together without forcing a manual kavling switch first.
- **D-15:** Multi-kavling resident-facing data must stay grouped by kavling rather than merged into one combined household total.
- **D-16:** `primary resident` means the main contact and billing anchor for admin workflows, not the only resident allowed to see that kavling's resident-facing data.
- **D-17:** Resident-to-kavling relation values should use a standardized list with a custom option for edge cases.

### Login and onboarding UX
- **D-18:** Password is the primary long-term login method in the UI. Magic link remains available as a secondary path.
- **D-19:** Admin-created resident onboarding should use invite email plus self-serve login guidance.
- **D-20:** A newly invited resident can enter through the magic-link path first, then the app should guide them to establish a password for future sign-ins.
- **D-21:** A resident account with no kavling mapping can still sign in and access a limited portal containing profile/settings plus clear mapping-pending guidance.
- **D-22:** Inactive profiles should see a clear blocked state with explanation and next-step guidance rather than a vague auth failure or redirect loop.

### Resident departure and handoff
- **D-23:** Losing all active kavling mappings does not automatically deactivate the resident profile. Mapping status and profile activation remain separate admin controls.
- **D-24:** Residents with zero active mappings fall back to the limited portal rather than losing all access immediately.
- **D-25:** Former residents keep read-only access only to their own past billing and receipt records. They must never see future or new-occupant activity for that kavling.
- **D-26:** When a new primary resident takes over a kavling, the handoff must be explicit. Do not silently auto-replace the old primary mapping.

### OpenCode's Discretion
- Default opt-in/opt-out values for each notification category, as long as the model is future-ready and category-based.
- Exact copy, visual styling, and support-callout treatment for inactive, unmapped, and read-only field states.
- Exact placement and naming of the treasurer finance-audit entry point, as long as it stays narrower than the full admin audit experience.

</decisions>

<specifics>
## Specific Ideas

- Limited portal states should feel like account-setup or mapping-pending guidance, not like broken authentication.
- Multi-kavling support should remain one account experience, but billing and later resident-facing data must stay clearly separated per kavling.
- Former-resident history access must stop at the resident's own past occupancy window and must not leak new-occupant or future-period data.
- Read-only protected identity fields should stay visible so residents understand what is locked and why.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/PROJECT.md` — product constraints, non-negotiables, rollout priorities, and launch boundaries for privacy, Telegram, and resident self-service.
- `.planning/REQUIREMENTS.md` — authoritative Phase 1 requirements for auth, profile scope, and kavling mapping (`PUBL-01`, `PUBL-02`, `AUTH-01`..`AUTH-05`, `PROF-01`..`PROF-03`, `KAVL-01`, `KAVL-02`).
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and fixed scope boundary.

### Existing access and privacy contracts
- `docs/plan/milestones/M01-supabase-schema.md` — safe public dashboard contract, anon privacy boundary, RLS helper expectations, and protected data rules.
- `docs/plan/milestones/M02-auth-roles.md` — route contract, auth contract, admin invite contract, protected self-profile edit constraints, and super-admin bootstrap requirements.
- `docs/manual-tests/M02-auth-roles.md` — expected role-guard behavior and invite authorization checks.
- `docs/FIRST_SUPER_ADMIN_SETUP.md` — approved first-run super-admin bootstrap without a public self-promotion path.

### Resident identity and kavling mapping contracts
- `docs/plan/milestones/M03-kavlings-residents.md` — kavling fields, resident fields, mapping fields, audit requirements, and one-primary-per-kavling rule.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/auth/AuthProvider.tsx` — existing session/profile context with `signIn`, `signOut`, and `refreshProfile` that Phase 1 profile/settings work should reuse.
- `features/auth/RequireAuth.tsx`, `features/auth/RequireAdminLike.tsx`, `features/auth/RequireSuperAdmin.tsx` — established guard and redirect patterns for resident/admin/super-admin access.
- `features/residents/ResidentListPage.tsx` — current resident admin CRUD surface, including invite flow and super-admin restriction checks.
- `features/residents/KavlingResidentMapping.tsx` — current mapping management UI and existing assumptions about primary resident uniqueness.
- `features/resident/ResidentHomePage.tsx` — current resident-facing linked-kavling view that already assumes one account can see multiple mappings.
- `features/dashboard/PublicDashboardPage.tsx` — current aggregate-only public dashboard surface that already avoids resident-level disclosure.
- `supabase/migrations/0008_auth_profiles.sql` `update_own_profile` — existing safe self-profile update RPC for allowed resident fields.
- `supabase/migrations/0004_rls_helpers.sql` (`is_admin_like`, `is_super_admin`, `can_access_kavling`) — existing authorization helpers that downstream work should extend rather than replace.

### Established Patterns
- Route files in `app/**` stay thin and delegate behavior into `features/**` modules.
- Client components query Supabase directly, but access control is expected to be enforced by RLS/RPCs rather than UI filtering alone.
- Guarded routes redirect and also render explanatory cards, which matches the desired blocked/inactive UX direction.
- Sensitive admin mutations already log through `log_admin_action` patterns; Phase 1 role and mapping refinements should keep that audit approach.

### Integration Points
- Resident settings work should plug into `/app` via `RequireAuth` and `ResidentShell`.
- Role-based nav shaping will need to hook into `features/layout/AdminShell.tsx` in addition to route-level guards.
- Identity and scope changes connect to `public.profiles`, `public.kavling_residents`, `public.telegram_accounts`, and any new preference storage chosen during planning.
- Access-control changes should stay aligned with `supabase/migrations/0005_rls_policies.sql` and should add matching SQL checks under `supabase/tests/sql/` because RLS behavior is fragile.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope.

</deferred>

---

*Phase: 01-access-scope-resident-identity*
*Context gathered: 2026-04-29*
