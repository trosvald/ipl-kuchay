# Phase 1: Access, Scope & Resident Identity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 01-access-scope-resident-identity
**Areas discussed:** Role boundaries, Resident profile scope, Kavling identity model, Login and onboarding UX, Resident departure policy

---

## Role boundaries

### Q1: What should treasurer access look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Finance-only | Billing, payment verification, reporting, and finance audit workflows only | ✓ |
| Same as admin | Nearly full admin area except super-admin actions | |
| Mostly read-only finance | Reviews submissions and reports without broader config power | |
| You decide | Leave it to implementation | |

**User's choice:** Finance-only.
**Notes:** Later refined to allow period operations but not broader billing structure configuration.

### Q2: How should admin and super admin be separated?

| Option | Description | Selected |
|--------|-------------|----------|
| Only elevation/bootstrap | Super admin handles first-run setup and elevation-sensitive controls; admin handles daily ops | ✓ |
| Owns settings too | Super admin also controls settings/imports broadly | |
| Nearly same role | Minimal distinction between admin and super admin | |
| You decide | Leave it to implementation | |

**User's choice:** Only elevation/bootstrap.
**Notes:** Keeps super-admin scope narrow and intentionally sensitive.

### Q3: How should restricted navigation behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide and block | Hide disallowed nav items and still block direct URL access | ✓ |
| Disable with explanation | Show disabled sections in nav with a reason | |
| Show all, block later | Shared nav with page-level denial only | |
| You decide | Leave it to implementation | |

**User's choice:** Hide and block.
**Notes:** UX should not tease inaccessible areas unnecessarily.

### Q4: Who should be able to view audit history?

| Option | Description | Selected |
|--------|-------------|----------|
| Finance slice for treasurer | Treasurer sees only finance-related audit activity | ✓ |
| All admin-like see full audit | Treasurer, admin, and super admin all see full audit | |
| Admin and super admin only | Treasurer has no audit view | |
| You decide | Leave it to implementation | |

**User's choice:** Finance slice for treasurer.
**Notes:** Later refined to include all finance actions.

### Q5: Within billing, how much configuration should treasurer have?

| Option | Description | Selected |
|--------|-------------|----------|
| Period operations only | Treasurer can operate billing periods but not own fee structure setup | ✓ |
| Full billing config | Treasurer can manage fee types and overrides too | |
| No billing config | Treasurer stays limited to verification/reporting | |
| You decide | Leave it to implementation | |

**User's choice:** Period operations only.
**Notes:** Fee types and fee overrides remain admin-owned.

### Q6: What should the treasurer audit slice include?

| Option | Description | Selected |
|--------|-------------|----------|
| All finance actions | Billing, verification, payment, and report-related actions | ✓ |
| Verification actions only | Only payment review decisions | |
| No separate audit slice | Rely on screen-local history only | |
| You decide | Leave it to implementation | |

**User's choice:** All finance actions.
**Notes:** Still narrower than full system-wide audit visibility.

---

## Resident profile scope

### Q1: Which fields should residents be allowed to edit themselves in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Display name + phone + prefs | Residents update practical contact/display fields and notification preferences | ✓ |
| Most personal/contact fields | Residents can also edit full name and email | |
| Display name + phone + email | Preferences stay narrower or later | |
| You decide | Leave it to implementation | |

**User's choice:** Display name + phone + prefs.
**Notes:** Protected identity and role fields remain admin-controlled.

### Q2: How should notification preferences show up before Telegram linking is implemented in Phase 5?

| Option | Description | Selected |
|--------|-------------|----------|
| Store future-ready prefs | Capture app/Telegram-oriented choices now and activate Telegram later | ✓ |
| App-only for now | Telegram controls wait until the Telegram phase | |
| Single master toggle | One simple notification switch only | |
| You decide | Leave it to implementation | |

**User's choice:** Store future-ready prefs.
**Notes:** Avoids redesigning the preference model later.

### Q3: Where should residents manage their profile and preferences?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated settings page | Clear resident settings destination under `/app` | ✓ |
| Inline on home | Editing stays inside resident home | |
| Modal or drawer | Editing opens without a route | |
| You decide | Leave it to implementation | |

**User's choice:** Dedicated settings page.
**Notes:** Keeps account management explicit and discoverable.

