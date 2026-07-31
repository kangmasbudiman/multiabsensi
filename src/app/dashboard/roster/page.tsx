import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import RosterClient from './RosterClient'

export const dynamic = 'force-dynamic'

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const params = await searchParams
  const now = new Date()
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  const year = parseInt(params.year ?? String(now.getFullYear()))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role, department_id, position')
    .eq('id', user!.id)
    .single()

  // Super_admin yang lagi inspect org lain: override org_id pakai inspect_org_id
  // dari cookie. Tanpa ini, roster page bakal query org_id null → data kosong.
  let orgId = profile!.org_id
  if (profile!.role === 'super_admin') {
    const jar = await cookies()
    const inspectId = jar.get('inspect_org_id')?.value
    if (inspectId) orgId = inspectId
  }

  const isDeptHead = profile!.role === 'dept_head' || profile!.position === 'kepala_ruangan'

  // Timezone-safe: jangan pakai toISOString() — di UTC+7 dia bakal ngembaliin
  // tanggal sehari sebelumnya untuk hari terakhir bulan, exclude hari terakhir
  // dari query range.
  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  let empQuery = supabase
    .from('profiles')
    .select('id, full_name, employee_id, department_id, departments(name)')
    .eq('org_id', orgId)
    .eq('role', 'employee')
    .eq('is_active', true)
    .order('full_name')

  if (isDeptHead && profile!.department_id) {
    empQuery = empQuery.eq('department_id', profile!.department_id)
  }

  const [
    { data: employees },
    { data: shifts },
    { data: departments },
    { data: schedules },
    { data: holidays },
  ] = await Promise.all([
    empQuery,
    supabase.from('shifts').select('*').eq('org_id', orgId).order('start_time'),
    supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
    supabase.from('shift_schedules')
      .select('user_id, shift_id, date, is_off')
      .eq('org_id', orgId)
      .gte('date', startDate)
      .lte('date', endDate),
    supabase.from('holidays')
      .select('date, name, is_national')
      .eq('org_id', orgId)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`),
  ])

  return (
    <RosterClient
      employees={(employees ?? []).map(e => ({
        ...e,
        departments: Array.isArray(e.departments) ? e.departments[0] ?? null : e.departments,
      }))}
      shifts={shifts ?? []}
      departments={departments ?? []}
      schedules={schedules ?? []}
      holidays={holidays ?? []}
      month={month}
      year={year}
      orgId={orgId}
      isDeptHead={isDeptHead}
    />
  )
}
