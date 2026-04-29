# Milestone 10 - Bulk Import

Source sections:

- Master plan sections 16, 20, 22 Milestone 10.

Goal:

- Admin can import operational data safely from CSV.

Files to create/change:

- `features/imports/AdminImportPage.tsx`
- `features/imports/importSchemas.ts`
- `features/imports/importSamples.ts`
- `features/imports/ImportPreviewTable.tsx`
- `lib/csv.ts`
- `supabase/functions/apply-import-job/index.ts` or admin-only RPCs
- tests for CSV validators.

Import types:

- `kavlings`
- `residents`
- `kavling_resident_mapping`
- `fee_overrides`
- `opening_balances`

CSV sample headers:

```text
code,block,sort_order,active,notes
email,full_name,display_name,phone,role,is_active
kavling_code,email,relation,is_primary,active
kavling_code,fee_code,amount,active_from,active_until,notes
kavling_code,year,month,fee_code,amount_due,amount_paid,status,notes
```

Apply contract:

- Client parses and validates.
- Server revalidates before applying.
- Writes `import_jobs` with counts, errors, preview rows, creator, status.
- Invalid rows are not applied.
- Sensitive role imports require `super_admin`.

Tasks:

1. Implement sample CSV downloads.
2. Parse CSV client-side with PapaParse.
3. Validate each import type with Zod.
4. Build preview UI with row-level errors.
5. Apply imports through admin-only RPC/Edge Function.
6. Write `import_jobs` records.
7. Write audit logs.

Acceptance:

- Admin imports kavlings, residents, mappings, and fee overrides.
- Invalid rows are shown and not applied.
- Import can be cancelled before apply.
- Only super_admin can import admin/super_admin roles.
- Import apply writes audit log.

Out of scope:

- Do not add spreadsheet integrations.
- Do not bypass server-side validation just because client validation passed.

Verification:

```bash
npm run typecheck
npm run test
npm run build
```
