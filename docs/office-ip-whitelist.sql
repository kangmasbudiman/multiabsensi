-- =====================================================================
-- Whitelist IP public jaringan kantor — untuk mode absensi WiFi
-- Jalankan sekali di Supabase Dashboard → SQL Editor
-- =====================================================================

CREATE TABLE IF NOT EXISTS office_ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  label TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_office_ip_whitelist_org_ip
  ON office_ip_whitelist(org_id, ip_address);

ALTER TABLE office_ip_whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read office IPs" ON office_ip_whitelist;
CREATE POLICY "Org members can read office IPs" ON office_ip_whitelist
  FOR SELECT USING (
    org_id IN (
      SELECT p.org_id FROM profiles p
      WHERE p.id = auth.uid()
    )
  );

-- Semua write lewat service role (API route), jadi tidak perlu policy INSERT/UPDATE/DELETE.

-- Verifikasi:
-- SELECT * FROM office_ip_whitelist;
