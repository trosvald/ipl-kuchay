# Phase 4: Announcements, Events & Resident Home - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `04-CONTEXT.md`.

**Date:** 2026-04-30
**Phase:** 04-announcements-events-resident-home
**Areas discussed:** Resident home layout, Announcement presentation, Event RSVP behavior, Admin content lifecycle

---

## Resident home layout

### Home structure

| Option | Description | Selected |
|--------|-------------|----------|
| Summary dashboard | Top-level cards for billing, announcements, and upcoming events with clear next actions. | ✓ |
| Updates-first feed | Announcements/events dominate, billing becomes secondary. | |
| Mixed full content | Show detailed billing plus full announcement/event lists on one long page. | |

### Billing slice on home

| Option | Description | Selected |
|--------|-------------|----------|
| Actionable billing only | Show arrears/current outstanding and actionable invoices, then link deeper. | ✓ |
| Full invoice history | Put the full billing timeline directly on home. | |
| Combined household total | Merge all kavlings into one household balance view. | |

### Navigation model

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated pages + home previews | Home stays concise; announcements and events also get their own resident pages. | ✓ |
| Home only | All content lives inside `/app` only. | |
| Announcements separate only | Announcements get a page, events stay only on home. | |

### Preview density

| Option | Description | Selected |
|--------|-------------|----------|
| Compact previews | Small announcement/event slices on home. | ✓ |
| Expanded previews | More cards and longer lists directly on home. | |
| Counts only | Home shows only counts and CTAs. | |

### Visual priority

| Option | Description | Selected |
|--------|-------------|----------|
| Billing first | Lead with billing status, then urgent announcements, then events. | ✓ |
| Announcements first | Lead with neighborhood updates. | |
| Events first | Lead with upcoming activities. | |

### Multi-kavling handling

| Option | Description | Selected |
|--------|-------------|----------|
| Per-kavling summaries | Keep billing separated per kavling. | ✓ |
| Single rolled-up summary | Merge kavlings into one balance. | |
| Choose one default kavling | Show only one kavling until residents switch. | |

---

## Announcement presentation

### Urgent handling

| Option | Description | Selected |
|--------|-------------|----------|
| Pinned hero card | One urgent item gets prominent top placement. | ✓ |
| Pinned in normal list | Top placement with limited visual distinction. | |
| Badge only | Urgent only changes the label, not placement. | |

### Regular feed structure

| Option | Description | Selected |
|--------|-------------|----------|
| Newest first cards | Reverse-chronological cards. | ✓ |
| Dense table/list | Compact operational list view. | |
| Category sections | Group content before browsing. | |

### Attachments

| Option | Description | Selected |
|--------|-------------|----------|
| Inline attachment chips | Clear file/image affordances inside the card. | ✓ |
| Open inside detail only | Attachment affordances live only after opening detail. | |
| Large media-first cards | Media dominates the feed presentation. | |

### Resident history after state changes

| Option | Description | Selected |
|--------|-------------|----------|
| Published history only | Unpublished disappears; archived moves into older history. | ✓ |
| Current only | Removed items vanish entirely. | |
| Everything with status | Residents keep seeing unpublished/archived states. | |

### Pinning saturation

| Option | Description | Selected |
|--------|-------------|----------|
| Single top urgent | Only one item occupies the primary pinned slot. | ✓ |
| Multiple pinned | Several urgent items stay pinned. | |
| No hard limit, admin choice | Admin manually decides how many remain pinned. | |

### Feed reading depth

| Option | Description | Selected |
|--------|-------------|----------|
| Preview + open full detail | Cards stay compact. | ✓ |
| Full body in feed | Residents read the full notice inline. | |
| Title only | Very sparse list; detail required for substance. | |

### Card metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Date + urgency only | Official notice-board feel. | ✓ |
| Date + admin author | Also show publisher identity. | |
| Minimal headline only | Suppress most metadata. | |

### Home slice behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Urgent first, then latest one or two | Small but meaningful preview. | ✓ |
| Urgent only | Home shows only urgent announcements. | |
| Latest regardless of urgency | Strict chronology even on home. | |

---

## Event RSVP behavior

### RSVP model

| Option | Description | Selected |
|--------|-------------|----------|
| 3-state RSVP | Attending, not attending, or no response yet. | ✓ |
| Yes or No only | Binary RSVP. | |
| Going / Maybe / No | More social-style response set. | |

### Resident event organization

| Option | Description | Selected |
|--------|-------------|----------|
| Upcoming, cancelled, then past | Separate future, cancelled, and historical views. | ✓ |
| Single chronological list | Mix all states together by date. | |
| Upcoming only | Hide cancelled/past items. | |

### RSVP change window

| Option | Description | Selected |
|--------|-------------|----------|
| Any time before start | Residents can revise until the event begins. | ✓ |
| Until admin closes RSVP | Admin decides the close point. | |
| One submission only | RSVP is final once submitted. | |

### Card detail level

| Option | Description | Selected |
|--------|-------------|----------|
| Core details on card | Date, time, location, short description, RSVP status, CTA. | ✓ |
| Minimal list rows | Most context waits for detail view. | |
| Full event detail inline | Heavy list cards with most event content inline. | |

---

## Admin content lifecycle

### Announcement publish model

| Option | Description | Selected |
|--------|-------------|----------|
| Draft -> Publish flow | Explicit save vs go-live lifecycle. | ✓ |
| Publish immediately | Saving makes it live. | |
| Single active toggle | One simple on/off state. | |

### Admin IA

| Option | Description | Selected |
|--------|-------------|----------|
| Separate announcements and events pages | Dedicated admin surfaces per domain. | ✓ |
| One combined content page | Shared content workspace. | |
| Dashboard widgets only | Mostly manage from dashboard cards. | |

### Cancelled event visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Keep card with cancelled status | Residents still see the cancelled event transparently. | ✓ |
| Remove it from resident view | Cancelled events disappear. | |
| Detail page only | Remove from lists but keep in deeper history. | |

### Admin urgent controls

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit urgent + pinned controls | Admin deliberately controls urgency and placement. | ✓ |
| Urgency implied by newest publish | Recency acts as urgency. | |
| Urgent only, no pin toggle | Mark urgent, but system decides placement. | |

## OpenCode's Discretion

- Exact visual styling and component composition.
- Exact CTA text and badge presentation.
- Exact route naming and page chrome.

## Deferred Ideas

None.
