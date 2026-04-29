---
phase: 01
slug: access-scope-resident-identity
status: verified
threats_open: 0
asvs_level: 2
created: 2026-04-29
---

# Phase 01 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| admin browser -> resident/kavling mutation paths | Sensitive mapping and role data is changed through the UI and sent to Supabase APIs. | Role assignments, resident identity fields, kavling mapping state |
| mapping UI -> historical access contract | Handoff/deactivation choices affect later bounded access for former residents. | Mapping lifecycle fields (`active`, `started_at`, `ended_at`, `is_primary`) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-06-01 | T | Mapping handoff workflow | mitigate | Explicit anti-overwrite guard blocks assigning a new active primary when another primary exists and requires explicit handoff/deactivation. Evidence: `features/residents/KavlingResidentMapping.tsx:194`, `features/residents/KavlingResidentMapping.tsx:258`. | closed |
| T-06-02 | E | Admin mutation screens | mitigate | Defense in depth: admin route guard and super-admin role assignment checks in UI, plus backend policies that restrict mutation to operator roles (`admin`/`super_admin`) and exclude treasurer. Evidence: `app/admin/layout.tsx:6`, `features/auth/RequireAdminLike.tsx:12`, `features/residents/ResidentForm.tsx:46`, `features/residents/ResidentListPage.tsx:156`, `supabase/migrations/0012_m07_access_scope_identity.sql:167`. | closed |
| T-06-03 | I | Mapping history state | mitigate | Deactivation preserves ended mappings instead of deletion and downstream policy checks use mapping validity windows for bounded former-resident access. Evidence: `features/residents/KavlingResidentMapping.tsx:258`, `features/residents/ResidentListPage.tsx:127`, `supabase/migrations/0012_m07_access_scope_identity.sql:145`. | closed |

*Status: open - closed*
*Disposition: mitigate (implementation required) - accept (documented risk) - transfer (third-party)*

---

## Threat Flags

No `## Threat Flags` section found in `.planning/phases/01-access-scope-resident-identity/01-06-SUMMARY.md`.

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-29 | 3 | 3 | 0 | gsd-security-auditor + OpenCode |

---

## Security Audit 2026-04-29

| Metric | Count |
|--------|-------|
| Threats found | 3 |
| Closed | 3 |
| Open | 0 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-29
