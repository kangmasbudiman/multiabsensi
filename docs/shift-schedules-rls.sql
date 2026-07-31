-- =====================================================================
-- RLS policy lengkap untuk shift_schedules (tabel Roster)
-- =====================================================================
-- Bug 1: policy write nggak ada → upsert gagal diam-diam
-- Bug 2: policy pakai `org_id = get_user_org()` NGE-BLOCK super_admin
--        yang lagi inspect org lain (get_user_org() return null untuk
--        super_admin, padahal org_id di row = inspect_org_id).
--
-- Fix: samakan pattern dengan employee_shifts — pakai is_admin() tanpa
-- org check. Super_admin/admin bisa write di org manapun (platform owner).

ALTER TABLE shift_schedules ENABLE ROW LEVEL SECURITY;

-- Drop policy lama (defensive)
DROP POLICY IF EXISTS "shift_sched_select" ON shift_schedules;
DROP POLICY IF EXISTS "shift_sched_admin_all" ON shift_schedules;
DROP POLICY IF EXISTS "shift_sched_insert" ON shift_schedules;
DROP POLICY IF EXISTS "shift_sched_update" ON shift_schedules;
DROP POLICY IF EXISTS "shift_sched_delete" ON shift_schedules;
DROP POLICY IF EXISTS "shift_sched_dept_head_managed" ON shift_schedules;

-- 1. Read: org member (org_id match) ATAU super_admin/admin (bisa akses semua org)
CREATE POLICY "shift_sched_select" ON shift_schedules
  FOR SELECT USING (
    org_id = get_user_org() OR is_admin()
  );

-- 2. Write: admin/super_admin bebas kelola (tanpa org check, sama kayak employee_shifts)
CREATE POLICY "shift_sched_admin_all" ON shift_schedules
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Verifikasi:
-- SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'shift_schedules';
