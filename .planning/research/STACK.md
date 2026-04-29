# Stack Research

**Domain:** Neighborhood operations, resident billing, Telegram communication, reporting, announcements, and events
**Researched:** 2026-04-29
**Confidence:** HIGH for core platform choices, MEDIUM for optional UI/reporting libraries

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2.x | Main web app for resident/admin portals | Stay on App Router with Server Components, Route Handlers, and Server Actions. This is already the repo baseline and is still the standard secure full-stack React path in 2026. It keeps billing mutations server-side and avoids adding a second app backend. |
| React | 19.2.x | UI runtime | Required by Next 16 and useful for form UX via `useActionState`/`useFormStatus` patterns without overbuilding client state. |
| Supabase | current managed platform + `@supabase/supabase-js` 2.105.x | Postgres, Auth, RLS, Storage, Edge Functions, cron-backed jobs | This app already depends on Supabase and should lean further into it, not away from it. RLS/RPCs/private Storage are the right trust boundary for billing and proof files; `pg_cron` + Edge Functions cover reminders and Telegram fan-out without new infra. |
| TypeScript | 6.0.x | Type safety across web app, SQL contracts, bot integration | Important for role-sensitive flows, report filters, and Telegram linking payloads. Keep end-to-end types around DTOs, action inputs, and bot callback payloads. |
| Tailwind CSS | 4.2.x | App styling system | Already present. Good fit for shipping resident/admin UX quickly without introducing a component framework migration. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/ssr` | 0.10.x | Correct SSR auth/session handling in Next.js | Add now if not already used. Use for browser/server clients and Proxy/middleware-based token refresh; do not hand-roll Supabase cookie plumbing. |
| `zod` | 4.3.x | Shared validation for actions, route handlers, bot payloads | Keep using for all billing mutations, profile updates, RSVP inputs, Telegram link tokens, and admin announcement/event forms. |
| `react-hook-form` + `@hookform/resolvers` | 7.74.x + 5.2.x | Efficient client-side forms for complex admin/resident workflows | Use for multi-field forms with drafts, conditional fields, attachments metadata, preferences, and RSVP forms. Keep simple one-shot forms on native Server Actions when possible. |
| `grammy` | 1.42.x | Telegram bot framework | Recommended Telegram integration layer. Use webhook mode for production, not polling. grammY has the cleanest TypeScript story and documented webhook deployment patterns, including Supabase Edge Functions. |
| `@grammyjs/conversations` | 2.1.x | Multi-step resident/admin bot flows | Use for account linking, reminder opt-in/out, guided payment/help flows, and structured admin broadcast flows. |
| `@grammyjs/menu` | 1.3.x | Inline keyboard menus | Use for resident quick actions like “Lihat tagihan”, “RSVP acara”, “Matikan pengingat”, and admin shortcut actions. |
| `@grammyjs/ratelimiter` | 1.2.x | Bot abuse protection | Use on all Telegram entry points so residents cannot accidentally or intentionally spam high-cost flows. |
| `@tanstack/react-table` | 8.21.x | Admin reporting and resident/admin tabular data | Use for invoice lists, payment review queues, arrears reports, RSVP rosters, and exports. It is the standard choice when filters, sorting, and column visibility matter. |
| `recharts` | 3.8.x | Lightweight charts for collection/reporting dashboards | Use for aggregate collection progress, paid-vs-unpaid trends, and event participation summaries. Good fit for straightforward operational charts without BI-level complexity. |
| `@playwright/test` | 1.59.x | E2E coverage for rollout-critical flows | Add for resident self-service, auth, payment proof, announcement visibility, RSVP, and Telegram link completion smoke paths. Vitest alone is not enough for rollout confidence. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase CLI | Local DB/functions workflow, migrations, SQL tests | Keep DB-first workflow. Use it for migrations, SQL acceptance tests, Edge Function local serve, and cron/job validation. |
| Vitest | Unit/integration tests | Keep for pure TS logic, formatters, DTOs, action helpers, and notification payload builders. |
| Playwright | Browser E2E tests | Use against seeded Supabase local state; prioritize resident billing, admin review, announcement/event publishing, and role boundaries. |
| ESLint | Static analysis | Keep strict around server/client boundary mistakes and unused privileged code paths. |

## Recommended Stack Shape for This App

1. **Keep Next.js as the only human-facing app surface.**
   - Resident portal, admin portal, public aggregate dashboard, announcements, events, profile, reporting UI all stay in Next.js.

2. **Keep Supabase as the system of record and enforcement layer.**
   - Billing rules, resident/account linking state, announcement/event tables, RSVP tables, notification preferences, and audit logs stay in Postgres.
   - RLS remains the default protection layer for resident/admin data access.

3. **Use Server Actions and Route Handlers for app mutations.**
   - Good for resident self-service, profile updates, RSVP submissions, and admin CRUD.
   - Re-check auth/role inside every action; do not trust page-level guards alone.

4. **Use Supabase Edge Functions for non-browser privileged jobs.**
   - Best fit for Telegram webhook intake, reminder dispatch, scheduled digests, and job-style fan-out.
   - Keep secrets there, not in the browser.

5. **Use private Supabase Storage + signed URLs for sensitive files.**
   - Payment proof is already private; keep that model.
   - Apply the same rule to resident-only announcement attachments when needed.

## Installation

```bash
# Core app additions
npm install @supabase/ssr react-hook-form @hookform/resolvers @tanstack/react-table recharts grammy @grammyjs/conversations @grammyjs/menu @grammyjs/ratelimiter

