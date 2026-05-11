# Panduan Deploy IPL Jatiloka Residence

Panduan ini ditulis untuk pengurus atau teman yang tidak memiliki latar belakang IT. Ikuti langkahnya berurutan. Jangan loncat bagian kecuali tertulis "opsional".

Aplikasi ini terdiri dari dua bagian besar:

- Frontend: tampilan web yang dibuka warga/pengurus. Hosting disarankan di Vercel.
- Backend: database, login, file bukti pembayaran, Edge Functions, dan jadwal Telegram. Semua ini ada di Supabase.

Target deploy produksi:

- Warga bisa login, melihat tagihan, kirim bukti transfer manual, dan cek status.
- Bendahara/admin bisa membuat tagihan, memverifikasi pembayaran, melihat laporan, dan mengirim komunikasi Telegram.
- Dashboard publik tetap hanya menampilkan data agregat, bukan status per kavling.
- Bukti pembayaran tetap private.
- Secret seperti service role key, token Telegram, secret cron, dan Midtrans tidak pernah masuk ke browser atau repository.

## Ringkasan Urutan

1. Siapkan akun dan akses.
2. Pastikan kode di `main` sudah hijau di GitHub Actions.
3. Buat project Supabase produksi.
4. Jalankan migrasi database.
5. Set secret Supabase Edge Functions.
6. Deploy Edge Functions.
7. Siapkan akun super admin pertama.
8. Isi data dasar: rekening bank, biaya IPL, warga, mapping kavling.
9. Hubungkan Telegram bot dan jadwal pengingat.
10. Deploy frontend ke Vercel.
11. Uji alur manual transfer dari awal sampai selesai.
12. QRIS tetap nonaktif kecuali sudah diuji khusus.

## Istilah Singkat

- Repository: tempat kode aplikasi disimpan di GitHub.
- Terminal: aplikasi untuk menjalankan perintah teks. Di macOS namanya Terminal. Di Windows bisa pakai PowerShell.
- Supabase Project Ref: kode unik project Supabase, misalnya `abcdefghijklmnop`.
- Anon key: key Supabase yang boleh dipakai browser karena tetap dilindungi RLS.
- Service role key: key Supabase yang sangat rahasia. Jangan ditaruh di Vercel public env, browser, chat umum, atau GitHub.
- Edge Function: fungsi backend kecil di Supabase, misalnya untuk upload bukti, invite user, Telegram, dan Midtrans.
- Migration: file SQL di `supabase/migrations`. Semua perubahan struktur database harus lewat migration.
- RLS: aturan keamanan Supabase agar warga tidak bisa melihat data warga lain.
- Cron: jadwal otomatis di database, misalnya kirim pengingat Telegram harian.

## Aturan Wajib

1. Jangan menjalankan `supabase db reset` ke database produksi.
   Perintah itu hanya untuk database lokal/testing karena menghapus dan membuat ulang database.

2. Jangan mengubah struktur database produksi langsung dari Table Editor.
   Semua perubahan struktur harus lewat file migration di `supabase/migrations`, lalu `supabase db push`.
   Jangan memakai `supabase-setup.sql`; seluruh perubahan database produksi harus lewat `supabase/migrations`.

3. Jangan menyimpan secret di repository.
   Secret hanya boleh ada di Supabase Secrets, Vercel Environment Variables, atau password manager.

4. Jangan menaruh service role key di Vercel dengan nama `NEXT_PUBLIC_...`.
   Semua env yang dimulai `NEXT_PUBLIC_` akan ikut terbaca browser.

5. Bukti pembayaran harus private.
   Bucket `payment-proofs` dan `report-outputs` harus `public = false`.

6. Manual transfer adalah jalur wajib untuk go-live.
   QRIS boleh tetap mati sampai semua tes Midtrans selesai.

7. Hanya satu orang yang menjalankan `supabase db push` ke produksi pada satu waktu.
   Ini mencegah konflik migration.

## Data Yang Harus Disiapkan

