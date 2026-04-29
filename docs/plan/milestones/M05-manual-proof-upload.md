# Milestone 5 - Manual Transfer And Private Proof Upload

Source sections:

- Master plan sections 11, 13.5, 21.2, 22 Milestone 5.

Goal:

- Residents can submit manual transfer proof safely; proofs stay private.

Files to create/change:

- `features/payments/PaymentSubmissionForm.tsx`
- `features/payments/SubmissionHistory.tsx`
- `features/billing/InvoiceDetailPage.tsx`
- `lib/validation.ts`
- `lib/storage.ts` if useful
- `supabase/functions/get-proof-signed-url/index.ts`
- optional `supabase/functions/create-payment-submission/index.ts`
- optional `supabase/functions/attach-payment-proof/index.ts`
- `supabase/functions/_shared/auth.ts`
- `supabase/functions/_shared/responses.ts`

Submission contract:

```json
{
  "invoiceId": "uuid",
  "amountSubmitted": 350000,
  "bankAccountId": "uuid",
  "note": "optional max 500 chars"
}
```

Proof metadata contract:

```json
{
  "submissionId": "uuid",
  "proofPath": "proofs/{auth_uid}/{invoice_id}/{submission_id}.{ext}",
  "mimeType": "image/jpeg",
  "sizeBytes": 123456
}
```

Signed URL request:

```json
{
  "submissionId": "uuid"
}
```

Signed URL response:

```json
{
  "signedUrl": "https://...",
  "expiresInSeconds": 300
}
```

Critical corrections to apply:

- Prefer RPC/Edge Function workflow over direct table mutation.
- Validate amount against outstanding balance.
- Submission starts as `submitted`; invoice becomes `pending_verification`.
- If upload fails, cancel/delete the submission so no broken pending row remains.
- Never use `getPublicUrl` for proof files.
- Resident proof MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- Proof max size: 5 MB.

Tasks:

1. Build payment submission form on invoice detail.
2. Validate amount, MIME type, and max 5 MB proof size.
3. Create submission through controlled workflow.
4. Upload to `payment-proofs/proofs/{auth_uid}/{invoice_id}/{submission_id}.{ext}`.
5. Attach proof metadata.
6. Recalculate invoice status.
7. Implement `get-proof-signed-url`.
8. Add resident submission history.

Acceptance:

- Resident sees `Menunggu verifikasi` after upload.
- Admin sees pending submission.
- Public URL cannot open proof.
- Admin can open 300-second signed URL.
- Resident cannot submit or open neighbor proof.
- Broken upload cleanup leaves no pending submission with missing proof.

Out of scope:

- Do not implement approve/reject UI yet.
- Do not send real Telegram messages yet; placeholder hooks are acceptable only if needed.

Verification:

```bash
npm run typecheck
npm run test
npm run build
grep -Rni "getPublicUrl" app components features lib supabase/functions || true
```
