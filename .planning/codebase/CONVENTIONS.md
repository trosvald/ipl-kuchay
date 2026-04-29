# Coding Conventions

**Analysis Date:** 2026-04-29

## Naming Patterns

**Files:**
- Use PascalCase for React feature/component files such as `features/billing/BillingPeriodsPage.tsx` and `features/residents/ResidentForm.tsx`
- Use lowercase or lower camelCase for utility modules such as `lib/supabaseClient.ts`, `lib/validation.ts`, and `features/audit/writeAuditLog.ts`
- Use Next.js reserved route file names in `app/`: `page.tsx`, `layout.tsx`, `not-found.tsx`

**Functions:**
- Use camelCase for helpers and event handlers such as `loadPeriods`, `handleCreate`, `formatRupiah`, and `getSupabaseBrowserClient`
- Prefix event callbacks with `handle` in form-heavy components like `features/billing/BillingPeriodsPage.tsx` and `features/payments/PaymentSubmissionForm.tsx`

**Variables:**
- Use descriptive camelCase names such as `errorMessage`, `pendingByInvoice`, `outstandingAmount`, and `canManageSuperAdmin`
- Use ALL_CAPS only for constants, for example `APP_NAME` in `lib/constants.ts` and `PAYMENT_PROOF_MAX_SIZE_BYTES` in `lib/storage.ts`

**Types:**
- Use PascalCase for interfaces and exported types such as `Profile`, `BillingPeriodRow`, `AuditLogInput`, and `PaymentProofMimeType`
- Use union literals for domain enums in TS when mirroring SQL roles/statuses, for example `AppRole` in `features/auth/AuthProvider.tsx`

## Code Style

**Formatting:**
- Formatter config file is not detected
- Source formatting is consistent with 2-space indentation, semicolons, trailing commas, and double quotes, as seen in `features/auth/AuthProvider.tsx` and `lib/validation.ts`

**Linting:**
- ESLint is installed through `eslint` and `eslint-config-next` in `package.json`
- No custom ESLint config file is present; rely on Next.js defaults unless a config is added

## Import Organization

**Order:**
1. Framework and third-party imports, for example `react`, `next/*`, `lucide-react`, `zod`
2. Internal `@/components`, `@/features`, and `@/lib` imports
3. Relative imports when used, for example `./providers` in `app/layout.tsx`

**Path Aliases:**
- Use `@/*` for repo-root imports, configured in `tsconfig.json`

## Error Handling

**Patterns:**
- Keep request failures in component state via `const [errorMessage, setErrorMessage] = useState<string | null>(null)` and render inline alerts, as in `features/billing/ResidentInvoicesPage.tsx`
- Return early on missing client/session/profile conditions, as in `features/payments/PaymentSubmissionForm.tsx` and `features/residents/ResidentListPage.tsx`
- In Edge Functions, parse input manually and throw `HttpError`, then map that to JSON in the outer `serve` handler, as in `supabase/functions/create-payment-submission/index.ts`

## Logging

**Framework:** audit-log RPC plus limited `console.warn`

**Patterns:**
- Use `writeAuditLog` or direct audit inserts for admin-side mutations, for example `features/audit/writeAuditLog.ts` and `supabase/migrations/0011_m06_verification_audit.sql`
- Use `console.warn` only for non-fatal local configuration issues, as in `lib/supabaseClient.ts`

## Comments

**When to Comment:**
- Comments are sparse in app code
- Use comments mainly for environment/runtime quirks, such as the Deno import note in `supabase/functions/*/index.ts`

**JSDoc/TSDoc:**
- Not used

## Function Design

**Size:**
- Simple shared helpers stay small in `lib/*.ts`
- Page components are allowed to be large and contain load/mutate/render logic together, such as `features/billing/BillingPeriodsPage.tsx` and `features/payments/AdminSubmissionsPage.tsx`

**Parameters:**
- Prefer typed object parameters for multi-field helpers, for example `buildPaymentProofPath(input)` in `lib/storage.ts` and `writeAuditLog(payload)` in `features/audit/writeAuditLog.ts`
- Prefer typed event parameters for form handlers, for example `FormEvent<HTMLFormElement>`

**Return Values:**
- Helpers usually return explicit primitives or nullable values, such as `string | null` and `Date | null`
- Guard-style functions return early instead of nesting deeply

## Module Design

**Exports:**
- Prefer named exports across the codebase, for example `export function BillingPeriodsPage()` and `export const billingPeriodFormSchema = ...`
- Default exports are mostly reserved for Next.js route/layout files in `app/`

**Barrel Files:**
- Not detected

## Prescriptive Patterns to Match

- Put route logic in `features/**` and keep `app/**/page.tsx` thin
- Reuse `@/*` imports instead of long relative paths
- Validate form payloads with `zod` schemas from `lib/validation.ts`
- Keep admin mutations auditable through `features/audit/writeAuditLog.ts` or the SQL audit functions

---

*Convention analysis: 2026-04-29*