Isi daftar ini sebelum mulai deploy.

```text
GitHub repository:
GitHub branch produksi: main

Supabase project name:
Supabase project ref:
Supabase database password:
Supabase URL:
Supabase anon key:
Supabase service role key:

Vercel project name:
Domain produksi:

Email super admin pertama:
Nama super admin pertama:

Telegram bot token:
Telegram bot username:
Telegram webhook secret:
Internal cron secret:

Nama bank:
Nomor rekening:
Atas nama rekening:

Midtrans server key (opsional QRIS):
Midtrans client key (opsional QRIS):
```

Simpan data ini di password manager, bukan di file repository.

## 1. Persiapan Akun

Pastikan sudah punya:

- Akun GitHub yang bisa membaca repository `trosvald/ipl-kuchay`.
- Akun Supabase.
- Akun Vercel.
- Akses email yang akan menjadi super admin pertama.
- Telegram bot dari BotFather.
- Akun Midtrans hanya jika QRIS akan diaktifkan.

Untuk rollout awal, QRIS boleh dilewati.

## 2. Persiapan Komputer

Bagian ini dilakukan di komputer yang akan dipakai deploy.

1. Buka Terminal.
2. Masuk ke folder project:

```bash
cd /Users/monosense/projects/ipl-jatiloka
```

Jika foldernya berbeda, gunakan folder repository yang benar.

3. Pastikan Node.js, npm, Git, dan Supabase CLI tersedia:

```bash
node -v
npm -v
git --version
supabase --version
```

Jika salah satu perintah tidak dikenali, minta bantuan developer untuk install tool tersebut dulu.

4. Ambil kode terbaru:

```bash
git checkout main
git pull origin main
```

5. Install dependency:

```bash
npm ci
```

## 3. Pastikan Kode Sudah Siap

Sebelum deploy, pastikan GitHub Actions di GitHub sudah hijau:

1. Buka repository GitHub.
2. Klik tab `Actions`.
3. Pilih workflow `CI`.
4. Pastikan run terakhir di branch `main` statusnya hijau/success.

Jika ingin cek dari Terminal:

```bash
gh run list --repo trosvald/ipl-kuchay --branch main --limit 3
```

Jika CI merah/gagal, jangan deploy dulu.

## 4. Tes Lokal Sebelum Deploy

Jalankan perintah ini dari folder project:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

Jika semuanya berhasil, lanjut.

Tes SQL boleh dijalankan jika Supabase lokal siap:

```bash
npm run test:sql
```

Catatan penting:

- `npm run test:sql` menjalankan `supabase db reset --yes`.
- Ini aman untuk database lokal.
- Jangan pernah menambahkan flag project produksi ke perintah reset.

## 5. Buat Project Supabase Produksi

1. Buka Supabase Dashboard.
2. Klik `New project`.
3. Pilih organisasi yang benar.
4. Nama project: contoh `ipl-jatiloka-production`.
5. Region: pilih yang dekat dengan pengguna, misalnya Singapore.
6. Buat database password yang kuat.
7. Simpan password di password manager.
8. Tunggu sampai project selesai dibuat.

Setelah project aktif, catat:

- Project Ref
- Project URL
- Anon key
- Service role key

Lokasi biasanya:

- `Project Settings` -> `API`
- `Project Settings` -> `General`

## 6. Link Supabase CLI Ke Project Produksi

Login ke Supabase dari Terminal:

```bash
supabase login
```

Lalu link folder repository ini ke project produksi:

```bash
supabase link --project-ref <project-ref>
```

Ganti `<project-ref>` dengan project ref Supabase produksi.

Cek daftar migration:

```bash
supabase migration list
```

Jika muncul daftar migration dan project remote benar, lanjut.

## 7. Deploy Database Migration

Sebelum menjalankan migration:

1. Pastikan branch lokal adalah `main`.
2. Pastikan working tree bersih.
3. Pastikan tidak ada orang lain yang sedang menjalankan `supabase db push`.

