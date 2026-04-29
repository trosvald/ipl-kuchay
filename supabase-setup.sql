-- ============================================
-- JALANKAN INI DI SUPABASE SQL EDITOR
-- Project: IPL Jatiloka Residence
-- ============================================

-- 1. Tabel utama pembayaran
CREATE TABLE IF NOT EXISTS payments (
  id          BIGSERIAL PRIMARY KEY,
  kavling     TEXT NOT NULL,
  month       TEXT NOT NULL,
  year        INTEGER NOT NULL,
  nominal     TEXT NOT NULL,
  catatan     TEXT,
  bukti_url   TEXT,
  status      TEXT DEFAULT 'lunas',
  waktu       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (kavling, month, year)
);

-- 2. Enable Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 3. Policy: semua orang bisa baca (dashboard publik)
CREATE POLICY "Public read" ON payments
  FOR SELECT USING (true);

-- 4. Policy: semua orang bisa insert/update (konfirmasi mandiri)
CREATE POLICY "Public insert" ON payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update" ON payments
  FOR UPDATE USING (true);

CREATE POLICY "Public delete" ON payments
  FOR DELETE USING (true);

-- ============================================
-- SELESAI! Lanjut ke step Storage di bawah
-- ============================================