### Q4: How should non-editable fields be shown?

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only with explanation | Show protected fields but explain why they are locked | ✓ |
| Hide protected fields | Only show editable fields | |
| Show request-change hint | Show protected fields with an admin-help hint | |
| You decide | Leave it to implementation | |

**User's choice:** Read-only with explanation.
**Notes:** Residents should understand what is locked and why.

### Q5: How granular should notification preferences be in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| By message category | Separate billing/payment, announcements/events, and similar categories | ✓ |
| By channel only | Broad in-app vs Telegram toggles only | |
| One global switch | Single all-notifications toggle | |
| You decide | Leave it to implementation | |

**User's choice:** By message category.
**Notes:** Category-based structure should survive future Telegram work.

### Q6: How should login email appear if residents cannot edit it themselves?

| Option | Description | Selected |
|--------|-------------|----------|
| Show read-only email | Let residents confirm which email their account uses | ✓ |
| Hide email entirely | Avoid showing non-editable login identity | |
| Show support-action hint | Emphasize contacting admin for email changes | |
| You decide | Leave it to implementation | |

**User's choice:** Show read-only email.
**Notes:** Email stays visible but protected.

---

## Kavling identity model

### Q1: If one resident is linked to multiple kavlings, how should their account behave?

| Option | Description | Selected |
|--------|-------------|----------|
| One account, all linked kavlings | One login spans every active kavling link | ✓ |
| Primary first, others secondary | One main kavling with secondary access to others | |
| One kavling per account | Avoid normal multi-kavling UX | |
| You decide | Leave it to implementation | |

**User's choice:** One account, all linked kavlings.
**Notes:** Multi-kavling support is explicit, not an accident.

### Q2: What should `primary resident` mean in practice?

| Option | Description | Selected |
|--------|-------------|----------|
| Main contact anchor | Primary is the default admin/billing contact, not the exclusive viewer | ✓ |
| Exclusive access owner | Only primary sees kavling data | |
| Admin label only | Primary has little UX meaning | |
| You decide | Leave it to implementation | |

**User's choice:** Main contact anchor.
**Notes:** Non-primary linked residents still retain kavling-scoped visibility.

### Q3: Should residents with multiple kavlings see them equally or through a selected focus?

| Option | Description | Selected |
|--------|-------------|----------|
| See all together | No forced kavling switch before using resident-facing views | ✓ |
| Choose active kavling | Manual kavling context switch required | |
| Hybrid approach | Show all on home but force selection deeper | |
| You decide | Leave it to implementation | |

**User's choice:** See all together.
**Notes:** Simpler one-account mental model.

### Q4: How should resident-to-kavling relation values be managed?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed list + custom option | Standardize common values while allowing edge cases | ✓ |
| Fixed list only | Fully standardized relations | |
| Free text only | Keep current unconstrained relation entry | |
| You decide | Leave it to implementation | |

**User's choice:** Fixed list + custom option.
**Notes:** Current free-text input should become more structured.

### Q5: When a resident has multiple kavlings, how should future resident-facing data be presented?

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by kavling | Keep invoices and balances separated per kavling | ✓ |
| Merged household summary | Combine totals first, drill down later | |
| User-switchable view | Let users choose grouped vs merged | |
| You decide | Leave it to implementation | |

**User's choice:** Grouped by kavling.
**Notes:** Prevents future confusion in billing and history views.

---

## Login and onboarding UX

### Q1: Which sign-in method should be the primary path residents see first?

| Option | Description | Selected |
|--------|-------------|----------|
| Password first | Password is the main action, magic link is secondary | ✓ |
| Magic link first | Lead with email-link login | |
| Both equal | Present both paths with the same weight | |
| You decide | Leave it to implementation | |

**User's choice:** Password first.
**Notes:** Password is preferred long-term, not necessarily the first-ever invited entry.

### Q2: What should happen if a resident account exists but has no kavling mapping yet?

| Option | Description | Selected |
|--------|-------------|----------|
| Limited portal with guidance | Allow sign-in, but billing-related access waits for mapping | ✓ |
| Dedicated holding screen | Fully blocked waiting state after login | |
| Back to login | Deny portal access until mapping exists | |
| You decide | Leave it to implementation | |

**User's choice:** Limited portal with guidance.
**Notes:** Later refined to profile/settings-only access.

### Q3: How should inactive profiles be handled in the UX?