Cek:

```bash
git status --short --branch
```

Harus menunjukkan `main` dan tidak ada file berubah.

Lalu jalankan:

```bash
supabase db push
```

Jika Supabase bertanya konfirmasi, baca dulu nama project dan migration yang akan dijalankan. Jika benar, lanjutkan.

Jika gagal:

- Jangan panik.
- Jangan coba-coba edit database produksi manual.
- Simpan pesan error.
- Minta developer memeriksa error migration.

## 8. Verifikasi Database Setelah Migration

Buka Supabase Dashboard -> SQL Editor.

Jalankan query berikut:

```sql
select id, public
from storage.buckets
where id in ('payment-proofs', 'report-outputs', 'announcement-assets')
order by id;
```

Hasil yang benar:

- `payment-proofs` -> `public = false`
- `report-outputs` -> `public = false`
- `announcement-assets` -> `public = false`

Verifikasi fungsi audit helper tidak bisa dipanggil browser:

```sql
select
  has_function_privilege(
    'authenticated',
    'public.insert_privileged_audit_log(text,text,text,jsonb,jsonb)',
    'execute'
  ) as authenticated_can_execute,
  has_function_privilege(
    'anon',
    'public.insert_privileged_audit_log(text,text,text,jsonb,jsonb)',
    'execute'
  ) as anon_can_execute,
  has_function_privilege(
    'service_role',
    'public.insert_privileged_audit_log(text,text,text,jsonb,jsonb)',
    'execute'
  ) as service_role_can_execute;
```

Semua harus `false`.

Verifikasi cron job terdaftar:

```sql
select jobname, schedule, command
from cron.job
where jobname in ('daily-resident-reminder', 'monthly-admin-summary')
order by jobname;
```

Harus ada dua job:

- `daily-resident-reminder`
- `monthly-admin-summary`

## 9. Set Supabase Edge Function Secrets

Edge Functions membutuhkan secret agar bisa mengakses database dan layanan luar.

Jalankan dari Terminal:

```bash
supabase secrets set SUPABASE_URL="https://<project-ref>.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="<anon-key>"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

Telegram:

```bash
supabase secrets set TELEGRAM_BOT_TOKEN="<telegram-bot-token>"
supabase secrets set TELEGRAM_BOT_USERNAME="<telegram-bot-username>"
supabase secrets set TELEGRAM_WEBHOOK_SECRET="<random-secret-panjang>"
supabase secrets set APP_INTERNAL_CRON_SECRET="<random-secret-panjang>"
```

Untuk membuat random secret, gunakan password manager. Panjang minimal 32 karakter.

Opsional untuk QRIS:

```bash
supabase secrets set MIDTRANS_SERVER_KEY="<midtrans-server-key>"
supabase secrets set MIDTRANS_CLIENT_KEY="<midtrans-client-key>"
supabase secrets set MIDTRANS_IS_PRODUCTION="true"
```

Cek daftar secret:

```bash
supabase secrets list
```

Jangan menyalin isi secret ke chat umum.

## 10. Deploy Edge Functions

Ada dua jenis Edge Function:

- Fungsi yang dipanggil pengguna login: tetap memakai JWT verification.
- Fungsi webhook/cron: tidak punya login pengguna, jadi deploy dengan `--no-verify-jwt` dan dilindungi secret sendiri.

Deploy fungsi pengguna login:

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
supabase functions deploy send-telegram-notification
```

Deploy fungsi webhook dan cron:

```bash
supabase functions deploy telegram-bot-webhook --no-verify-jwt
supabase functions deploy midtrans-webhook --no-verify-jwt
supabase functions deploy run-scheduled-reminders --no-verify-jwt
supabase functions deploy run-monthly-summary --no-verify-jwt
```

Kenapa ada `--no-verify-jwt`?

