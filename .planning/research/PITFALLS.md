# Pitfalls Research

**Domain:** Neighborhood operations app for resident billing, manual payment confirmation, announcements/events, and Telegram workflows
**Researched:** 2026-04-29
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Resident-Facing Numbers Drift From The Ledger

**What goes wrong:**
Residents see one outstanding amount in the app, admins export a different number in reports, and Telegram reminders reference stale status. Trust drops immediately because billing feels arbitrary.

**Why it happens:**
Teams let invoice totals, payment status, arrears, and reminder eligibility be recalculated in multiple places: UI helpers, SQL views, exports, bot handlers, and manual spreadsheet corrections.

**How to avoid:**
Make invoice state derive from one canonical server-side path only. Treat payments as immutable records, keep status recalculation in RPC/server logic, and require M07 reporting outputs to match resident views before M09 notifications are enabled. Add reconciliation checks between resident UI, admin reports, and notification payloads.

**Warning signs:**
- Admin CSV totals do not match the resident portal.
- A verified payment still receives a reminder.
- Staff say “the spreadsheet is more correct than the app.”
- Manual status edits start appearing outside the audited flow.

**Phase to address:**
M06 Verification & Audit, then M07 Reports/History before M09 Telegram Notifications.

---

### Pitfall 2: “Self-Service” Stops At Viewing, Not Resolution

**What goes wrong:**
Residents can open a bill, but still must message admins for basic questions: why a proof was rejected, whether payment is pending review, which month is unpaid, or what changed after an adjustment.

**Why it happens:**
Projects optimize for internal admin workflows first, then call the resident portal “done” once it shows a list of invoices. They omit timeline/status explanations, rejection reasons, payment history, and next-step guidance.

**How to avoid:**
Design self-service around dispute reduction, not page count. The resident home should show current balance, invoice breakdown, payment proof status, rejection reason, last action timestamp, payment history, and clear next actions. Any status change that affects billing trust must be visible to the resident before it is automated in Telegram.

**Warning signs:**
- Residents repeatedly ask admins whether proof was received.
- Rejection flows only show “rejected” without a reason.
- Residents cannot tell whether a bill is unpaid, partial, or awaiting review.
- Admins are manually sending screenshots to explain status.

**Phase to address:**
Resident self-service phase spanning M05 Manual Proof Upload, M06 Verification & Audit, and M07 History/Receipts.

---

### Pitfall 3: Telegram Linking Is Treated As Convenience, Not Identity Security

**What goes wrong:**
The wrong resident gets billing data in Telegram, link URLs remain reusable, or admin commands become accessible from a badly linked account.

**Why it happens:**
Teams bind raw chat IDs directly to users, keep long-lived link tokens, skip one-time token consumption, or trust bot input without checking the linked in-app profile and role.

**How to avoid:**
Keep account linking as a high-trust auth flow: app-generated one-time tokens only, hash tokens at rest, enforce short expiry, consume once, require `X-Telegram-Bot-Api-Secret-Token`, support unlink/relink, and re-check resident/admin role server-side for every sensitive command.

**Warning signs:**
- Link tokens can be reused.
- Support staff cannot explain how to revoke a Telegram link.
- Admin commands only check chat ID, not current app role.
- Bot responses include data for an unverified or newly reassigned resident.

**Phase to address:**
M08 Telegram Bot Foundation and Account Linking.

---

### Pitfall 4: Telegram Delivery Is Assumed To Be Reliable And Exactly-Once

**What goes wrong:**
Residents get duplicate reminders, stale reminders after paying, or missing notifications during webhook failures and redeploys.

**Why it happens:**
Telegram webhooks retry on non-2xx responses, pending updates can accumulate, and update delivery is operationally asynchronous. Projects often skip idempotency keys, delivery logs, webhook health checks, and state revalidation before sending messages.

**How to avoid:**
Return fast from webhook handlers, log every outbound notification, make reminder sending idempotent by resident/template/invoice/date, re-check invoice state immediately before send, and monitor `pending_update_count`/last webhook errors. Treat notification jobs as replayable, not one-shot.

**Warning signs:**
- Same resident gets the same reminder twice in one day.
- Pending webhook updates grow after deploys.
- Manual reruns are the only recovery path.
- Reminder jobs do not record why a message was skipped or sent.