# Dev dependencies
npm install -D @playwright/test
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js Server Actions + Route Handlers | tRPC | Use tRPC only if the app becomes highly client-driven and you truly need typed client-side RPC everywhere. For this project, it adds another abstraction without solving the main security/problem domain. |
| Supabase SQL/RPC/RLS-first data layer | Prisma/Drizzle as primary write path | Use an ORM only for non-sensitive read models if the team strongly prefers it. Do **not** replace the existing SQL/RLS/RPC core for billing because it weakens the current database-enforced security model. |
| grammY | Telegraf | Telegraf is viable, but grammY is the better TypeScript-first choice in 2026 and has clearer documented webhook and plugin patterns. |
| Supabase `pg_cron` + Edge Functions | External cron/queue service | Use an external scheduler only if delivery/retry requirements outgrow simple scheduled reminders. For v1 neighborhood operations, native Supabase scheduling is the simpler and better fit. |
| Recharts | BI/embed stack or heavy charting frameworks | Use a heavier analytics stack only if stakeholders need drill-down analytics beyond operational reporting. v1 needs operational charts, not embedded BI. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Replatforming away from Next.js + Supabase | Brownfield risk is far higher than technical benefit. The missing work is product completion, not stack replacement. | Continue the current stack and deepen its patterns. |
| Telegram long polling in production | Webfetch from grammY docs shows polling is simpler for local development, but webhooks are the cheaper/serverless-friendly production mode. Polling also fights the scheduled/serverless shape you already have with Supabase. | Use webhook-based grammY handlers, ideally in Supabase Edge Functions. |
| Public Storage buckets for proof or resident-only files | Violates the project’s privacy boundary and makes access control harder to audit. | Keep buckets private and issue signed URLs server-side only. |
| Client-side service-role usage or browser-held privileged secrets | Breaks the project’s explicit security constraint. | Keep privileged operations in Server Actions, Route Handlers, RPCs, and Edge Functions only. |
| Adding Prisma as the new “main backend” over Supabase billing tables | Duplicates schema logic and encourages moving authorization out of Postgres. Bad trade for a billing app already built around RLS/RPCs. | Keep SQL migrations, RPCs, and DB-enforced rules as the source of truth. |
| Realtime-by-default for every resident/admin screen | Adds complexity that v1 does not need. Billing, announcements, and events mostly tolerate refresh/revalidate + Telegram push. | Use server rendering + revalidation first; add targeted realtime only where a proven need exists. |

## Stack Patterns by Variant

**If the Telegram bot is mostly notifications + simple commands:**
- Run grammY on **Supabase Edge Functions** with webhooks.
- Because it keeps bot secrets and service-role access off the web app, and it aligns naturally with `pg_cron` reminder jobs.

**If the team wants one runtime only and can tolerate less separation:**
- Run grammY in a **Next.js Route Handler** with webhook mode.
- Because it avoids a Deno runtime split, but only do this if bot logic stays small and you still keep secrets server-side.

**If reporting stays operational, not analytical:**
- Use **TanStack Table + Recharts**.
- Because admins mainly need queues, summaries, and exportable lists, not a BI product.

**If residents demand richer form interactions:**
- Use **React Hook Form + Zod** on the client, then submit to Server Actions.
- Because profile, RSVP, preferences, and announcement interactions benefit from client validation without turning the whole app into a SPA.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@16.2.x` | `react@19.2.x` | Matches the current repo and official Next 16 docs. |
| `@supabase/ssr@0.10.x` | `@supabase/supabase-js@2.105.x` | Current SSR helper pairing for Next.js cookie-based auth flows. |
| `react-hook-form@7.74.x` | `@hookform/resolvers@5.2.x` + `zod@4.3.x` | Good fit for typed client validation on top of existing Zod usage. |
| `@tanstack/react-table@8.21.x` | `react@19.2.x` | Standard modern table stack for React admin/reporting UIs. |
| `grammy@1.42.x` | webhook deployments on Next.js or Supabase Edge Functions | If you choose Edge Functions, keep bot logic thin and DB-centric to minimize Node/Deno divergence. |

## Implementation Notes

- **Use `@supabase/ssr` and authenticated server clients everywhere auth matters.** Supabase’s current SSR guidance explicitly warns against trusting cookie-only session reads on the server.
- **Keep authorization closest to data.** Next.js security guidance is explicit: page checks are not enough; Server Actions and Route Handlers must re-check auth.
- **Prefer DTO-style reads for resident home/dashboard data.** Return only the fields each role/screen needs.
- **Use cron for reminders, not always-on workers.** Billing reminders, event reminders, and admin digest jobs fit scheduled Edge Functions well.
- **Prefer CSV export first.** Only add XLSX-specific tooling later if treasurer workflows prove it necessary.

## Sources

- `/vercel/next.js` via Context7 — App Router, Server Actions, auth/data-security guidance
- https://nextjs.org/docs/app/guides/authentication — verified current Next.js 16 authentication/security patterns (last updated 2026-04-10)
- `/supabase/ssr` via Context7 — `createServerClient`, `createBrowserClient`, cookie/session guidance
- https://supabase.com/docs/guides/auth/server-side/nextjs — verified current Next.js SSR auth setup, cookie refresh, and secure claims guidance
- `/supabase/supabase` via Context7 — private storage signed URLs and scheduled Edge Function patterns
- https://supabase.com/docs/guides/functions/schedule-functions — verified `pg_cron` + `pg_net` scheduled invocation pattern
- https://grammy.dev/guide/deployment-types — verified webhook vs polling production tradeoffs
- https://grammy.dev/hosting/supabase — verified grammY deployment path on Supabase Edge Functions
- https://react-hook-form.com/get-started — verified current RHF + schema validation pattern
- https://recharts.github.io/en-US/guide/ — verified current Recharts project/docs availability

---
*Stack research for: neighborhood billing and communication app on existing Next.js + Supabase base*
*Researched: 2026-04-29*
