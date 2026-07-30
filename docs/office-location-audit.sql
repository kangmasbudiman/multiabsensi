-- =====================================================================
-- Audit log untuk office_locations
-- Jalankan sekali di Supabase Dashboard → SQL Editor
-- =====================================================================

-- 1. Tambah kolom tracking di office_locations (info cepat di UI)
ALTER TABLE office_locations
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_action TEXT;

-- Isi updated_at default untuk row yang sudah ada
UPDATE office_locations
SET updated_at = now(), last_action = 'legacy'
WHERE updated_at IS NULL;

-- 2. Tabel audit log penuh (semua perubahan dicatat)
CREATE TABLE IF NOT EXISTS office_location_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID,  -- tidak di-FK karena lokasi bisa dihapus
  location_name TEXT, -- snapshot nama saat perubahan
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'toggle', 'legacy')),
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  changed_by_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_office_loc_audits_org_time
  ON office_location_audits(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_office_loc_audits_loc_time
  ON office_location_audits(location_id, created_at DESC);

-- 3. RLS: org member bisa baca audit-nya sendiri
ALTER TABLE office_location_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS " Org members can read audits" ON office_location_audits;
CREATE POLICY "Org members can read audits" ON office_location_audits
  FOR SELECT USING (
    org_id IN (
      SELECT p.org_id FROM profiles p
      WHERE p.id = auth.uid()
    )
  );

-- Hapus policy untuk write — semua write lewat service role (API route)
DROP POLICY IF EXISTS "No direct writes to audits" ON office_location_audits;

-- Selesai.
-- Verifikasi:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'office_locations';
-- SELECT count(*) FROM office_location_audits;
