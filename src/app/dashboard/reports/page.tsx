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

  // Fetch attendance for the month (admin client bypass RLS)
  const { data: attendances } = await admin
    .from('attendances')
    .select('*, profiles!inner(full_name, employee_id, org_id, position)')
    .eq('profiles.org_id', profile!.org_id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  // Fetch all active employees
  const { data: employees } = await admin
    .from('profiles')
    .select('id, full_name, employee_id, position')
    .eq('org_id', profile!.org_id)
    .eq('role', 'employee')
    .eq('is_active', true)
    .order('full_name')

  return (
    <ReportsClient
      attendances={attendances ?? []}
      employees={employees ?? []}
      month={month}
      year={year}
    />
  )
}
