# IPL Jatiloka Residence

Next.js + TypeScript + Tailwind + shadcn/ui app for IPL Jatiloka Residence.

This codebase currently includes:
- Public dashboard (`/`)
- Login (`/login`)
- Resident portal (`/app`)
- Admin portal (`/admin`)
- Supabase auth provider + role guards

## Local Development

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build and typecheck:

```bash
npm run typecheck
npm run build
```

## Environment

Create `.env.local` with browser-safe values:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-or-publishable-key>"
```

Do not put service role keys, bot tokens, or webhook secrets in browser env files.

## Supabase Local

```bash
npm run supabase:start
npm run supabase:reset
```

## Scripts

- `npm run dev` - run Next.js dev server
- `npm run build` - build production bundle
- `npm run start` - run production server
- `npm run typecheck` - run TypeScript checks
- `npm run lint` - run Next.js lint checks
- `npm run supabase:start` - start local Supabase
- `npm run supabase:stop` - stop local Supabase
- `npm run supabase:reset` - reset local Supabase database
- `npm run functions:serve` - serve Supabase Edge Functions locally
