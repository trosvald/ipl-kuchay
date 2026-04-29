# Testing Patterns

**Analysis Date:** 2026-04-29

## Test Framework

**Runner:**
- Vitest `^4.0.2`
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect`

**Run Commands:**
```bash
npm run test              # Run unit tests and SQL checks
npm run test:unit:watch   # Watch mode for Vitest
npm run test:unit         # Run unit tests only
```

## Test File Organization

**Location:**
- Unit tests are separate from feature code under `lib/__tests__/`
- SQL verification lives under `supabase/tests/sql/`

**Naming:**
- Use `*.test.ts` for Vitest files, such as `lib/__tests__/validation.test.ts`
- Use milestone-style SQL filenames for DB checks, such as `supabase/tests/sql/m01_acceptance_checks.sql`

**Structure:**
```text
lib/__tests__/*.test.ts
supabase/tests/sql/*.sql
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from "vitest";

describe("validation schemas", () => {
  it("accepts valid payment submission payload", () => {
    const result = paymentSubmissionFormSchema.safeParse({
      invoiceId: "11111111-1111-4111-8111-111111111111",
      amountSubmitted: 100000,
      bankAccountId: "22222222-2222-4222-8222-222222222222",
      note: "transfer pagi",
    });

    expect(result.success).toBe(true);
  });
});
```

**Patterns:**
- Keep tests focused on pure helper behavior, as in `lib/__tests__/format.test.ts` and `lib/__tests__/storage.test.ts`
- Use explicit inline fixtures rather than shared factories
- Assert success/failure booleans or exact helper outputs

## Mocking

**Framework:**
- No mocking framework usage detected

**Patterns:**
```typescript
expect(isAllowedPaymentProofMimeType("application/pdf")).toBe(true);
expect(buildPaymentProofPath({
  authUserId: "user-1",
  invoiceId: "inv-2",
  submissionId: "sub-3",
  mimeType: "application/pdf",
})).toBe("proofs/user-1/inv-2/sub-3.pdf");
```

**What to Mock:**
- Not established in current tests

**What NOT to Mock:**
- Pure utility functions in `lib/*.ts` are tested directly without mocks

## Fixtures and Factories

**Test Data:**
```typescript
const result = billingPeriodFormSchema.safeParse({
  year: 2026,
  month: 7,
  due_date: "2026-07-31",
  label: "Juli 2026",
});
```

**Location:**
- Fixtures are inline inside each test file; no shared fixture directory detected

## Coverage

**Requirements:**
- None enforced; no coverage threshold config detected

**View Coverage:**
```bash
Not configured in package.json or vitest.config.ts
```

## Test Types

**Unit Tests:**
- Cover pure validation, formatting, and storage helpers in `lib/__tests__/validation.test.ts`, `lib/__tests__/format.test.ts`, and `lib/__tests__/storage.test.ts`

**Integration Tests:**
- Database behavior is verified with Supabase CLI SQL scripts executed by `package.json` `test:sql`

**E2E Tests:**
- Not used

## Common Patterns

**Async Testing:**
```typescript
Not detected in current Vitest files
```

**Error Testing:**
```typescript
it("rejects non-positive payment amount", () => {
  const result = paymentSubmissionFormSchema.safeParse({
    invoiceId: "11111111-1111-4111-8111-111111111111",
    amountSubmitted: 0,
    bankAccountId: "22222222-2222-4222-8222-222222222222",
    note: "",
  });

  expect(result.success).toBe(false);
});
```

## Notable Gaps / Unknowns

- No React component tests detected for `features/**`
- No direct tests detected for Edge Functions in `supabase/functions/**`
- No automated browser E2E coverage for login, billing, submission upload, or admin review flows

---

*Testing analysis: 2026-04-29*