**Phase to address:**
M08 Telegram foundation for inbound safety, M09 Telegram Notifications for outbound idempotency, and M14 rollout hardening for monitoring/recovery.

---

### Pitfall 5: Announcements And Events Are Built Like Chat Posts, Not Operational Records

**What goes wrong:**
Announcements stay visible after becoming obsolete, urgent messages cannot be pinned/unpinned cleanly, attachments leak too broadly, and RSVP counts cannot be trusted for neighborhood planning.

**Why it happens:**
Teams bolt communication onto a billing app as a rich-text feed without lifecycle, audience scoping, publish windows, delivery tracking, or event-specific fields.

**How to avoid:**
Model announcements and events as first-class records with publish/unpublish, urgent pinning, audience rules, attachment controls, RSVP state, and audit history. Separate “resident portal visibility” from “Telegram push delivered” so failed pushes do not silently hide important messages in the app.

**Warning signs:**
- Admins edit old posts instead of publishing status changes.
- Residents cannot tell if an event changed or was canceled.
- Telegram is the only place an announcement exists.
- RSVP totals are tracked manually outside the app.

**Phase to address:**
Add a dedicated Community Communication & Events phase before M09 Telegram automation and before full resident rollout.

---

### Pitfall 6: Spreadsheet Cutover Is Treated As Import, Not Reconciliation

**What goes wrong:**
Opening balances are wrong, resident-to-kavling mappings drift, duplicate residents are created, and admins keep a shadow spreadsheet because nobody trusts the imported baseline.

**Why it happens:**
Projects focus on CSV parsing and ignore cutover discipline: source cleaning, identity keys, preview review, opening-balance reconciliation, dual-run comparison, and auditability of imported corrections.

**How to avoid:**
Require explicit import types, stable business keys, preview + server-side revalidation, immutable `import_jobs`, opening-balance reconciliation reports, and a short dual-run period where spreadsheet totals and app totals must match before spreadsheet retirement. Never allow direct “fix it in production” imports without audit records.

**Warning signs:**
- Admins ask for direct table edits after import.
- Multiple residents share the same logical unit mapping unexpectedly.
- Imported totals cannot be tied back to a source file.
- The first month after cutover still requires spreadsheet corrections.

**Phase to address:**
M10 Bulk Import plus a rollout cutover sub-phase before M14 production handover.

---

### Pitfall 7: Reporting Comes After Automation Instead Of Before It

**What goes wrong:**
Telegram reminders, admin summaries, and resident trust features launch before staff can independently verify totals, arrears, and history. Automation then scales hidden mistakes.

**Why it happens:**
Notification features feel visible and high-value, so teams ship them before exports, receipts, arrears views, and historical audit views are ready.

**How to avoid:**
Keep reporting as a prerequisite, not a follow-up. Before automated reminders, admins must be able to verify monthly status CSVs, all-payments CSVs, arrears summaries, and receipt history from the app alone.

**Warning signs:**
- Staff validate reminders by reopening spreadsheets.
- There is no report that explains why a resident was reminded.
- Receipts/history exist only per screen, not as exportable evidence.
- Monthly totals require manual recomputation.

**Phase to address:**
M07 Reports/History must complete before M09 Telegram Notifications.

---

### Pitfall 8: Hardening Is Left Until The Link Is Already Shared With Residents

**What goes wrong:**
Private proof access leaks, SSR auth sessions are cached incorrectly, Telegram webhook setup is brittle, backups are untested, and non-developer admins cannot operate the system safely.

**Why it happens:**
Brownfield projects often assume “we’ll document and secure it at the end,” while production-specific issues only appear during deployment, CDN caching, secret rotation, and first real support incidents.

**How to avoid:**
Treat production hardening as a release gate: private bucket verification, no public proof URLs, request-scoped Supabase clients only, no caching on auth/session-refresh routes, webhook secret verification, backup/export drills, and admin runbooks for wrong payment, lost Telegram link, and leaked secret incidents.

**Warning signs:**
- Proof preview uses or stores a public URL.
- Authenticated pages are cached or use shared server clients.
- Deployment steps live only in chat messages.
- Residents are invited before a backup/restore test passes.

