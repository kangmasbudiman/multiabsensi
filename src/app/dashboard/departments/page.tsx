import { createClient } from '@/lib/supabase/server'
import DepartmentsClient from './DepartmentsClient'

export default async function DepartmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user!.id).single()

  const [deptResult, shiftResult] = await Promise.all([
    supabase
      .from('departments')
      .select(`
        id, name, description, created_at,
        department_shifts(shift_id, shifts(id, name, start_time, end_time, work_days))
      `)
      .eq('org_id', profile!.org_id)
      .order('name'),
    supabase
      .from('shifts')
      .select('id, name, start_time, end_time, work_days')
      .eq('org_id', profile!.org_id)
      .order('name'),
  ])

  return (
    <DepartmentsClient
      departments={deptResult.data ?? []}
      shifts={shiftResult.data ?? []}
      orgId={profile!.org_id}
    />
  )
}
