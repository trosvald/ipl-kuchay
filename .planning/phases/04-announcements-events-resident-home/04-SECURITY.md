---
phase: 04
slug: announcements-events-resident-home
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-30
---

# Phase 04 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser resident -> Supabase tables/storage | Resident requests and RSVP writes are untrusted and must stay scoped to resident-visible content plus self-owned rows. | Announcement/event reads, attachment reads, RSVP writes |
| Browser admin/super_admin -> Supabase tables/storage | Content lifecycle changes and attachment uploads originate from browser clients and still require policy-enforced boundaries. | Announcement/event writes, attachment uploads/deletes |
| Shared `/admin` shell/navigation -> communication routes | Finance-role users must not inherit operator communication access from broader admin affordances. | Route access, privileged UI actions |
| Planning artifacts -> verification evidence | Security verification depends on artifact references matching the implemented migration and schema contract. | Threat-model traceability, audit evidence |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-04-01 | E | announcement/event write path | mitigate | `supabase/migrations/0019_m08_announcements_events.sql:134-139,175-179` restricts content writes to `public.has_operator_role()`. | closed |
| T-04-02 | I | resident announcement/event reads | mitigate | `supabase/migrations/0019_m08_announcements_events.sql:124-132,170-173` limits resident reads to published/archived announcements and scheduled/cancelled events. | closed |
| T-04-03 | T | RSVP mutation path | mitigate | `supabase/migrations/0019_m08_announcements_events.sql:192-215` enforces self-row writes and event-start cutoff. | closed |
| T-04-04 | I | announcement attachments | mitigate | Private bucket plus resident-scoped storage access in `supabase/migrations/0019_m08_announcements_events.sql:221-274`; signed URL access in `features/announcements/ResidentAnnouncementDetailPage.tsx:94-110`. | closed |
| T-04-05 | T | admin announcement/event payloads | mitigate | Strict Zod contracts exist in `lib/validation.ts:272-324` and are used by admin page save flows in `features/announcements/AdminAnnouncementsPage.tsx:207-240` and `features/events/AdminEventsPage.tsx:204-240`. | closed |
| T-04-06 | E | admin communication route exposure | mitigate | Navigation is role-sealed in `features/layout/adminNavigation.ts:71-75`; route wrappers enforce operator-only access in `app/admin/announcements/page.tsx:1-10`, `app/admin/events/page.tsx:1-10`, and `features/auth/RequireOperatorRole.tsx:44-52`. | closed |
| T-04-07 | R | lifecycle changes | mitigate | Event lifecycle updates now inherit timestamp enforcement via `supabase/migrations/0020_m08_events_updated_at_trigger.sql:3-5`; trigger existence is covered by `supabase/tests/sql/m08_announcements_events_access.sql:424-433`. | closed |
| T-04-08 | I | resident announcement and event reads | mitigate | `features/announcements/ResidentAnnouncementsPage.tsx:120-124` now fetches display-only attachment metadata for the feed and no longer exposes `storage_path` to the browser. | closed |
| T-04-09 | T | RSVP UI action | mitigate | `features/events/ResidentEventDetailPage.tsx:143-163` validates the payload with `rsvpUpsertSchema` before upsert; schema definition remains in `lib/validation.ts:319-324`. | closed |
| T-04-10 | D | unified resident home fan-out | mitigate | `features/resident/ResidentHomePage.tsx:398-450,452-479,481-510,576-657` keeps billing, announcements, and events independently recoverable with per-slice loading/error states. | closed |
| T-04-11 | E | communication route guard | mitigate | `features/auth/authHooks.ts:70-73`, `features/auth/RequireOperatorRole.tsx:11-21,44-52`, and both communication route stubs block treasurer direct-URL access. | closed |
| T-04-12 | T | attachment upload metadata | mitigate | `features/announcements/AdminAnnouncementsPage.tsx:339-355,623-625` limits accepted browser uploads to explicit MIME types and persists only the declared attachment fields; bucket MIME allowlist exists in `supabase/migrations/0019_m08_announcements_events.sql:221-228`. | closed |
| T-04-13 | I | resident attachment access | mitigate | `features/announcements/ResidentAnnouncementDetailPage.tsx:94-110,211-223` uses short-lived signed URLs with `openSignedArtifactUrl`, backed by resident-scoped storage policy in `supabase/migrations/0019_m08_announcements_events.sql:260-274`. | closed |
| T-04-14 | T | resident RSVP mutation payload | mitigate | `features/events/ResidentEventDetailPage.tsx:143-152` now writes only `event_id`, `profile_id`, and `response`. | closed |
| T-04-15 | R | SQL regression confidence | mitigate | `supabase/tests/sql/m08_announcements_events_access.sql:444-533` performs real RSVP insert/update assertions against the live schema. | closed |
| T-04-16 | R | migration traceability | mitigate | Planning artifacts now match the implemented backend contract: `04-01-PLAN.md` points to `0019`, and `.planning/phases/04-announcements-events-resident-home/04-RESEARCH.md:54-58` no longer documents `responded_at`. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-30 | 16 | 12 | 4 | OpenCode + gsd-security-auditor |
| 2026-04-30 | 16 | 16 | 0 | OpenCode + gsd-security-auditor |

### Security Audit 2026-04-30

| Metric | Count |
|--------|-------|
| Threats found | 16 |
| Closed | 12 |
| Open | 4 |

### Security Audit 2026-04-30 (Post-Fix)

| Metric | Count |
|--------|-------|
| Threats found | 16 |
| Closed | 16 |
| Open | 0 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-30
