import { createAdminClient } from '@/lib/supabase/admin'
import RegisterClient from './RegisterClient'

export const dynamic = 'force-dynamic'

export default async function RegisterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  let valid = false
  let reason: 'not_found' | 'used' | 'expired' | null = null
  let orgName = 'AbsenKu'
  let departments: { id: string; name: string }[] = []
  let positions: { name: string; label: string }[] = []
  let expiresAt: string | null = null

  const { data: tokenRow } = await admin
    .from('employee_registration_tokens')
    .select('id, user_id, org_id, expires_at, used_at')
    .eq('token', token)
    .single()

  if (tokenRow) {
    if (tokenRow.used_at) {
      reason = 'used'
    } else if (new Date(tokenRow.expires_at) <= new Date()) {
      reason = 'expired'
    } else {
      valid = true
      expiresAt = tokenRow.expires_at

      const [orgRes, deptRes, posRes] = await Promise.all([
        admin.from('organizations').select('name, app_name').eq('id', tokenRow.org_id).single(),
        admin.from('departments').select('id, name').eq('org_id', tokenRow.org_id).order('name'),
        admin.from('positions').select('name, label').eq('org_id', tokenRow.org_id).eq('is_active', true).order('level', { ascending: false }),
      ])

      orgName = orgRes.data?.app_name || orgRes.data?.name || 'AbsenKu'
      departments = deptRes.data ?? []
      positions = posRes.data ?? []
    }
  } else {
    reason = 'not_found'
  }

  return (
    <RegisterClient
      token={token}
      valid={valid}
      reason={reason}
      orgName={orgName}
      departments={departments}
      positions={positions}
      expiresAt={expiresAt}
    />
  )
}
