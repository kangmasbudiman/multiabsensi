import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import ReportsClient from './ReportsClient'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user!.id).single()

  const params = await searchParams
  const now = new Date()
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  const year = parseInt(params.year ?? String(now.getFullYear()))

  const startDate = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd')
  const endDate = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd')

  // Fetch attendance for the month using admin client (bypass RLS)
  const { data: attendances, error: attError } = await admin
    .from('attendances')
    .select('*, profiles!inner(full_name, employee_id, org_id, position)')
    .eq('profiles.org_id', profile!.org_id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (attError) {
    console.error('Reports attendance query error:', attError)
  }

  // Fetch all active employees
  const { data: employees, error: empError } = await admin
    .from('profiles')
    .select('id, full_name, employee_id, position')
    .eq('org_id', profile!.org_id)
    .eq('role', 'employee')
    .eq('is_active', true)
    .order('full_name')

  if (empError) {
    console.error('Reports employees query error:', empError)
  }

  // Fallback: if inner join returns nothing, try without join
  let finalAttendances = attendances ?? []
  if (finalAttendances.length === 0) {
    const { data: rawAttendances } = await admin
      .from('attendances')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })

    if (rawAttendances && rawAttendances.length > 0) {
      // Get user ids from attendance records
      const userIds = [...new Set(rawAttendances.map(a => a.user_id))]
      const { data: attProfiles } = await admin
        .from('profiles')
        .select('id, full_name, employee_id, org_id, position')
        .in('id', userIds)
        .eq('org_id', profile!.org_id)

      const profileMap = new Map((attProfiles ?? []).map(p => [p.id, p]))

      finalAttendances = rawAttendances
        .filter(a => profileMap.has(a.user_id))
        .map(a => ({
          ...a,
          profiles: profileMap.get(a.user_id) ?? null,
        }))
    }
  }

  return (
    <ReportsClient
      attendances={finalAttendances}
      employees={employees ?? []}
      month={month}
      year={year}
    />
  )
}
