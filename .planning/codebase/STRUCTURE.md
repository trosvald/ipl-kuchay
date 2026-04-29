# Codebase Structure

**Analysis Date:** 2026-04-29

## Directory Layout

```text
[project-root]/
├── app/                 # Next.js App Router routes, layouts, providers, and global CSS
├── components/ui/       # Shared UI primitives
├── features/            # Feature-oriented page implementations and shells
├── lib/                 # Shared client utilities and unit tests
├── supabase/            # Database migrations, SQL tests, local config, and Edge Functions
├── package.json         # npm scripts and dependencies
├── tsconfig.json        # TypeScript config and path alias
└── vitest.config.ts     # Unit test config
```

## Directory Purposes

**`app/`:**
- Purpose: map URLs to page entry points and route-specific layouts
- Contains: `page.tsx`, `layout.tsx`, `not-found.tsx`, `providers.tsx`, `globals.css`
- Key files: `app/layout.tsx`, `app/page.tsx`, `app/admin/layout.tsx`, `app/app/layout.tsx`

**`features/`:**
- Purpose: keep real page logic outside route files
- Contains: domain folders such as `auth/`, `billing/`, `payments/`, `residents/`, `kavlings/`, `settings/`, `audit/`, `layout/`
- Key files: `features/auth/AuthProvider.tsx`, `features/billing/BillingPeriodsPage.tsx`, `features/payments/AdminSubmissionsPage.tsx`

**`components/ui/`:**
- Purpose: reusable UI building blocks
- Contains: composable primitives such as buttons, inputs, cards, badges, separators, tables
- Key files: `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/table.tsx`

**`lib/`:**
- Purpose: cross-feature helpers and tests
- Contains: formatting, date helpers, validation, storage rules, Supabase client factory, utility functions, `__tests__/`
- Key files: `lib/supabaseClient.ts`, `lib/validation.ts`, `lib/storage.ts`, `lib/__tests__/validation.test.ts`

**`supabase/`:**
- Purpose: backend source of truth for schema and privileged runtime pieces
- Contains: `migrations/`, `functions/`, `tests/sql/`, `config.toml`
- Key files: `supabase/migrations/0002_tables.sql`, `supabase/migrations/0005_rls_policies.sql`, `supabase/functions/admin-invite-user/index.ts`

## Key File Locations

**Entry Points:**
- `app/page.tsx`: public dashboard route
- `app/login/page.tsx`: login route
- `app/app/page.tsx`: resident home route
- `app/admin/page.tsx`: admin dashboard route
- `supabase/functions/*/index.ts`: Edge Function HTTP entry points

**Configuration:**
- `package.json`: scripts and dependencies
- `tsconfig.json`: strict TS settings and `@/*` alias
- `next.config.ts`: Next.js runtime config
- `vitest.config.ts`: unit test config
- `supabase/config.toml`: local Supabase ports and auth/storage settings

**Core Logic:**
- `features/auth/`: auth session and route guards
- `features/billing/`: invoice list, invoice detail, billing period management
- `features/payments/`: submission create/review/proof flows
- `supabase/migrations/`: billing, RLS, audit, and status logic

**Testing:**
- `lib/__tests__/`: Vitest unit tests
- `supabase/tests/sql/`: SQL acceptance and regression checks

## Naming Conventions

**Files:**
- Route files use Next.js names: `page.tsx`, `layout.tsx`, `not-found.tsx`
- Feature components use PascalCase file names: `ResidentInvoicesPage.tsx`, `AdminSubmissionsPage.tsx`
- Shared utility files use lower camel or lowercase names: `supabaseClient.ts`, `validation.ts`, `storage.ts`
- Test files use `*.test.ts`: `lib/__tests__/storage.test.ts`

**Directories:**
- Top-level domain folders are lowercase plural or lowercase feature names: `features/payments/`, `features/residents/`, `supabase/functions/`

## Where to Add New Code

**New route-backed feature:**
- Primary code: create the page implementation in `features/<domain>/` and keep the route stub in `app/**/page.tsx`
- Tests: put pure helper tests in `lib/__tests__/` if logic can be extracted; SQL behavior belongs in `supabase/tests/sql/`

**New component/module:**
- Implementation: shared UI primitive in `components/ui/`; page/domain-specific component beside related feature files in `features/<domain>/`

**Utilities:**
- Shared helpers: `lib/`
- Auth-aware or privileged backend helpers: `supabase/functions/_shared/` or SQL functions in `supabase/migrations/`

## Special Directories

**`supabase/functions/_shared/`:**
- Purpose: shared Edge Function auth, response, and client helpers
- Generated: No
- Committed: Yes

**`lib/__tests__/`:**
- Purpose: Vitest coverage for pure utility functions
- Generated: No
- Committed: Yes

**`supabase/tests/sql/`:**
- Purpose: CLI-driven SQL verification scripts
- Generated: No
- Committed: Yes

**`.next/`:**
- Purpose: Next.js build/dev output
- Generated: Yes
- Committed: No

## Notable Gaps / Unknowns

- `tsconfig.json` excludes `supabase` and `src`, so the main TypeScript program is centered on app code and not the Edge Functions
- No `src/` directory is used even though `tsconfig.json` explicitly excludes it
- No dedicated server-only application directory exists; privileged behavior is split between SQL functions and `supabase/functions/`

---

*Structure analysis: 2026-04-29*