- Telegram tidak mengirim token login Supabase.
- Midtrans tidak mengirim token login Supabase.
- Cron database hanya mengirim internal secret.
- Fungsi-fungsi ini tetap aman karena kode memeriksa secret khusus seperti `TELEGRAM_WEBHOOK_SECRET` dan `APP_INTERNAL_CRON_SECRET`.

## 11. Buat Super Admin Pertama

Aplikasi membutuhkan minimal satu `super_admin`.

Cara paling mudah:

1. Buka Supabase Dashboard.
2. Buka `Authentication` -> `Users`.
3. Buat user baru untuk email super admin.
4. Jika Supabase mengirim invite email, buka email tersebut dan set password.
5. Buka SQL Editor.
6. Cari ID user:

```sql
select id, email
from auth.users
where email = lower('<email-super-admin>');
```

7. Jalankan SQL berikut. Ganti email dan nama:

```sql
insert into public.profiles (
  id,
  email,
  full_name,
  display_name,
  role,
  is_active
)
select
  id,
  lower(email),
  'Nama Super Admin',
  'Nama Super Admin',
  'super_admin',
  true
from auth.users
where email = lower('<email-super-admin>')
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  display_name = excluded.display_name,
  role = 'super_admin',
  is_active = true;
```

8. Cek hasil:

```sql
select email, full_name, role, is_active
from public.profiles
where email = lower('<email-super-admin>');
```

Hasil benar:

- `role = super_admin`
- `is_active = true`

## 12. Isi Rekening Bank Untuk Manual Transfer

Manual transfer tidak bisa dipakai warga jika tidak ada rekening aktif.

Jalankan di SQL Editor:

```sql
insert into public.bank_accounts (
  label,
  bank_name,
  account_number,
  account_holder,
  is_default,
  is_active
)
values (
  'Rekening IPL Utama',
  'BCA',
  '1234567890',
  'PAGUYUBAN JATILOKA',
  true,
  true
);
```

Ganti:

- `BCA` dengan nama bank sebenarnya.
- `1234567890` dengan nomor rekening sebenarnya.
- `PAGUYUBAN JATILOKA` dengan nama pemilik rekening sebenarnya.

Cek:

```sql
select label, bank_name, account_number, account_holder, is_default, is_active
from public.bank_accounts
order by created_at desc;
```

## 13. Pastikan QRIS Mati Untuk Launch Awal

Manual transfer adalah jalur utama. QRIS jangan aktif sebelum Midtrans diuji.

Jalankan:

```sql
insert into public.app_settings (key, value, description)
values (
  'payment_gateway',
  '{"enabled": false}'::jsonb,
  'QRIS dimatikan untuk launch awal; manual transfer tetap aktif.'
)
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description;
```

Cek:

```sql
select key, value
from public.app_settings
where key = 'payment_gateway';
```

Hasil benar:

```json
{"enabled": false}
```

## 14. Siapkan Supabase Vault Untuk Cron Telegram

Cron Telegram memanggil Edge Function dari database. Secret untuk panggilan ini harus disimpan di Supabase Vault atau fallback database setting.

Rekomendasi: pakai Supabase Vault.

Buka SQL Editor, jalankan:

```sql
select vault.create_secret(
  'https://<project-ref>.functions.supabase.co',
  'supabase_functions_url'
);

select vault.create_secret(
  '<APP_INTERNAL_CRON_SECRET>',
  'app_internal_cron_secret'
);
```

Ganti:

- `<project-ref>` dengan project ref Supabase.
- `<APP_INTERNAL_CRON_SECRET>` dengan secret yang sama seperti di `supabase secrets set`.

Jika Vault tidak tersedia, gunakan fallback ini:

```sql
alter database postgres
set app.settings.supabase_functions_url = 'https://<project-ref>.functions.supabase.co';

alter database postgres
set app.settings.internal_cron_secret = '<APP_INTERNAL_CRON_SECRET>';
```

Jika memakai fallback, reconnect dashboard/SQL session setelah menjalankan `alter database`.

## 15. Smoke Test Cron Telegram

