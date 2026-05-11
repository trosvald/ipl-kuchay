# Panduan Deploy IPL Jatiloka Residence

Panduan ini untuk rollout produksi aplikasi Next.js + Supabase. Jangan memakai `supabase-setup.sql`; seluruh perubahan database harus lewat `supabase/migrations`.

## Prinsip Wajib

- Bukti pembayaran dan artefak laporan harus berada di bucket private: `payment-proofs` dan `report-outputs`.
- Browser hanya boleh memakai `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Secret server seperti service role key, token Telegram, secret webhook, secret cron, dan secret Midtrans tidak boleh masuk ke browser, repository, atau Vercel public env.
- Transfer manual harus berfungsi penuh sebelum QRIS diaktifkan.
- QRIS tetap nonaktif sampai webhook Midtrans, signature verification, dan RPC hardening sudah terdeploy dan lolos smoke test.

## 1. Supabase Project

1. Buat project Supabase produksi di region terdekat, misalnya Singapore.
2. Simpan database password di password manager.
3. Hubungkan CLI ke project produksi:

```bash
supabase login
supabase link --project-ref <project-ref>
```

4. Terapkan migrasi dari repository:

```bash
supabase db push
```

5. Verifikasi bucket private:

```sql
select id, public
from storage.buckets
where id in ('payment-proofs', 'report-outputs');
```

Kedua baris harus bernilai `public = false`.

## 2. Edge Functions

Deploy semua Edge Function yang dipakai aplikasi:

```bash
supabase functions deploy admin-invite-user
supabase functions deploy attach-payment-proof
supabase functions deploy cancel-payment-submission
supabase functions deploy create-payment-submission
supabase functions deploy create-qris-transaction
supabase functions deploy generate-report-output
supabase functions deploy get-proof-signed-url
supabase functions deploy get-report-output-signed-url
supabase functions deploy import-apply
supabase functions deploy import-preview
supabase functions deploy link-telegram-account
supabase functions deploy midtrans-webhook
supabase functions deploy run-monthly-summary
supabase functions deploy run-scheduled-reminders
supabase functions deploy send-telegram-notification
supabase functions deploy telegram-bot-webhook
```

Set secret server-side:

```bash
supabase secrets set SUPABASE_URL="https://<project-ref>.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="<anon-key>"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
supabase secrets set TELEGRAM_BOT_TOKEN="<bot-token>"
supabase secrets set TELEGRAM_BOT_USERNAME="<bot-username>"
supabase secrets set TELEGRAM_WEBHOOK_SECRET="<random-secret>"
supabase secrets set APP_INTERNAL_CRON_SECRET="<random-secret>"
```

Set secret Midtrans hanya jika QRIS akan diaktifkan:

```bash
supabase secrets set MIDTRANS_SERVER_KEY="<server-key>"
supabase secrets set MIDTRANS_CLIENT_KEY="<client-key>"
supabase secrets set MIDTRANS_IS_PRODUCTION="true"
```

## 3. Scheduled Telegram Jobs

Migrasi menjadwalkan `daily-resident-reminder` dan `monthly-admin-summary` lewat `pg_cron`. Job ini memanggil Edge Functions melalui `public.invoke_internal_edge_function(...)`, yang membutuhkan konfigurasi private di database.

Rekomendasi produksi adalah Supabase Vault:

```sql
select vault.create_secret('https://<project-ref>.functions.supabase.co', 'supabase_functions_url');
select vault.create_secret('<APP_INTERNAL_CRON_SECRET>', 'app_internal_cron_secret');
```

Fallback jika Vault tidak tersedia:

```sql
alter database postgres set app.settings.supabase_functions_url = 'https://<project-ref>.functions.supabase.co';
alter database postgres set app.settings.internal_cron_secret = '<APP_INTERNAL_CRON_SECRET>';
```

Setelah konfigurasi, verifikasi cron:

```sql
select jobname, schedule, command
from cron.job
where jobname in ('daily-resident-reminder', 'monthly-admin-summary');
```

Smoke test manual:

```bash
curl -i -X POST \
  "https://<project-ref>.functions.supabase.co/run-scheduled-reminders" \
  -H "x-internal-secret: <APP_INTERNAL_CRON_SECRET>"
```

Request tanpa secret atau dengan secret salah harus gagal.

## 4. Telegram Webhook

Daftarkan webhook Telegram ke Edge Function:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<project-ref>.functions.supabase.co/telegram-bot-webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Verifikasi:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Pastikan URL benar dan tidak ada error terakhir.

## 5. Vercel Frontend

Import repository ke Vercel sebagai Next.js app. Set environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Jangan set service role key, token Telegram, atau secret cron di Vercel public env.

Build command:

```bash
npm run build
```

## 6. Checklist Sebelum Go-Live

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:sql` pada database disposable
- `npm run build`
- Bucket `payment-proofs` dan `report-outputs` private.
- Edge Functions terdeploy dan secret lengkap.
- Telegram webhook valid.
- Scheduled reminders dan monthly summary berhasil dipanggil dengan secret benar.
- QRIS disabled kecuali seluruh smoke test Midtrans sudah selesai.
- Akun super admin awal tersedia dan jalur recovery admin sudah diketahui pengurus.

## 7. Backup, Rollback, dan Operasional

- Aktifkan backup Supabase sesuai kebutuhan rollout.
- Sebelum migrasi besar, ambil backup manual dari dashboard Supabase.
- Jika deploy frontend bermasalah, rollback ke deployment Vercel sebelumnya.
- Jika Edge Function bermasalah, deploy ulang function terakhir yang sehat.
- Jika reminder Telegram gagal, cek `notification_deliveries`, logs Edge Function, dan status webhook Telegram.
- Jika warga salah submit pembayaran, gunakan alur reject/verify di halaman admin agar audit dan status invoice tetap konsisten.
- Jika admin terkunci, gunakan akun super admin cadangan atau update role lewat SQL console dengan jejak operasional tertulis.
