-- Public base URL for this org (e.g. https://absenku.example.com).
-- Used to build QR/absen links when the admin dashboard is accessed from a
-- different origin than the public-facing app (VPS, local tunneling, etc.).
-- NULL = fall back to request origin / window.location.origin.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS base_url TEXT;

COMMENT ON COLUMN organizations.base_url IS
  'Public base URL (no trailing slash) for QR/absen links. NULL falls back to runtime origin.';
