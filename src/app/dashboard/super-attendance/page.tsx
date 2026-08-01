import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SuperAttendanceClient from './SuperAttendanceClient'

export const dynamic = 'force-dynamic'

export default async function SuperAttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/dashboard')

  // Pakai admin client (service role) biar bypass RLS — super_admin harus bisa
  // lihat semua karyawan lintas org. RLS profile_admin_select_org cuma allow
  // org_id = get_user_org() yang nggak match buat super_admin.
  const admin = createAdminClient()

  // Fetch semua orgs (asumsi < 1000 org)
  const { data: orgs } = await admin
    .from('organizations')
    .select('id, name, company_code, is_active')
    .order('name')

  // Fetch semua karyawan lintas org, paginasi 5x1000 = max 5000 (bypass Supabase cap)
  const PAGE_SIZE = 1000
  const empPages = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      admin.from('profiles')
        .select('id, full_name, employee_id, org_id, is_active, departments(name)')
        .eq('role', 'employee')
        .order('full_name')
        .range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1)
    )
  )
  const employees = empPages.flatMap(p => p.data ?? [])

  // Normalisasi relasi departments (Supabase return array tapi kita butuh object)
  const normalizedEmployees = employees.map(e => ({
    ...e,
    departments: Array.isArray(e.departments) ? e.departments[0] ?? null : e.departments,
  }))

  return (
    <SuperAttendanceClient
      orgs={orgs ?? []}
      employees={normalizedEmployees}
    />
  )
}