Tes fungsi pengingat:

```bash
curl -i -X POST \
  "https://<project-ref>.functions.supabase.co/run-scheduled-reminders" \
  -H "x-internal-secret: <APP_INTERNAL_CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d "{}"
```

Tes ringkasan bulanan:

```bash
curl -i -X POST \
  "https://<project-ref>.functions.supabase.co/run-monthly-summary" \
  -H "x-internal-secret: <APP_INTERNAL_CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d "{}"
```

Hasil yang boleh diterima:

- `200 OK` dengan `success: true`.
- Atau pesan "tidak ada penerima" jika belum ada akun Telegram terhubung.

Tes secret salah:

```bash
curl -i -X POST \
  "https://<project-ref>.functions.supabase.co/run-monthly-summary" \
  -H "x-internal-secret: salah" \
  -H "Content-Type: application/json" \
  -d "{}"
```

Hasil benar:

- Tidak boleh sukses.
- Biasanya `401 Unauthorized`.

## 16. Siapkan Telegram Bot

1. Buka Telegram.
2. Chat ke `@BotFather`.
3. Buat bot baru atau gunakan bot yang sudah ada.
4. Catat:
   - bot token
   - bot username

Token bot harus rahasia.

Set webhook Telegram:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<project-ref>.functions.supabase.co/telegram-bot-webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Ganti:

- `<TELEGRAM_BOT_TOKEN>` dengan token bot.
- `<project-ref>` dengan project ref Supabase.
- `<TELEGRAM_WEBHOOK_SECRET>` dengan secret yang sama di Supabase secrets.

Cek webhook:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Hasil benar:

- `url` mengarah ke `telegram-bot-webhook`.
- `last_error_message` kosong atau tidak ada.

Tes manual:

1. Login aplikasi sebagai warga.
2. Buka pengaturan warga.
3. Klik hubungkan Telegram.
4. Ikuti deep link ke bot.
5. Kirim `/start`.
6. Coba `/status`.

Jika gagal, cek:

- Secret `TELEGRAM_BOT_TOKEN`.
- Secret `TELEGRAM_WEBHOOK_SECRET`.
- Deploy `telegram-bot-webhook --no-verify-jwt`.
- Log Edge Function di Supabase Dashboard.

## 17. Deploy Frontend Ke Vercel

1. Buka Vercel.
2. Klik `Add New` -> `Project`.
3. Import repository GitHub `trosvald/ipl-kuchay`.
4. Framework harus terdeteksi sebagai `Next.js`.
5. Production branch: `main`.
6. Build command:

```bash
npm run build
```

7. Install command:

```bash
npm ci
```

8. Tambahkan Environment Variables untuk Production:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Jangan tambahkan ini ke Vercel:

- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `APP_INTERNAL_CRON_SECRET`
- `MIDTRANS_SERVER_KEY`

9. Klik Deploy.
10. Tunggu sampai Vercel memberi URL produksi.

## 18. Set URL Auth Di Supabase

Setelah URL Vercel jadi, buka Supabase Dashboard:

1. Masuk ke `Authentication`.
2. Buka `URL Configuration`.
3. Set `Site URL`:

```text
https://<domain-produksi>
```

4. Tambahkan `Redirect URLs`:

```text
https://<domain-produksi>/login
http://localhost:3000/login
```

`localhost` hanya untuk testing lokal developer. Untuk produksi warga, yang dipakai adalah domain Vercel.

## 19. Uji Login Produksi

1. Buka domain produksi.
2. Login dengan email super admin.
3. Pastikan masuk ke `/admin`.
4. Logout.
5. Coba magic link ke email super admin.
6. Pastikan magic link kembali ke `/login` domain produksi.

Jika magic link mengarah ke domain salah, periksa ulang `Site URL` dan `Redirect URLs` di Supabase.

## 20. Isi Data Operasional Awal

Login sebagai super admin di aplikasi.

Minimal sebelum warga dipakai:

