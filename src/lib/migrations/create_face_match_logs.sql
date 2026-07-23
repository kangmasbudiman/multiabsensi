-- Audit log untuk semua percobaan face identification di /absen
-- Dipakai untuk:
--   1. Forensic analysis kalau ada keluhan false-match (saya tidak absen tapi tercatat)
--   2. Deteksi pola brute-force (banyak attempt similarity rendah dari IP yg sama)
--   3. Statistik akurasi model (avg similarity, distribusi match vs no-match)
--
-- Catatan: descriptor wajah TIDAK disimpan di sini (privacy). Hanya metadata
-- similarity, IP, user yg match (kalau ada), dan timestamp.

CREATE TABLE IF NOT EXISTS face_match_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Hasil identification
  matched_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  similarity DECIMAL(5,4),            -- 0.0000 - 1.0000 (1 - euclidean_distance)
  is_match BOOLEAN NOT NULL,          -- apakah lewat threshold

  -- Metadata request (untuk forensic / rate-limit analysis)
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,

  -- Error (kalau ada, misal descriptor tidak valid)
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_face_match_logs_created_at ON face_match_logs(created_at DESC);
CREATE INDEX idx_face_match_logs_matched_user ON face_match_logs(matched_user_id);
CREATE INDEX idx_face_match_logs_low_confidence
  ON face_match_logs(org_id, created_at DESC)
  WHERE is_match = TRUE AND similarity < 0.7;

-- RLS: admin bisa lihat semua log di org-nya. Karyawan TIDAK punya akses
-- (ini internal audit data, bukan untuk konsumsi karyawan).
ALTER TABLE face_match_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facematch_admin_select" ON face_match_logs
  FOR SELECT USING (
    is_admin() AND
    org_id = get_user_org()
  );

-- Insert diperlukan oleh endpoint public identify-face (anon/authenticated).
-- Tidak ada auth check di identify-face (memang public), jadi pakai policy terbuka
-- untuk INSERT tapi tanpa SELECT. RLS SELECT di atas sudah restrict ke admin.
CREATE POLICY "facematch_public_insert" ON face_match_logs
  FOR INSERT WITH CHECK (true);
