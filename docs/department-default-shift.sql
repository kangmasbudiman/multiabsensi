-- =====================================================================
-- Default shift per departemen
-- Jalankan sekali di Supabase Dashboard → SQL Editor
-- =====================================================================
-- Dipakai sebagai fallback saat karyawan belum di-assign shift individual
-- (employee_shifts). Priority: roster > employee_shifts > department.default_shift_id

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS default_shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;

COMMENT ON COLUMN departments.default_shift_id IS
  'Shift default untuk karyawan di departemen ini. Dipakai kalau karyawan belum di-assign shift individual.';

-- Verifikasi:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'departments';
-- SELECT name, default_shift_id FROM departments;