1. Cek daftar kavling.
   Data kavling awal sudah disediakan migration, tapi tetap cek apakah sesuai kondisi lapangan.

2. Cek jenis biaya di `/admin/settings`.
   Pastikan IPL, keamanan, kebersihan, sinking fund, denda, dan biaya lain sesuai keputusan pengurus.

3. Cek rekening tujuan.
   Pastikan rekening bank aktif dan benar.

4. Buat atau import warga.
   Gunakan halaman resident/import jika sudah siap.

5. Mapping warga ke kavling.
   Pastikan satu kavling punya primary resident aktif yang benar.

6. Buat billing period.
   Contoh: Mei 2026.

7. Generate invoice.
   Pastikan jumlah tagihan benar sebelum diumumkan.

8. Minta satu akun warga melakukan uji submit bukti pembayaran.

9. Bendahara/admin verifikasi atau reject dari halaman submissions.

10. Cek audit log.
    Pastikan operasi penting tercatat.

## 21. Uji Manual Transfer Dari Awal Sampai Selesai

Pakai satu akun warga test.

1. Login sebagai warga.
2. Buka halaman tagihan.
3. Pilih invoice yang belum dibayar.
4. Pastikan rekening tujuan tampil.
5. Upload bukti pembayaran kecil, misalnya PDF/JPG test.
6. Submit pembayaran.
7. Login sebagai bendahara/admin.
8. Buka `/admin/submissions`.
9. Buka bukti pembayaran.
10. Verifikasi pembayaran.
11. Cek invoice berubah menjadi paid atau partial sesuai nominal.
12. Cek riwayat pembayaran warga.
13. Cek audit log.

Jika upload bukti gagal:

- Jangan verifikasi manual dari database.
- Cek Edge Function `attach-payment-proof`.
- Cek bucket `payment-proofs`.
- Cek ukuran file. Local config membatasi 5 MiB; produksi sebaiknya ikut batas yang sama.

## 22. Uji Dashboard Publik

Buka domain produksi tanpa login.

Pastikan:

- Tidak terlihat daftar nama warga.
- Tidak terlihat status pembayaran per kavling.
- Yang terlihat hanya ringkasan agregat.
- Tombol login bekerja.

Jika ada data per warga/per kavling di halaman publik, jangan go-live.

## 23. Uji Role Akses

Buat minimal empat akun test:

- resident
- treasurer
- admin
- super_admin

Cek:

- resident hanya masuk `/app`.
- resident tidak bisa membuka `/admin`.
- treasurer bisa melihat area keuangan yang diperlukan.
- admin/super_admin bisa mengelola operasional.
- hanya super_admin yang boleh mengelola role super_admin.

Jika role salah, perbaiki lewat UI admin jika memungkinkan. Untuk super_admin pertama, gunakan SQL hanya sebagai jalur bootstrap/recovery.

## 24. QRIS Opsional

Lewati bagian ini jika QRIS belum dipakai.

QRIS hanya boleh aktif jika:

- Midtrans production sudah siap.
- `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` sudah diset di Supabase secrets.
- `midtrans-webhook` sudah deploy dengan `--no-verify-jwt`.
- Webhook Midtrans mengarah ke:

```text
https://<project-ref>.functions.supabase.co/midtrans-webhook
```

- Signature verification sudah diuji.
- Satu transaksi nominal kecil berhasil reconcile sampai invoice berubah status.

Aktifkan QRIS:

```sql
insert into public.app_settings (key, value, description)
values (
  'payment_gateway',
  '{"enabled": true}'::jsonb,
  'QRIS aktif setelah smoke test Midtrans.'
)
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description;
```

Matikan QRIS lagi:

```sql
insert into public.app_settings (key, value, description)
values (
  'payment_gateway',
  '{"enabled": false}'::jsonb,
  'QRIS dimatikan; manual transfer tetap aktif.'
)
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description;
```

Manual transfer harus tetap bisa berjalan saat QRIS mati.

## 25. Checklist Go-Live

