-- Add is_lembur column to attendances.
-- Set automatically by calculate_attendance_status() trigger when check-out
-- time exceeds the scheduled shift end. Read by recap dashboard + main dashboard.
-- Was referenced in night_shift.sql trigger and frontend queries but never created.
ALTER TABLE attendances
  ADD COLUMN IF NOT EXISTS is_lembur BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN attendances.is_lembur IS
  'True jika check-out melebihi scheduled shift end (auto-set by calculate_attendance_status trigger).';
