# IPL Jatiloka Residence

Telegram-first IPL management app for Jatiloka Residence.

This repository is being rebuilt milestone by milestone from the old React prototype into a secure React, Vite, TypeScript, and Supabase application. Milestone 0 provides only the project baseline and a placeholder public dashboard.

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build and test:

```bash
npm run typecheck
npm run test
npm run build
```

Supabase local database (Milestone 1 schema):

```bash
npm run supabase:start
npm run supabase:reset
```

Manual SQL checks after reset:

```sql
select count(*) from public.kavlings;
select count(*) from public.fee_types;
select id, public from storage.buckets where id in ('payment-proofs', 'report-files');
```

Reference check script: `supabase/tests/sql/m01_acceptance_checks.sql`.

## Scripts

- `npm run dev` - start Vite.
- `npm run build` - typecheck project references and build production assets.
- `npm run preview` - preview the production build.
- `npm run test` - run Vitest tests once.
- `npm run test:watch` - run Vitest in watch mode.
- `npm run test:e2e` - run Playwright tests.
- `npm run lint` - run ESLint.
- `npm run format` - format files with Prettier.
- `npm run typecheck` - run TypeScript without emitting files.
- `npm run supabase:start` - start local Supabase.
- `npm run supabase:stop` - stop local Supabase.
- `npm run supabase:reset` - reset local Supabase database.
- `npm run functions:serve` - serve Supabase Edge Functions with local env.

## Environment

Browser-safe environment values use the `VITE_` prefix. Do not place bot tokens, service role keys, Midtrans server keys, or webhook secrets in browser env files.

Expected browser env values for later milestones:

```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="<anon-or-publishable-key>"
VITE_APP_NAME="IPL Jatiloka Residence"
VITE_PUBLIC_DASHBOARD_MODE="aggregate"
VITE_ENABLE_MIDTRANS_QRIS="false"
VITE_TELEGRAM_BOT_USERNAME="<bot_username_without_at>"
```

## Milestone Status

- Milestone 0: project baseline and tooling.
- Milestone 1: Supabase schema, RLS, private storage buckets, and initial seed data are defined in `supabase/migrations/0001` through `0007`.
- Later milestones add auth, billing UI, private proof upload flow, verification workflow, reports, Telegram, imports, PWA, and optional QRIS.

## Deprecated SQL

`supabase-setup.sql` is intentionally deprecated and kept only as historical reference.
Do not execute it for current environments.
