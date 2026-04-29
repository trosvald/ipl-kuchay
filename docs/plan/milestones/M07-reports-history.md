# Milestone 7 - Reports, CSV, PDF, History, Arrears

Source sections:

- Master plan sections 13.11, 17, 18, 22 Milestone 7.

Goal:

- Reporting exists before Telegram automation.

Files to create/change:

- `features/reports/AdminReportsPage.tsx`
- `features/reports/ArrearsReport.tsx`
- `features/reports/MonthlyReport.tsx`
- `features/reports/ReceiptButton.tsx`
- `features/history/PaymentHistoryPage.tsx`
- `lib/csv.ts`
- `lib/pdf.ts`
- `lib/format.ts`
- App Router route files under `app/admin/*` and `app/app/*`
- optional SQL view for `admin_arrears_view`.

CSV contracts:

Monthly invoice status columns:

```text
period_label,year,month,kavling_code,invoice_number,status,amount_due,amount_paid,outstanding,due_date,paid_at,submission_count,last_submission_status
```

All payments columns:

```text
payment_id,period_label,kavling_code,invoice_number,amount,method,paid_at,verified_by,external_reference,notes
```

PDF contracts:

- `generateReceiptPdf(input: ReceiptPdfInput): Blob`
- `generateMonthlyReportPdf(input: MonthlyReportPdfInput): Blob`
- Blob must be non-empty and downloadable.
- Do not store browser-generated PDFs unless admin explicitly saves metadata.

Tasks:

1. Build payment history per kavling.
2. Build `/admin/reports`.
3. Implement monthly invoice CSV.
4. Implement all payments CSV.
5. Implement arrears CSV/view.
6. Implement PDF receipt.
7. Implement monthly PDF report.
8. Add report metadata write when saved.

Acceptance:

- Admin exports current period CSV.
- Admin exports all payments CSV.
- Admin generates monthly PDF report.
- Paid invoice has receipt PDF.
- Arrears dashboard shows unpaid/overdue totals.
- Resident can only access own receipt/history.

Out of scope:

- Do not add Telegram report sending yet.
- Do not add Midtrans-specific reconciliation reports yet.

Verification:

```bash
npm run typecheck
npm run test
npm run build
```
