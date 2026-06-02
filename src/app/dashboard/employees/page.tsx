import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import EmployeesClient from './EmployeesClient'

export default async function EmployeesPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user!.id)
    .single()

  const [{ data: employees }, { data: departments }, { data: shifts }, { data: positions }] = await Promise.all([
    admin.from('profiles')
      .select('*, departments(name)')
      .eq('org_id', profile!.org_id)
      .eq('role', 'employee')
      .order('full_name'),
    admin.from('departments').select('*').eq('org_id', profile!.org_id).order('name'),
    admin.from('shifts').select('*').eq('org_id', profile!.org_id).order('name'),
    admin.from('positions').select('name, label').eq('org_id', profile!.org_id).eq('is_active', true).order('level', { ascending: false }),
  ])

  const empList = (employees ?? []).map(e => ({
    ...e,
    departments: Array.isArray(e.departments) ? e.departments[0] ?? null : e.departments,
  }))

  // Fetch face registrations
  const userIds = empList.map(e => e.id)
  const { data: faceRegs } = await admin
    .from('face_registrations')
    .select('user_id, face_data, face_descriptor_encrypted, face_photo_url')
    .in('user_id', userIds)

  const faceRegMap = new Map((faceRegs ?? []).map(r => [r.user_id, r]))

  // Merge: has_face = true if any face data exists
  const mergedEmployees = empList.map(emp => {
    const reg = faceRegMap.get(emp.id)
    return {
      ...emp,
      face_data: reg?.face_data ?? null,
      face_photo_url: reg?.face_photo_url ?? null,
      has_face_registration: !!(reg?.face_descriptor_encrypted || reg?.face_data),
    }
  })

  return (
    <EmployeesClient
      employees={mergedEmployees}
      departments={departments ?? []}
      shifts={shifts ?? []}
      positions={positions ?? []}
      orgId={profile!.org_id}
    />
  )
}
