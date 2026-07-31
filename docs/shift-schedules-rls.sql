-- =====================================================================
-- RLS policy lengkap untuk shift_schedules (tabel Roster)
-- =====================================================================
-- Bug: assignCell di /dashboard/roster gagal diam-diam karena policy write
-- tidak ada / tidak lengkap. Migration ini nge-drop policy lama (kalau ada)
-- dan recreate dengan benar pakai helper is_admin() (super_admin + admin).

-- Pastikan RLS aktif
ALTER TABLE shift_schedules ENABLE ROW LEVEL SECURITY;

-- Drop policy lama (defensive — kalau ada)
DROP POLICY IF EXISTS "shift_sched_select" ON shift_schedules;
DROP POLICY IF EXISTS "shift_sched_admin_all" ON shift_schedules;
DROP POLICY IF EXISTS "shift_sched_insert" ON shift_schedules;
DROP POLICY IF EXISTS "shift_sched_update" ON shift_schedules;
DROP POLICY IF EXISTS "shift_sched_delete" ON shift_schedules;
DROP POLICY IF EXISTS "shift_sched_dept_head_managed" ON shift_schedules;

-- 1. Read: org member bisa baca roster org-nya sendiri
CREATE POLICY "shift_sched_select" ON shift_schedules
  FOR SELECT USING (
    org_id = get_user_org()
  );

-- 2. Write: admin/super_admin bisa insert/update/delete di org-nya
CREATE POLICY "shift_sched_admin_all" ON shift_schedules
  FOR ALL
  USING (
    org_id = get_user_org()
    AND is_admin()
  )
  WITH CHECK (
    org_id = get_user_org()
    AND is_admin()
  );

-- Verifikasi (jalankan di SQL Editor setelah run migration):
-- SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE tablename = 'shift_schedules';
