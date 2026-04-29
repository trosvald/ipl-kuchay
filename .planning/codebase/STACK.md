# Technology Stack

**Analysis Date:** 2026-04-29

## Languages

**Primary:**
- TypeScript - application code in `app/**/*.tsx`, `features/**/*.tsx`, `lib/**/*.ts`, and `supabase/functions/**/*.ts`
- SQL (PostgreSQL / Supabase) - schema, RLS, RPCs, and seed data in `supabase/migrations/*.sql` and `supabase/tests/sql/*.sql`

**Secondary:**
- CSS - global styling and theme tokens in `app/globals.css`
- TOML - local Supabase configuration in `supabase/config.toml`

## Runtime

**Environment:**
- Node.js runtime for the Next.js app (version not pinned; no `.nvmrc` or `.node-version` detected)
- Deno-compatible runtime for Supabase Edge Functions in `supabase/functions/*/index.ts`

**Package Manager:**
- npm - scripts and dependency management in `package.json`
- Lockfile: present in `package-lock.json`

## Frameworks

**Core:**
- Next.js `^16.2.4` - App Router UI and routing from `app/`
- React `^19.2.5` - client components across `features/**/*.tsx`
- Supabase JS `^2.105.1` - browser client in `lib/supabaseClient.ts`

**Testing:**
- Vitest `^4.0.2` - unit tests in `lib/__tests__/*.test.ts`
- Supabase CLI SQL checks - database acceptance tests via `package.json` `test:sql`

**Build/Dev:**
- TypeScript `^6.0.3` - strict typing in `tsconfig.json`
- Tailwind CSS `^4.2.4` - utility styling from `app/globals.css`
- PostCSS with `@tailwindcss/postcss` - config in `postcss.config.mjs`
- ESLint `^9.39.1` with `eslint-config-next` - lint dependency present in `package.json`

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` `^2.105.1` - auth, database, RPC, storage, and Edge Function invocation across `features/**` and `lib/supabaseClient.ts`
- `zod` `^4.3.6` - form and payload validation in `lib/validation.ts`
- `date-fns` `^4.1.0` - Indonesian date formatting in `lib/date.ts` and `lib/format.ts`

**UI/Infrastructure:**
- `@radix-ui/react-slot` `^1.2.4` - polymorphic UI primitives in `components/ui/button.tsx`
- `class-variance-authority` `^0.7.1` - component variants in `components/ui/button.tsx`
- `clsx` `^2.1.1` and `tailwind-merge` `^3.5.0` - class composition in `lib/utils.ts`
- `lucide-react` `^1.12.0` - icon set across `features/**/*.tsx`

## Configuration

**Environment:**
- Browser app requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, read in `lib/supabaseClient.ts`
- Supabase Edge Functions require server-side secrets such as `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`, read in `supabase/functions/_shared/supabase.ts`
- `.env.local` and `.env.example` are present but not read

**Build:**
- `tsconfig.json` sets `strict: true`, `baseUrl: "."`, and `@/*` aliasing
- `next.config.ts` enables `reactStrictMode` and sets `allowedDevOrigins`
- `vitest.config.ts` aliases `@` to repo root and limits tests to `lib/__tests__/**/*.test.ts`
- `postcss.config.mjs` enables Tailwind CSS PostCSS plugin

## Platform Requirements

**Development:**
- Next.js app served with `npm run dev`
- Supabase local stack expected for database work via `npm run supabase:start` and `npm run supabase:reset`
- Supabase CLI required for SQL tests and local functions, referenced in `package.json`

**Production:**
- Hosting target for the web app is not declared in code, but `PANDUAN-DEPLOY.md` documents Vercel for the frontend and Supabase for backend services
- External dependencies assume hosted Supabase project for auth, Postgres, storage, and Edge Functions

---

*Stack analysis: 2026-04-29*
