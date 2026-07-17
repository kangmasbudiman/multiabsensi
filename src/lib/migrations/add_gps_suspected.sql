-- Flag absensi yang dicurigai pakai fake GPS / spoofed location.
-- Disebar saat client kirim akurasi mencurigakan atau jitter GPS = 0.
-- Tidak memblok absen (biar tidak false-positive di area sinyal jelek),
-- tapi memunculkan badge di rekap absensi untuk review admin.
ALTER TABLE attendances
  ADD COLUMN IF NOT EXISTS is_gps_suspected BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN attendances.is_gps_suspected IS
  'True jika akurasi/jitter GPS saat check-in menunjukkan kemungkinan fake GPS.';
