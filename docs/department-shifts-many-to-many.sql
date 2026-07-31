-- =====================================================================
-- Multi-shift per departemen (many-to-many)
-- Jalankan SETELAH department-default-shift.sql (yang single-shift)
-- =====================================================================
-- Departemen bisa punya banyak shift — contoh Management:
--   - Shift A: Senin-Jumat 08:00-16:00 (work_days=[1,2,3,4,5])
--   - Shift B: Sabtu 08:00-13:00 (work_days=[6])
-- Lookup shift saat absen akan pilih yang match dengan hari ini.

CREATE TABLE IF NOT EXISTS department_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(department_id, shift_id)
);

CREATE INDEX IF NOT EXISTS idx_department_shifts_dept
  ON department_shifts(department_id);

ALTER TABLE department_shifts ENABLE ROW LEVEL SECURITY;

-- RLS: org member bisa baca shift-shift departemen org-nya
DROP POLICY IF EXISTS "Org members can read department shifts" ON department_shifts;
CREATE POLICY "Org members can read department shifts" ON department_shifts
  FOR SELECT USING (
    department_id IN (
      SELECT d.id FROM departments d
      JOIN profiles p ON p.org_id = d.org_id
      WHERE p.id = auth.uid()
    )
  );

-- Kolom default_shift_id lama tetap di-keep (backward compat) — tapi lookup
-- prioritas pakai department_shifts (multi-shift). Bisa drop nanti kalau
-- semua departemen sudah di-migrate ke multi-shift.

-- Verifikasi:
-- SELECT * FROM department_shifts;
