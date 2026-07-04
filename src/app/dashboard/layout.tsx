import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/admin/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, org_id, full_name, avatar_url, position')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw new Error(`Profil tidak ditemukan (${profileError?.code ?? 'no data'}). Silakan coba lagi.`)
  }

  // Jabatan yang berhak akses dashboard sebagai approver
  const APPROVER_POSITIONS = ['direktur', 'sekertaris', 'kabid', 'kabag', 'kepala_ruangan', 'kasie_keperawatan', 'kasie_penunjang']
  const isApproverPosition = APPROVER_POSITIONS.includes(profile.position ?? '')
  const allowedRoles = ['super_admin', 'admin', 'hrd', 'dept_head']

  if (!allowedRoles.includes(profile.role) && !isApproverPosition) {
    redirect('/login?err=role')
  }

  let viewingOrg: { id: string; name: string } | null = null

  if (profile.role === 'super_admin') {
    const jar = await cookies()
    const inspectId = jar.get('inspect_org_id')?.value
    const inspectName = jar.get('inspect_org_name')?.value
    if (inspectId && inspectName) {
      viewingOrg = { id: inspectId, name: inspectName }
      profile.org_id = inspectId
    }
  }

  const { data: org } = profile.org_id
    ? await supabase.from('organizations').select('name, company_code, app_name, logo_url').eq('id', profile.org_id).single()
    : profile.role === 'super_admin'
      ? await supabase.from('organizations').select('name, company_code, app_name, logo_url').not('app_name', 'is', null).order('created_at', { ascending: true }).limit(1).maybeSingle()
      : { data: null }

  const fullProfile = { ...profile, organizations: org ?? null }

  return (
    <DashboardShell profile={fullProfile} viewingOrg={viewingOrg}>
      {children}
    </DashboardShell>
  )
}
