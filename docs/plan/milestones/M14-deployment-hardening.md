# Milestone 14 - Deployment, Hardening, Production Handover

Source sections:

- Master plan sections 21, 23, 24, 25, 28, 22 Milestone 14.

Goal:

- App can be handed to neighborhood admins without hidden footguns.

Files to create/change:

- `DEPLOYMENT.md`
- `docs/SECURITY.md`
- `docs/DATA_DICTIONARY.md`
- `docs/TELEGRAM_BOT_SETUP.md`
- `docs/MIDTRANS_QRIS_SETUP.md`
- `README.md`
- admin user guide, either in `docs/ADMIN_GUIDE.md` or `README.md`.

Deployment doc must include:

- Supabase project setup.
- Migration execution.
- Private bucket verification.
- Edge Function deployment.
- Secret setup.
- Telegram webhook setup.
- Vercel environment variables.
- Midtrans sandbox/production switch.
- Backup/export routine.
- First super-admin setup.

Security doc must include:

- Role matrix.
- RLS overview.
- Proof file privacy.
- Telegram webhook/linking security.
- Midtrans webhook security.
- Incident checklist for leaked link/key/wrong payment.

Tasks:

1. Write `DEPLOYMENT.md`.
2. Write `docs/SECURITY.md`.
3. Write `docs/DATA_DICTIONARY.md`.
4. Complete admin user guide.
5. Run full test suite.
6. Run repo scan for dangerous strings/patterns.
7. Build production bundle.
8. Verify Edge Function deployment and Telegram webhook setup.
9. Verify backup/export routine.

Acceptance:

- Typecheck, tests, lint, build pass.
- `supabase db reset` passes.
- Edge Functions deploy.
- Manual payment end-to-end works.
- Telegram notifications work.
- QRIS sandbox works if enabled.
- Docs are usable by non-developer admin.
- Production checklist is explicit about what must be tested before sharing link with residents.

Out of scope:

- Do not add new product features in hardening unless required to close a security, deployment, or handover gap.
- Do not enable production Midtrans until sandbox testing and admin approval are documented.
- Do not share the resident link until the final release checklist passes.

Verification:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
supabase db reset
grep -Rni "ADMIN_PIN\|getPublicUrl(.*payment-proofs\|whatsapp\|wa.me\|group wa" . --exclude-dir=node_modules --exclude-dir=.git --exclude="CODEx_MASTER_PLAN*.md" || true
```
