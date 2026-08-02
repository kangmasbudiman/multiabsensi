import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import ReportsClient from './ReportsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  // Paginate to bypass Supabase Cloud 1000-row cap — busy orgs can have
  // 2000+ records per month, which would silently truncate checkout data
  let attendances: Array<Record<string, unknown>> = []
  for (let from = 0; from < 50000; from += 1000) {
    const { data: page, error: attError } = await admin
      .from('attendances')
      .select('*, profiles!inner(full_name, employee_id, org_id, position)')
      .eq('profiles.org_id', profile!.org_id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .range(from, from + 999)
    if (attError) {
      console.error('Reports attendance query error:', attError)
      break
    }
    if (!page?.length) break
    attendances.push(...page)
    if (page.length < 1000) break
  }

  // Fetch all active employees (paginate to bypass 1000-row cap)
  const employees: Array<{ id: string; full_name: string; employee_id: string | null; position: string | null }> = []
  for (let from = 0; from < 50000; from += 1000) {
    const { data: empPage, error: empError } = await admin
      .from('profiles')
      .select('id, full_name, employee_id, position')
      .eq('org_id', profile!.org_id)
      .eq('role', 'employee')
      .eq('is_active', true)
      .order('full_name')
      .range(from, from + 999)
    if (empError) {
      console.error('Reports employees query error:', empError)
      break
    }
    if (!empPage?.length) break
    employees.push(...empPage)
    if (empPage.length < 1000) break
  }

  // Fallback: if inner join returns nothing, try without join
  let finalAttendances = attendances
  if (finalAttendances.length === 0) {
    const rawAttendances: Array<Record<string, unknown>> = []
    for (let from = 0; from < 50000; from += 1000) {
      const { data: rawPage } = await admin
        .from('attendances')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .range(from, from + 999)
      if (!rawPage?.length) break
      rawAttendances.push(...rawPage)
      if (rawPage.length < 1000) break
    }

    if (rawAttendances.length > 0) {
      // Get user ids from attendance records
      const userIds = [...new Set(rawAttendances.map(a => a.user_id as string))]
      // Chunk user_ids into 1000-batch to avoid URL length issues
      const attProfiles: Array<{ id: string; full_name: string; employee_id?: string; org_id?: string; position?: string }> = []
      for (let i = 0; i < userIds.length; i += 1000) {
        const chunk = userIds.slice(i, i + 1000)
        const { data: profilesChunk } = await admin
          .from('profiles')
          .select('id, full_name, employee_id, org_id, position')
          .in('id', chunk)
          .eq('org_id', profile!.org_id)
        if (profilesChunk) attProfiles.push(...profilesChunk)
      }

      const profileMap = new Map(attProfiles.map(p => [p.id, p]))

      finalAttendances = rawAttendances
        .filter(a => profileMap.has(a.user_id as string))
        .map(a => ({
          ...a,
          profiles: profileMap.get(a.user_id as string) ?? null,
        }))
    }
  }

  return (
    <ReportsClient
      attendances={finalAttendances as any}
      employees={employees ?? []}
      month={month}
      year={year}
    />
  )
}
