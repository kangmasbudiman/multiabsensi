import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import RosterClient from './RosterClient'

export const dynamic = 'force-dynamic'

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const params = await searchParams
  const now = new Date()
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  const year = parseInt(params.year ?? String(now.getFullYear()))

  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role, department_id, position')
    .eq('id', user!.id)
    .single()

  // Super_admin yang lagi inspect org lain: override org_id pakai inspect_org_id
  // dari cookie. Kalau super_admin tanpa cookie (belum inspect org manapun),
  // fallback ke org pertama (same logic dengan layout.tsx) supaya roster-nya
  // nggak kosong. Tanpa fallback ini, orgId=null → query kosong → user nggak
  // bisa lihat data walau udah assign.
  let orgId = profile!.org_id
  if (profile!.role === 'super_admin') {
    const jar = await cookies()
    const inspectId = jar.get('inspect_org_id')?.value
    if (inspectId) {
      orgId = inspectId
    } else if (!orgId) {
      const { data: firstOrg } = await admin
        .from('organizations')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (firstOrg) orgId = firstOrg.id
    }
  }

  const isDeptHead = profile!.role === 'dept_head' || profile!.position === 'kepala_ruangan'

  // Timezone-safe: jangan pakai toISOString() — di UTC+7 dia bakal ngembaliin
  // tanggal sehari sebelumnya untuk hari terakhir bulan, exclude hari terakhir
  // dari query range.
  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  let empQuery = admin
    .from('profiles')
    .select('id, full_name, employee_id, department_id, departments(name)')
    .eq('org_id', orgId)
    .eq('role', 'employee')
    .eq('is_active', true)
    .order('full_name')

  if (isDeptHead && profile!.department_id) {
    empQuery = empQuery.eq('department_id', profile!.department_id)
  }

  // Supabase Cloud nge-cap response di 1000 rows (PostgREST max-rows config,
  // nggak bisa di-override dari client walau .limit(N) > 1000). Untuk bypass,
  // kita loop .range() sampai halaman berikutnya kosong — jadi nggak ada batas
  // hard-coded jumlah baris yang bisa di-load.
  const PAGE_SIZE = 1000
  const MAX_PAGES = 100 // safety net: 100k rows

  async function paginateSchedule() {
    const all: any[] = []
    let firstError: unknown = null
    for (let i = 0; i < MAX_PAGES; i++) {
      const from = i * PAGE_SIZE
      const to = (i + 1) * PAGE_SIZE - 1
      const { data, error } = await admin
        .from('shift_schedules')
        .select('user_id, shift_id, date, is_off')
        .eq('org_id', orgId)
        .gte('date', startDate)
        .lte('date', endDate)
        .range(from, to)
      if (error && !firstError) firstError = error
      if (!data?.length) break
      all.push(...(data as any[]))
      if (data.length < PAGE_SIZE) break
    }
    return { data: all, error: firstError }
  }

  const [{ data: employees }, { data: shifts }, { data: departments }, { data: holidays }, schedulesRes] = await Promise.all([
    empQuery,
    admin.from('shifts').select('*').eq('org_id', orgId).order('start_time'),
    admin.from('departments').select('id, name').eq('org_id', orgId).order('name'),
    admin.from('holidays')
      .select('date, name, is_national')
      .eq('org_id', orgId)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`),
    paginateSchedule(),
  ])

  const schedulesErr = schedulesRes.error
  const schedules = schedulesRes.data ?? []

  // Debug: log di terminal server (output `npm run dev`) — kalau select
  // shift_schedules error atau kosong padahal harusnya ada data, kelihatan di sini.
  if (schedulesErr) {
    console.error('[roster.page] select shift_schedules error:', schedulesErr)
  }
  console.info(`[roster.page] orgId=${orgId}, range=${startDate}..${endDate}, schedules=${schedules?.length ?? 0} rows`)

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
