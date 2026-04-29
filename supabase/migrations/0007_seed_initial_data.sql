insert into public.kavlings (code, sort_order)
values
  ('Kav 1', 1),
  ('Kav 2', 2),
  ('Kav 3A', 3),
  ('Kav 3B', 4),
  ('Kav 5', 5),
  ('Kav 6', 6),
  ('Kav 7', 7),
  ('Kav 8', 8),
  ('Kav 9', 9),
  ('Kav 10', 10),
  ('Kav 11', 11),
  ('Kav 12', 12),
  ('Kav 15A', 13),
  ('Kav 15B', 14),
  ('Kav 16', 15),
  ('Kav 17', 16),
  ('Kav 18', 17),
  ('Kav 19', 18),
  ('Kav 20', 19),
  ('Kav 21', 20),
  ('Kav 22', 21),
  ('Kav 23A', 22),
  ('Kav 23B', 23),
  ('Kav 25', 24),
  ('Kav 26', 25),
  ('Kav 27', 26),
  ('Kav 28', 27),
  ('Kav 30', 28),
  ('Kav 31', 29),
  ('Kav 32A', 30),
  ('Kav 32B', 31),
  ('Kav 35', 32),
  ('Kav 36', 33),
  ('Kav 37', 34)
on conflict (code) do update
set sort_order = excluded.sort_order;

insert into public.fee_types (code, name, description, default_amount, is_recurring, is_penalty, sort_order)
values
  ('IPL', 'IPL', 'Iuran Pengelolaan Lingkungan', 350000, true, false, 1),
  ('SECURITY', 'Keamanan', 'Iuran keamanan lingkungan', 0, true, false, 2),
  ('CLEANING', 'Kebersihan', 'Iuran kebersihan lingkungan', 0, true, false, 3),
  ('SINKING_FUND', 'Sinking Fund', 'Dana cadangan/perawatan', 0, true, false, 4),
  ('EVENT', 'Iuran Event', 'Iuran kegiatan khusus', 0, false, false, 5),
  ('PENALTY', 'Denda', 'Denda keterlambatan pembayaran', 0, false, true, 99)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.notification_templates (code, channel, title, body_template)
values
  ('resident_invoice_created', 'telegram', 'Tagihan baru', 'Halo {{name}}, tagihan {{period_label}} untuk {{kavling_code}} sudah terbit. Total: Rp {{amount_due}}. Jatuh tempo: {{due_date}}.'),
  ('resident_payment_pending', 'telegram', 'Bukti pembayaran diterima', 'Bukti pembayaran {{kavling_code}} untuk {{period_label}} sudah diterima dan menunggu verifikasi bendahara.'),
  ('resident_payment_verified', 'telegram', 'Pembayaran terverifikasi', 'Pembayaran {{kavling_code}} untuk {{period_label}} sudah diverifikasi. Terima kasih.'),
  ('resident_payment_rejected', 'telegram', 'Bukti pembayaran ditolak', 'Bukti pembayaran {{kavling_code}} untuk {{period_label}} ditolak. Alasan: {{reason}}.'),
  ('resident_payment_reminder', 'telegram', 'Pengingat IPL', 'Pengingat: tagihan {{period_label}} untuk {{kavling_code}} masih {{status}}. Total: Rp {{amount_due}}. Jatuh tempo: {{due_date}}.'),
  ('admin_pending_submission', 'telegram', 'Bukti baru menunggu verifikasi', '{{kavling_code}} mengirim bukti pembayaran {{period_label}} sebesar Rp {{amount_submitted}}.'),
  ('admin_monthly_summary', 'telegram', 'Ringkasan bulanan IPL', 'Ringkasan {{period_label}}: {{paid_count}}/{{total_count}} lunas. Total diterima Rp {{total_paid}}. Tunggakan Rp {{total_unpaid}}.')
on conflict (code) do update
set
  title = excluded.title,
  body_template = excluded.body_template,
  active = true;
