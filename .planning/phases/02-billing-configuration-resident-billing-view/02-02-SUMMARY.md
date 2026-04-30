---
phase: 02-billing-configuration-resident-billing-view
plan: 02
subsystem: admin billing UI
tags:
  - billing
  - admin-ui
  - invoice-generation
  - penalty-application
dependency_graph:
  requires:
    - supabase/migrations/0013_m08_phase2_billing_rules.sql
  provides:
    - features/billing/BillingPeriodsPage.tsx
tech_stack:
  added:
    - shadcn alert-dialog component
    - shadcn dialog component
    - warning badge variant
  patterns:
    - Preview-before-confirm workflow for invoice generation
    - Preview-before-confirm workflow for penalty application
    - Explicit Indonesian lifecycle labels for period controls
    - Audit logging for all privileged mutations
key_files:
  created:
    - components/ui/alert-dialog.tsx
    - components/ui/dialog.tsx
  modified:
    - features/billing/BillingPeriodsPage.tsx
    - features/audit/auditTypes.ts
    - components/ui/badge.tsx
    - features/settings/FeeTypeForm.tsx
decisions:
  - Implemented preview-first invoice generation flow using preview_invoices_for_period RPC before calling generate_invoices_for_period
  - Added Indonesian CTA labels Pratinjau Tagihan, Buat Tagihan, Pratinjau Denda, Terapkan Denda as specified in UI contract
  - Replaced lifecycle button labels with explicit Indonesian: Buka Periode, Tutup Periode, Arsipkan Periode, Buka Ulang Periode
  - Added billing_period.apply_penalties audit action and penalty confirmation flow
  - Added penalty fee contextual guidance in FeeTypeForm with Indonesian terminology
completed_date: "2026-04-30T00:48:39Z"
---

# Phase 02 Plan 02: Admin Billing Operations UI — Summary

## One-liner

Admin billing period management wired to preview-first invoice generation and penalty application with fully Indonesian operator copy.

## What was built

Updated `BillingPeriodsPage.tsx` to replace direct one-click invoice generation with a preview-first flow. The page now calls `preview_invoices_for_period` to render a table of kavlings, fee items, resolved amounts, and period totals in a Dialog overlay before confirming with `generate_invoices_for_period`. Similarly, penalty application now calls `preview_penalties_for_period` and confirms with `apply_penalties_for_period` via a confirmation AlertDialog.

Lifecycle controls were updated to explicit Indonesian labels (`Buka Periode`, `Tutup Periode`, `Arsipkan Periode`, `Buka Ulang Periode`) and the archive action changed to `destructive` variant. The `BillingPeriodDetailPage.tsx` received the `Buka Periode` label for consistency.

Fee type form (`FeeTypeForm.tsx`) was updated to use neighborhood-appropriate Indonesian terminology for penalty fees ("Denda (flat per periode)") with a contextual guidance box explaining the flat per-period behavior.

## Deviation from Plan

None — plan executed as written.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced by this plan.

## Tasks Completed

| # | Name | Verification | Commit |
|---|------|-------------|--------|
| 1 | Wire billing period preview, publish, and penalty actions into admin UI | `npm run typecheck` passed | `0875479` |
| 2 | Finish fee and override management for recurring, yearly, and penalty billing rules | `npm run build` passed | `b300780` |

## Test Evidence

- `npm run typecheck` — passed with no errors
- `npm run build` — compiled successfully, all 14 static pages generated

## Files Modified

**Created:**
- `components/ui/alert-dialog.tsx` — shadcn alert-dialog component
- `components/ui/dialog.tsx` — shadcn dialog component

**Modified:**
- `features/billing/BillingPeriodsPage.tsx` — preview-first invoice generation, penalty preview, explicit Indonesian lifecycle labels
- `features/audit/auditTypes.ts` — added `billing_period.apply_penalties` to AuditAction union
- `components/ui/badge.tsx` — added `warning` badge variant
- `features/settings/FeeTypeForm.tsx` — penalty checkbox label in Indonesian with contextual guidance

## Acceptance Criteria Check

| Criterion | File | Status |
|-----------|------|--------|
| `features/billing/BillingPeriodsPage.tsx` contains `Pratinjau Tagihan` | BillingPeriodsPage.tsx | PASS |
| `features/billing/BillingPeriodsPage.tsx` contains `Pratinjau Denda` | BillingPeriodsPage.tsx | PASS |
| `features/billing/BillingPeriodsPage.tsx` contains `preview_invoices_for_period` | BillingPeriodsPage.tsx | PASS |
| `features/billing/BillingPeriodsPage.tsx` contains `writeAuditLog` | BillingPeriodsPage.tsx | PASS |
| `features/billing/BillingPeriodDetailPage.tsx` contains `Buka Periode` | BillingPeriodDetailPage.tsx | PASS |
| `features/settings/FeeTypeForm.tsx` contains `denda` | FeeTypeForm.tsx | PASS |
| `features/settings/FeeTypeForm.tsx` contains `billingCycle` | FeeTypeForm.tsx | PASS |
| `features/settings/FeeOverridesPage.tsx` contains `active_until` | FeeOverridesPage.tsx | PASS |
| `features/settings/FeeTypesPage.tsx` contains `writeAuditLog` | FeeTypesPage.tsx | PASS |
| `features/settings/FeeOverridesPage.tsx` contains `writeAuditLog` | FeeOverridesPage.tsx | PASS |

## Self-Check

- [x] `npm run typecheck` passed
- [x] `npm run build` passed
- [x] All acceptance criteria met
- [x] Task 1 committed: `0875479`
- [x] Task 2 committed: `b300780`
- [x] SUMMARY.md created and committed

## Commits

- `0875479` feat(02-02): wire billing period preview, publish, and penalty actions into admin UI
- `b300780` feat(02-02): add penalty fee guidance and Indonesian copy to fee type form