**Phase to address:**
M14 Deployment/Hardening, with earlier guardrails in M06 and M08 for proof privacy and webhook security.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Let admins manually edit invoice status fields | Fast support resolution | Ledger drift, unexplainable totals, broken audit trail | Never |
| Ship Telegram reminders before delivery logging | Faster visible launch | Duplicate/stale notifications with no forensic trail | Never |
| Import CSVs directly after client-side validation | Less backend work | Unsafe cutover, tampered payloads, role/data corruption | Never |
| Use Telegram as the primary source of announcements | Quick communication rollout | No canonical archive, no resident-only visibility guarantees | Only as temporary mirror of in-app records |
| Keep “temporary” spreadsheet reconciliation outside the app | Reduces launch pressure | Spreadsheet becomes permanent shadow system | Only during a short, explicit dual-run window |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Telegram Bot API | Not validating `X-Telegram-Bot-Api-Secret-Token` or not monitoring webhook errors | Require the secret header, return fast, and monitor webhook status/pending updates |
| Telegram reminders | Treating retries/reruns as safe without idempotency | Log deliveries and dedupe by resident/template/invoice/local date |
| Supabase RLS | Writing policies that assume `auth.uid()` is always present | Explicitly guard for authenticated users and keep sensitive access server-validated |
| Supabase Storage | Using public proof URLs or broad bucket policies for convenience | Keep payment proof buckets private and issue signed access only when needed |
| SSR + Supabase | Reusing server clients or caching auth responses | Create request-scoped clients and disable caching on auth/session-refresh paths |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| RLS queries without matching filters/indexes on resident/invoice lookups | Slow resident home and admin arrears pages | Add indexes for policy columns and apply explicit query filters | Usually visible once invoice/payment rows grow into the thousands |
| Recomputing arrears/history separately for portal, reports, and reminders | Slow pages plus inconsistent answers | Centralize calculation paths and reuse server-side views/RPCs | Breaks operationally before scale does |
| Synchronous Telegram work inside webhook processing | Webhook retries and pending update buildup | Acknowledge quickly and push heavier work to jobs/logged async handlers | Breaks during spikes, retries, or deploy instability |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing proof files with `getPublicUrl` or shared bucket access | High privacy breach; payment evidence leaks outside resident/admin scope | Private bucket only, signed URLs only, audit proof access |
| Trusting client-provided role or resident identifiers in admin/payment flows | Unauthorized verification or data disclosure | Verify JWT server-side and derive actor/profile from trusted backend context |
| Storing authorization decisions in user-editable JWT metadata | Resident privilege escalation | Keep authorization in app-controlled role tables/app metadata only |
| Long-lived or plaintext Telegram link tokens | Account hijack or replay linking | Hash tokens, short expiry, one-time consumption, revoke on use |
| CDN/ISR caching on authenticated routes | Cross-user session leakage | Force dynamic/private no-store on auth-sensitive SSR routes |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw statuses like `submitted`/`partial` without explanation | Residents still contact admins to interpret the app | Use human explanations and next-step guidance in Indonesian |
| Hiding why a payment was rejected | Repeated proof resubmission and frustration | Show rejection reason, requested correction, and retry path |
| Mixing public transparency with resident-specific data | Fear of privacy exposure | Keep public dashboard aggregate-only and explain that boundary clearly |
| Using Telegram as the only notice channel for important updates | Missed notices for unlinked or opted-out residents | Keep app inbox/home canonical; Telegram is an additional channel |
| Treating event RSVP as a comment thread | Poor planning accuracy for residents/admins | Use structured RSVP states with update history |

## "Looks Done But Isn't" Checklist