Gunakan checklist ini sebelum mengumumkan ke warga.

```text
[ ] GitHub Actions branch main hijau.
[ ] npm run lint berhasil.
[ ] npm run typecheck berhasil.
[ ] npm run test:unit berhasil.
[ ] npm run test:sql berhasil di database lokal.
[ ] npm run build berhasil.
[ ] supabase db push berhasil ke project produksi.
[ ] Bucket payment-proofs private.
[ ] Bucket report-outputs private.
[ ] Bucket announcement-assets private.
[ ] Edge Functions terdeploy.
[ ] Webhook/cron functions deploy dengan --no-verify-jwt.
[ ] Supabase secrets lengkap.
[ ] Vercel env hanya NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.
[ ] Tidak ada service role key di Vercel public env.
[ ] Supabase Auth Site URL dan Redirect URLs sudah benar.
[ ] Super admin pertama bisa login.
[ ] Rekening transfer aktif sudah ada.
[ ] QRIS mati untuk launch awal, kecuali sudah diuji.
[ ] Telegram webhook valid.
[ ] Cron Telegram bisa dipanggil dengan secret benar.
[ ] Cron Telegram gagal jika secret salah.
[ ] Satu warga test bisa submit bukti pembayaran.
[ ] Admin/bendahara bisa verify/reject bukti.
[ ] Bukti pembayaran tidak bisa dibuka publik.
[ ] Dashboard publik agregat-only.
[ ] Audit log mencatat operasi penting.
[ ] Backup/rollback plan sudah disepakati.
```

## 26. Monitoring Hari Pertama

Pada hari pertama go-live, cek ini beberapa kali:

1. Vercel Dashboard -> Deployments.
   Pastikan tidak ada error baru.

2. Supabase Dashboard -> Edge Functions -> Logs.
   Cek fungsi:
   - `create-payment-submission`
   - `attach-payment-proof`
   - `get-proof-signed-url`
   - `send-telegram-notification`
   - `telegram-bot-webhook`
   - `run-scheduled-reminders`

3. Supabase SQL Editor:

```sql
select status, count(*)
from public.payment_submissions
group by status
order by status;
```

```sql
select status, count(*)
from public.notification_deliveries
group by status
order by status;
```

4. Cek laporan warga:
   - Ada yang tidak bisa login?
   - Ada bukti transfer gagal upload?
   - Ada invoice yang jumlahnya salah?
   - Ada Telegram yang tidak diterima?

Catat semua masalah dalam satu dokumen operasional.

## 27. Jika Ada Masalah

### Warga tidak bisa login

1. Cek email warga di `Authentication` -> `Users`.
2. Cek profile:

```sql
select email, role, is_active
from public.profiles
where email = lower('<email-warga>');
```

3. Pastikan `is_active = true`.
4. Jika magic link salah domain, cek Supabase Auth URL Configuration.

### Warga tidak melihat tagihan

1. Cek mapping kavling:

```sql
select kr.*, p.email, k.code
from public.kavling_residents kr
join public.profiles p on p.id = kr.profile_id
join public.kavlings k on k.id = kr.kavling_id
where p.email = lower('<email-warga>');
```

2. Pastikan mapping aktif dan periode tanggal benar.
3. Cek invoice untuk kavling tersebut.

### Upload bukti pembayaran gagal

1. Cek bucket `payment-proofs` private.
2. Cek log Edge Function:
   - `create-payment-submission`
   - `attach-payment-proof`
   - `cancel-payment-submission`
3. Cek ukuran file.
4. Minta warga coba file JPG/PDF kecil.

### Telegram tidak masuk

1. Cek `getWebhookInfo`.
2. Cek secret `TELEGRAM_WEBHOOK_SECRET`.
3. Cek log `telegram-bot-webhook`.
4. Cek tabel:

```sql
select *
from public.notification_deliveries
order by created_at desc
limit 20;
```

5. Pastikan warga sudah link Telegram dari aplikasi.

