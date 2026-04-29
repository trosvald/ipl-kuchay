# Milestone 4 - Billing Periods, Fee Types, Invoice Generation

Source sections:

- Master plan sections 4.2, 4.3, 8.2, 9.2, 9.3, 9.4, 13.9, 22 Milestone 4.

Goal:

- Admin can configure fees, create periods, and generate itemized invoices.

Files to create/change:

- `features/settings/FeeTypesPage.tsx`
- `features/settings/FeeTypeForm.tsx`
- `features/settings/FeeOverridesPage.tsx`
- `features/billing/BillingPeriodsPage.tsx`
- `features/billing/BillingPeriodDetailPage.tsx`
- `features/billing/InvoiceDetailPage.tsx`
- `features/billing/ResidentInvoicesPage.tsx`
- `features/dashboard/PublicDashboardPage.tsx`
- `lib/date.ts`
- `lib/format.ts`
- `lib/validation.ts`
- route additions using Next.js App Router in `app/admin/*` and `app/app/*`.

Route contract:

- `/admin/settings` fee type and fee override management.
- `/admin/billing` period list/create/generate.
- `/admin/billing/[periodId]` period detail and invoice status list.
- `/app/invoices` resident invoice list.
- `/app/invoices/[invoiceId]` invoice detail.

Billing contracts:

- Period fields: `year`, `month`, `label`, `due_date`, `status`.
- Generate invoices for active kavlings only.
- Invoice number format: `IPL-{YYYY}-{MM}-{KAVLING_CODE_NORMALIZED}`.
- Invoice total equals sum of active recurring non-penalty fee types, with applicable kavling override selected by period date.
- Public dashboard uses billing periods from DB, never hard-coded year/month arrays.

Critical corrections to apply:

- Use corrected `generate_invoices_for_period` logic.
- No hard-coded month/year arrays.
- Due dates are real dates.

Tasks:

1. Build fee type management in `/admin/settings`.
2. Build fee override UI per kavling.
3. Build `/admin/billing` period creation/open/close/generate.
4. Implement and test invoice generation RPC.
5. Build `/admin/billing/:periodId`.
6. Build resident invoice list and invoice detail.
7. Build public dashboard aggregate from safe public publishing surface.

Acceptance:

- Admin creates April 2026 period with due date `2026-04-30`.
- Invoice count equals active kavling count.
- Invoice amount equals recurring fee total plus overrides.
- Resident sees own itemized invoice only.
- Public dashboard shows aggregate summary without private fields.
- Closed period cannot be normally edited without admin-only audited action.

Out of scope:

- Do not implement payment proof upload yet.
- Do not implement PDF/CSV reports beyond simple display data.

Verification:

```bash
npm run typecheck
npm run test
npm run build
```

Manual SQL:

```sql
select count(*) from public.invoices;
select invoice_number, amount_due from public.invoices limit 5;
```
