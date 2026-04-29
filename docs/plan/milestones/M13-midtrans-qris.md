# Milestone 13 - Midtrans QRIS Payment Gateway

Source sections:

- Master plan sections 15, 21.4, 22 Milestone 13.

Goal:

- Optional QRIS payment automation works in sandbox behind feature flag.

Files to create/change:

- `supabase/functions/create-qris-payment/index.ts`
- `supabase/functions/midtrans-webhook/index.ts`
- `supabase/functions/reconcile-payment-gateway/index.ts`
- `supabase/functions/_shared/midtrans.ts`
- `features/payments/QrisPaymentPanel.tsx`
- update invoice detail UI
- `docs/MIDTRANS_QRIS_SETUP.md`
- tests for signature verification and idempotency.

Create QRIS request:

```json
{
  "invoiceId": "uuid"
}
```

Create QRIS response:

```json
{
  "provider": "midtrans",
  "providerOrderId": "IPL-202604-KAV1-abc123-171...",
  "status": "created",
  "paymentType": "qris",
  "qrString": "optional",
  "qrImageUrl": "optional"
}
```

Webhook contract:

- `verify_jwt = false`.
- Accept only POST.
- Verify Midtrans signature: `sha512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)`.
- `settlement` creates payment.
- `capture` creates payment only when `fraud_status` is missing or `accept`.
- denied/cancelled/expired/failure never mark paid.

Critical corrections to apply:

- Server key never appears in frontend.
- Webhook idempotency relies on DB uniqueness for external references.
- Existing pending transaction for same invoice should be reused until expiry.

Tasks:

1. Add `docs/MIDTRANS_QRIS_SETUP.md`.
2. Implement shared Midtrans client.
3. Implement `create-qris-payment`.
4. Implement `midtrans-webhook` signature verification.
5. Add gateway transaction UI in invoice detail.
6. Add payment status polling/manual refresh.
7. Implement `reconcile-payment-gateway`.
8. Send Telegram paid notification.
9. Add sandbox test instructions.

Acceptance:

- Feature flag off leaves manual-transfer flow unchanged.
- Feature flag on with sandbox keys generates QRIS for outstanding amount.
- Settlement/capture-accepted marks invoice paid.
- Duplicate webhook does not create duplicate payment.
- Failed/expired/denied does not mark paid.
- QRIS amount always equals outstanding amount, never resident input.

Verification:

```bash
npm run typecheck
npm run test
npm run build
grep -Rni "MIDTRANS_SERVER_KEY" app components features lib || true
```

Out of scope:

- Do not switch production Midtrans on without deployment checklist approval.