### Cron Telegram tidak jalan

1. Cek job:

```sql
select jobname, schedule, active, command
from cron.job
where jobname in ('daily-resident-reminder', 'monthly-admin-summary');
```

2. Cek Vault/fallback setting.
3. Jalankan smoke test curl manual.
4. Cek log `run-scheduled-reminders` dan `run-monthly-summary`.

### Pembayaran salah diverifikasi

Jangan edit `invoices` atau `payments` langsung dari database.

Langkah aman:

1. Catat invoice, warga, nominal, dan bukti.
2. Cek audit log.
3. Jika masih pending, gunakan reject.
4. Jika sudah verified dan perlu koreksi, minta developer/admin senior membuat langkah koreksi dengan audit tertulis.

## 28. Backup Dan Rollback

### Backup sebelum perubahan besar

Sebelum migration besar atau import data besar:

1. Buka Supabase Dashboard.
2. Buka area Backups.
3. Pastikan backup terbaru tersedia.
4. Catat waktu backup.

Jika plan Supabase belum mendukung backup sesuai kebutuhan produksi, jangan go-live penuh sebelum rencana backup disepakati.

### Rollback frontend Vercel

Jika tampilan web rusak:

1. Buka Vercel Dashboard.
2. Pilih project.
3. Buka `Deployments`.
4. Pilih deployment sebelumnya yang sehat.
5. Klik rollback/promote sesuai UI Vercel.

### Rollback Edge Function

Jika satu Edge Function rusak:

1. Cari commit terakhir yang sehat.
2. Checkout commit itu.
3. Deploy ulang function terkait.
4. Kembalikan branch ke `main`.

Contoh:

```bash
git checkout <commit-sehat>
supabase functions deploy <nama-function>
git checkout main
```

Untuk webhook/cron, ingat flag:

```bash
supabase functions deploy <nama-function> --no-verify-jwt
```

### Rollback database

Rollback database tidak boleh dilakukan asal-asalan.

Jika `supabase db push` gagal:

1. Simpan error.
2. Jangan edit table manual.
3. Jangan menjalankan `migration repair` kecuali developer sudah memastikan kondisi database.
4. Hubungi developer.

## 29. Jadwal Operasional Rutin

Harian:

- Cek submission pembayaran pending.
- Cek apakah ada laporan warga gagal upload/login.
- Cek Telegram delivery yang failed.

Mingguan:

- Cek audit log operasi admin.
- Cek invoice overdue.
- Cek backup tersedia.

Bulanan:

- Buat billing period baru.
- Generate invoice.
- Uji satu akun warga setelah invoice dibuat.
- Pastikan pengingat Telegram tidak mengirim pesan salah.
- Export laporan bila diperlukan bendahara.

## 30. Perintah Cepat

Deploy database:

```bash
supabase db push
```

Deploy satu function login:

```bash
supabase functions deploy <nama-function>
```

Deploy satu function webhook/cron:

```bash
supabase functions deploy <nama-function> --no-verify-jwt
```

Cek secrets:

```bash
supabase secrets list
```

Build frontend:

```bash
npm run build
```

Tes lengkap lokal:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:sql
npm run build
```

## 31. Referensi Resmi

- Supabase database migrations: https://supabase.com/docs/guides/deployment/database-migrations
- Supabase Edge Function secrets: https://supabase.com/docs/guides/functions/secrets
- Supabase Edge Function JWT configuration: https://supabase.com/docs/guides/functions/function-configuration
- Supabase scheduled Edge Functions dengan `pg_cron` dan `pg_net`: https://supabase.com/docs/guides/functions/schedule-functions
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Telegram Bot API `setWebhook`: https://core.telegram.org/bots/api#setwebhook

## 32. Catatan Terakhir

Jika ragu, berhenti dulu dan minta review developer. Untuk aplikasi operasional warga, lebih baik deploy terlambat daripada membuka akses dengan secret bocor, bucket publik, atau data tagihan yang salah.