| Option | Description | Selected |
|--------|-------------|----------|
| Blocked with explanation | Clear inactive-account state with next steps | ✓ |
| Silent login denial | Generic auth failure only | |
| Read-only account state | Restricted inactive session | |
| You decide | Leave it to implementation | |

**User's choice:** Blocked with explanation.
**Notes:** Avoid confusing redirect loops or vague failures.

### Q4: How should admin-created resident onboarding be framed?

| Option | Description | Selected |
|--------|-------------|----------|
| Invite email + self-serve login | Resident receives an invite-style message and handles their own entry | ✓ |
| Magic-link onboarding only | No password emphasis at onboarding | |
| Manual credential handoff | Admin distributes credentials directly | |
| You decide | Leave it to implementation | |

**User's choice:** Invite email + self-serve login.
**Notes:** Keeps operator work light and resident onboarding clearer.

### Q5: If an account is signed in but not yet mapped to any kavling, what should the limited portal include?

| Option | Description | Selected |
|--------|-------------|----------|
| Profile/settings only | Limited portal is for identity confirmation and preferences while mapping is pending | ✓ |
| Profile + generic home shell | Keep more of the resident shell visible with placeholders | |
| Waiting state only | No editable settings until mapping exists | |
| You decide | Leave it to implementation | |

**User's choice:** Profile/settings only.
**Notes:** Mapping-pending users still need account-maintenance access.

### Q6: If password is the primary long-term login method, how should a newly invited resident get there?

| Option | Description | Selected |
|--------|-------------|----------|
| Magic link sets up password | First entry uses the invite/magic-link path, then guides password creation | ✓ |
| Admin gives temporary password | Operator distributes starter credentials | |
| Password stays optional | Password is preferred but not required | |
| You decide | Leave it to implementation | |

**User's choice:** Magic link sets up password.
**Notes:** Resolves the tension between password-first steady state and invite-driven first login.

---

## Resident departure policy

### Q1: If a resident ends up with zero active kavling mappings, what should happen to their account by default?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay active, limited portal | Keep profile/settings access and remove kavling-scoped access | ✓ |
| Auto-deactivate account | Zero mappings automatically inactivates the account | |
| Admin decides case-by-case | No default automation | |
| You decide | Leave it to implementation | |

**User's choice:** Stay active, limited portal.
**Notes:** Mapping loss is not the same as full account deactivation.

### Q2: If someone moves out, should they retain any self-service access to past records later on?

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only history access | Keep restricted self-service access to past records | ✓ |
| Lose portal access | Remove all self-service access after move-out | |
| Manual by admin only | Former residents request records from admins | |
| You decide | Leave it to implementation | |

**User's choice:** Read-only history access.
**Notes:** Later narrowed to past own billing records only.

### Q3: When a new resident becomes primary for the same kavling, how should admin workflow behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit handoff | Admin must deliberately close/demote the old primary before assigning the new one | ✓ |
| Auto-replace old primary | Setting a new primary silently replaces the old one | |
| Allow overlap window | Permit a temporary transition overlap | |
| You decide | Leave it to implementation | |

**User's choice:** Explicit handoff.
**Notes:** Avoid silent identity scope changes on the same kavling.

### Q4: Should profile deactivation stay separate from mapping status?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate controls | Mapping removal does not auto-deactivate the profile | ✓ |
| Auto-deactivate on zero mappings | Profile state derives from mapping presence | |
| Role-based rule | Different rule for residents vs operators | |
| You decide | Leave it to implementation | |

**User's choice:** Separate controls.
**Notes:** Supports temporary unmapped states and manual admin judgment.

### Q5: What should former-resident read-only access include?

| Option | Description | Selected |
|--------|-------------|----------|
| Past own billing records only | Preserve invoices/receipts from the resident's own occupancy window only | ✓ |
| Full old resident portal snapshot | Keep most resident views in read-only form | |
| Profile only until admin export | No direct billing history access | |
| You decide | Leave it to implementation | |

**User's choice:** Past own billing records only.
**Notes:** Must not leak future/new-occupant activity after handoff.

---

## OpenCode's Discretion

- Exact default values for category-based notification preferences.
- Exact wording and visual treatment for blocked, unmapped, and read-only field states.
- Exact IA details for the treasurer-only finance audit entry point.