- [ ] **Billing verification:** Often missing duplicate-payment prevention — verify unique constraints and replay-safe approval logic.
- [ ] **Resident self-service:** Often missing rejection reason/history visibility — verify residents can explain their own bill state without admin chat.
- [ ] **Telegram linking:** Often missing unlink/relink and token expiry — verify stolen/old links cannot be reused.
- [ ] **Announcements/events:** Often missing publish lifecycle and resident-only audience controls — verify old or draft content cannot leak.
- [ ] **CSV import:** Often missing server-side revalidation and cutover reconciliation — verify imported totals match source before go-live.
- [ ] **Production handover:** Often missing backup/restore drill and admin runbook — verify a non-developer admin can operate safely.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Ledger drift between resident/admin/reminder views | HIGH | Freeze reminders, reconcile canonical payment/invoice tables, regenerate reports, communicate corrected balances, and audit the root cause before resuming automation |
| Incorrect Telegram account linking | HIGH | Unlink affected account, revoke link tokens, review chat/user mapping history, notify affected resident, and re-link through one-time flow |
| Bad spreadsheet cutover | HIGH | Stop new imports, preserve source files, restore from backup if needed, rerun preview/reconciliation, and complete a documented dual-run before reopening rollout |
| Proof privacy leak | HIGH | Revoke access path, rotate keys/secrets if relevant, audit file exposure scope, notify stakeholders, and verify all proof access now uses signed URLs only |
| Duplicate/stale reminders | MEDIUM | Pause jobs, dedupe notification log, revalidate invoice state, resend only corrected notices, and add idempotency coverage before restart |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Resident-facing numbers drift from the ledger | M06 + M07 before M09 | Resident portal, admin report, and reminder eligibility all agree for sampled invoices |
| Self-service stops at viewing, not resolution | Resident self-service phase across M05-M07 | Residents can see payment status, rejection reasons, and history without admin intervention |
| Telegram linking treated as convenience, not identity security | M08 | Wrong/missing secret is rejected; link token is short-lived, hashed, and one-time |
| Telegram delivery assumed exactly-once | M09 + M14 | Re-running reminder jobs does not resend the same daily reminder and webhook monitoring is documented |
| Announcements/events built like chat posts | Dedicated Community Communication & Events phase | Draft/published/pinned/cancelled states and resident-only visibility are testable |
| Spreadsheet cutover treated as import, not reconciliation | M10 + rollout cutover sub-phase | Imported counts/totals reconcile to source files and shadow spreadsheet is retired explicitly |
| Reporting comes after automation | M07 before M09 | Admin can verify reminders against exports/history inside the app |
| Hardening left until resident launch | M14 | Backup/restore, deployment checklist, proof privacy, and Telegram setup are all rehearsed |

## Sources

- Internal project context: `.planning/PROJECT.md` — HIGH confidence for product boundaries and rollout constraints.
- Internal milestone plan: `docs/plan/milestones/M06-verification-audit.md` — HIGH confidence for audit, duplicate-payment, and proof privacy requirements.
- Internal milestone plan: `docs/plan/milestones/M07-reports-history.md` — HIGH confidence for reports-before-automation dependency.
- Internal milestone plan: `docs/plan/milestones/M08-telegram-foundation.md` — HIGH confidence for Telegram linking/webhook security requirements.
- Internal milestone plan: `docs/plan/milestones/M09-telegram-notifications.md` — HIGH confidence for reminder idempotency and notification logging requirements.
- Internal milestone plan: `docs/plan/milestones/M10-bulk-import.md` — HIGH confidence for CSV import and server-side validation requirements.
- Internal milestone plan: `docs/plan/milestones/M14-deployment-hardening.md` — HIGH confidence for production handover and hardening requirements.
- Telegram Bot API docs: https://core.telegram.org/bots/api — HIGH confidence for webhook behavior, secret token header, pending updates, and webhook status fields.
- Supabase Row Level Security docs: https://supabase.com/docs/guides/database/postgres/row-level-security — HIGH confidence for `auth.uid()` null behavior, RLS requirements, and view/policy pitfalls.
- Supabase Storage access control docs: https://supabase.com/docs/guides/storage/security/access-control — HIGH confidence for private bucket and signed-access patterns.
- Supabase SSR auth docs: https://supabase.com/docs/guides/auth/server-side/advanced-guide — HIGH confidence for SSR cache/session leakage and request-scoped client pitfalls.
- Domain-specific findings on billing trust, resident self-service completeness, announcements/events lifecycle, and spreadsheet cutover discipline are synthesized from the internal roadmap context plus adjacent product/billing operations experience rather than a single authoritative external standard — MEDIUM confidence.

---
*Pitfalls research for: neighborhood billing, resident self-service, Telegram workflows, and rollout hardening*
*Researched: 2026-04-29*
