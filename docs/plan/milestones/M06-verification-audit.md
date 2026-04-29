# Milestone 6 - Admin Verification Workflow And Audit

Source sections:

- Master plan sections 9.5, 13.10, 20, 21.1, 22 Milestone 6.

Goal:

- Treasurer/admin can approve or reject proof, with correct invoice status and audit trail.

Files to create/change:

- `features/payments/AdminSubmissionsPage.tsx`
- `features/payments/SubmissionReviewModal.tsx`
- `features/payments/ProofPreviewButton.tsx`
- `features/audit/AuditLogPage.tsx` if not already present
- App Router route files under `app/admin/*`
- RPC tests or Edge Function tests for verify/reject.

Route contract:

- `/admin/submissions?tab=pending`
- `/admin/submissions?tab=verified`
- `/admin/submissions?tab=rejected`
- optional `/admin/audit`

Verify behavior:

- Allowed roles: `treasurer`, `admin`, `super_admin`.
- Input: `target_submission_id`, optional admin note.
- Only `submitted` submissions may be verified.
- Inserts one payment with method `manual_transfer`.
- Recalculates invoice status.
- Writes audit log.

Reject behavior:

- Allowed roles: `treasurer`, `admin`, `super_admin`.
- Input: `target_submission_id`, required reason length >= 3.
- Only `submitted` submissions may be rejected.
- Does not delete proof.
- Recalculates invoice status.
- Writes audit log.

Critical corrections to apply:

- Reject only `submitted` submissions.
- Unique payment constraints must prevent double approval.
- Service-role Edge Functions must verify caller JWT and pass explicit actor context.

Tasks:

1. Build `/admin/submissions` with Pending, Verified, Rejected tabs.
2. Add signed proof preview/open action.
3. Approve via `verify_payment_submission`.
4. Reject via `reject_payment_submission` with required reason.
5. Recalculate invoice status and `amount_paid`.
6. Write audit logs.
7. Add placeholder notification hook for Milestone 9.

Acceptance:

- Full approval marks invoice `paid`.
- Partial approval marks invoice `partial`.
- Rejection marks invoice `rejected` only if no valid payment exists.
- Rejection requires reason.
- Duplicate approval cannot create duplicate payment.
- Audit log records approve/reject.
- Admin opening proof uses `get-proof-signed-url`, not a stored public URL.

Out of scope:

- Do not implement Telegram delivery yet; only call placeholder notification hook if present.

Verification:

```bash
npm run typecheck
npm run test
npm run build
```
