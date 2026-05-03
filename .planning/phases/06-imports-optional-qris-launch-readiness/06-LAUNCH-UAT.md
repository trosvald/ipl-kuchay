# Phase 06 Launch UAT — Operasional Tanpa Spreadsheet

## Tujuan

Membuktikan alur operasional inti berjalan penuh di aplikasi tanpa fallback spreadsheet, dengan transfer manual tetap berfungsi saat QRIS nonaktif.

## Prasyarat

1. Login sebagai **admin** (dan/atau treasurer untuk validasi role keuangan).
2. Data impor Phase 06 sudah diterapkan ke environment staging.
3. Tersedia minimal:
   - 1 periode billing aktif,
   - 1 invoice unpaid/overdue,
   - 1 submission pembayaran pending,
   - 1 data pengumuman draft,
   - data transaksi untuk halaman laporan.
4. QRIS diset **nonaktif** di `/admin/settings` sebelum langkah 2 dijalankan.

## Urutan Eksekusi Wajib (Deterministik)

> Jalankan sesuai urutan agar validasi cutover konsisten dan auditable.

1. Validasi billing generation
2. Validasi verifikasi pembayaran (manual transfer)
3. Validasi publish/view pengumuman
4. Validasi laporan dan ekspor
5. Validasi cabang QRIS nonaktif

## Daftar UAT

| ID | Requirement | Area | Langkah Operator | Hasil yang Diharapkan | Evidence yang Wajib |
| --- | --- | --- | --- | --- | --- |
| UAT-06-01 | OPER-01 | Billing generation | Buka `/admin/billing`, pilih periode aktif, jalankan aksi generate/preview sesuai UI, lalu konfirmasi jika valid. | Invoice periode terbentuk/terbarui sesuai data tanpa proses spreadsheet eksternal. | Screenshot halaman billing sebelum/sesudah + catatan jumlah invoice. |
| UAT-06-02 | OPER-01 | Payment verification | Buka `/admin/submissions`, pilih tab **Pending**, review 1 submission transfer manual, lakukan **Approve**. | Status submission berubah ke verified dan status invoice ikut transisi sesuai aturan. | Screenshot sebelum/sesudah approve + ID submission + timestamp review. |
| UAT-06-03 | OPER-01 | Communication publish/view | Buka `/admin/announcements`, publish 1 pengumuman. Lalu login resident dan buka `/app/announcements`. | Pengumuman tampil untuk resident, tanpa channel spreadsheet/manual broadcast. | Screenshot halaman admin publish + halaman resident yang menampilkan item. |
| UAT-06-04 | OPER-01 | Reporting/export | Buka `/admin/reports`, terapkan filter periode, jalankan tampilan ringkasan lalu ekspor (jika tersedia di UI). | Ringkasan dan output ekspor tersedia dari aplikasi sebagai sumber data operasional. | Screenshot filter + hasil ringkasan + file ekspor/nama file (jika ada). |
| UAT-06-05 | QRIS-03 | QRIS disabled branch | Pastikan setting QRIS **nonaktif** di `/admin/settings`, buka detail invoice resident `/app/invoices/[invoiceId]`. | Aksi QRIS tidak ditampilkan/aktif, namun form kirim bukti transfer manual tetap tersedia dan bisa dipakai. | Screenshot setting QRIS nonaktif + detail invoice resident yang menunjukkan fallback manual transfer. |

## Kriteria Lulus

- Semua langkah UAT-06-01 s.d UAT-06-05 berstatus **PASS**.
- Tidak ada langkah yang membutuhkan fallback spreadsheet.
- Jalur transfer manual tervalidasi tetap berjalan saat QRIS nonaktif.

## Catatan Rollback Jika Gagal (T-06-12)

Jika ada langkah FAIL:

1. Hentikan eksekusi UAT lanjutan.
2. Catat langkah gagal + gejala + evidence di `06-VERIFICATION.md`.
3. Kembalikan setting yang diubah saat UAT (contoh: status publish pengumuman uji, setting QRIS).
4. Eskalasi sebagai blocker launch readiness sebelum phase closure.
