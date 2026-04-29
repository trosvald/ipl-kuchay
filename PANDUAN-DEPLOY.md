# 🏘️ Panduan Deploy IPL Jatiloka Residence
## Dari nol sampai live — estimasi 30-45 menit

---

## TAHAP 1: Daftar Akun (5 menit)

### A. GitHub
1. Buka https://github.com
2. Klik **Sign up**
3. Isi email, password, username
4. Verifikasi email
5. ✅ Selesai

### B. Supabase (database)
1. Buka https://supabase.com
2. Klik **Start your project**
3. Pilih **Continue with GitHub** → login pakai akun GitHub tadi
4. ✅ Selesai

### C. Vercel (hosting)
1. Buka https://vercel.com
2. Klik **Sign Up**
3. Pilih **Continue with GitHub**
4. ✅ Selesai

---

## TAHAP 2: Setup Supabase Database (10 menit)

### Langkah 1: Buat Project Baru
1. Login ke https://supabase.com/dashboard
2. Klik **New project**
3. Isi:
   - **Name**: `ipl-jatiloka`
   - **Database Password**: buat password kuat, **SIMPAN di HP lo**
   - **Region**: pilih **Southeast Asia (Singapore)**
4. Klik **Create new project**
5. Tunggu ~2 menit sampai project siap

### Langkah 2: Buat Tabel Database
1. Di sidebar kiri, klik **SQL Editor**
2. Klik **New query**
3. Copy-paste seluruh isi file `supabase-setup.sql`
4. Klik tombol **Run** (▶️)
5. Pastikan muncul pesan success ✅

### Langkah 3: Setup Storage (untuk upload bukti)
1. Di sidebar kiri, klik **Storage**
2. Klik **New bucket**
3. Isi:
   - **Name**: `bukti-transfer`
   - **Public bucket**: ✅ centang ON
4. Klik **Save**
5. Klik bucket `bukti-transfer` yang baru dibuat
6. Klik **Policies** → **New policy** → **For full customization**
7. Isi policy name: `Public access`
8. Centang semua: SELECT, INSERT, UPDATE, DELETE
9. Di bagian USING expression isi: `true`
10. Klik **Review** → **Save policy**

### Langkah 4: Ambil API Keys
1. Di sidebar kiri, klik **Project Settings** (ikon ⚙️)
2. Klik **API**
3. Catat dua nilai ini (foto/screenshot):
   - **Project URL**: `https://xxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGci...` (string panjang)

---

## TAHAP 3: Upload Kode ke GitHub (10 menit)

### Cara termudah: Upload via browser

1. Login ke https://github.com
2. Klik **+** di pojok kanan atas → **New repository**
3. Isi:
   - **Repository name**: `ipl-jatiloka`
   - **Visibility**: Private ✅ (biar aman)
4. Klik **Create repository**

5. Di halaman repository baru, klik **uploading an existing file**

6. Upload file-file berikut (dari folder yang lo dapat):
   ```
   index.html
   package.json
   vite.config.js
   src/App.jsx
   src/main.jsx
   ```
   ⚠️ Jangan upload `.env.example` — itu hanya template

7. Di bagian **Commit changes**, tulis: `Initial upload`
8. Klik **Commit changes**

---

## TAHAP 4: Deploy ke Vercel (5 menit)

1. Login ke https://vercel.com/dashboard
2. Klik **Add New** → **Project**
3. Klik **Import** di sebelah repository `ipl-jatiloka`
4. Di bagian **Configure Project**:
   - Framework Preset: **Vite** (pilih dari dropdown)
   - Biarkan yang lain default
5. Buka bagian **Environment Variables** — ini PENTING:
   - Klik **Add**
   - Key: `VITE_SUPABASE_URL`
   - Value: paste Project URL dari Supabase tadi
   - Klik **Add** lagi
   - Key: `VITE_SUPABASE_ANON_KEY`
   - Value: paste anon key dari Supabase tadi
6. Klik **Deploy**
7. Tunggu ~1-2 menit
8. ✅ Muncul link seperti: `https://ipl-jatiloka.vercel.app`

---

## TAHAP 5: Test & Share (5 menit)

1. Buka link Vercel di HP lo
2. Coba konfirmasi satu kavling sebagai test
3. Refresh halaman — data harus tetap ada
4. Buka di HP lain — data harus kelihatan

### Share ke Grup Telegram:
Kirim pesan ini ke grup Jatiloka:

```
🏘️ *IPL JATILOKA RESIDENCE - Tracker Digital*

Mulai bulan ini, konfirmasi pembayaran IPL bisa 
dilakukan langsung lewat link berikut:

🔗 https://ipl-jatiloka.vercel.app

Caranya:
1. Buka link di atas
2. Tap tombol biru "+ Konfirmasi Pembayaran"
3. Pilih kavling lo
4. Isi nominal & upload foto bukti transfer
5. Submit ✅

Dashboard langsung update otomatis.
Tidak perlu kirim foto ke grup lagi! 🙏
```

---

## Info Tambahan

### Catatan Admin
Versi lama memakai PIN di browser dan hanya cocok untuk prototipe. Implementasi baru akan memakai Supabase Auth, role admin, dan aturan RLS sesuai milestone berikutnya.

### Akses Admin Panel
- Buka link app
- Tap ikon ⚙️ di pojok kanan atas
- Masukkan PIN admin
- Bisa toggle status manual, lihat bukti transfer, reset per bulan

### Biaya
- Supabase: **GRATIS** (free tier: 500MB database, 1GB storage)
- Vercel: **GRATIS** (free tier: unlimited deployments)
- **Total: Rp 0/bulan** ✅

### Link tidak perlu diganti setiap bulan
Cukup share sekali. Warga tinggal ganti bulan di dropdown.

---

## Butuh Bantuan?

Kalau ada error atau stuck di step manapun, screenshot errornya dan tanya ke Claude lagi. Gue bantu debug. 💪
