import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import CustomAttendanceAdminClient from './CustomAttendanceAdminClient'

export const dynamic = 'force-dynamic'

export default async function CustomAttendanceAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch orgs (paginate bypass 1000-cap)
  const orgs: Array<{ id: string; name: string }> = []
  for (let from = 0; from < 50000; from += 1000) {
    const { data: orgPage } = await admin
      .from('organizations')
      .select('id, name')
      .order('name')
      .range(from, from + 999)
    if (!orgPage?.length) break
    orgs.push(...orgPage)
    if (orgPage.length < 1000) break
  }

  // Fetch existing links + whitelist users
  const links: Array<{
    id: string
    token: string
    label: string | null
    org_id: string
    is_active: boolean
    expires_at: string | null
    created_at: string
    organizations: { name: string } | null
    custom_attendance_link_users: Array<{ user_id: string }>
  }> = []
  const { data: linkRowsRaw } = await admin
    .from('custom_attendance_links')
    .select(`
      id, token, label, org_id, is_active, expires_at, created_at,
      organizations(name),
      custom_attendance_link_users(user_id)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (linkRowsRaw?.length) {
    for (const r of linkRowsRaw as any[]) {
      const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations
      links.push({
        id: r.id,
        token: r.token,
        label: r.label,
        org_id: r.org_id,
        is_active: r.is_active,
        expires_at: r.expires_at,
        created_at: r.created_at,
        organizations: org ?? null,
        custom_attendance_link_users: r.custom_attendance_link_users ?? [],
      })
    }
  }

  // Collect all whitelisted user_ids untuk batch-fetch profiles
  const allUserIds = Array.from(new Set(links.flatMap(l => l.custom_attendance_link_users.map(u => u.user_id))))
  const userMap = new Map<string, { id: string; full_name: string; employee_id: string | null }>()

  // Chunk 1000 per batch
  for (let i = 0; i < allUserIds.length; i += 1000) {
    const chunk = allUserIds.slice(i, i + 1000)
    const { data: users } = await admin
      .from('profiles')
      .select('id, full_name, employee_id')
      .in('id', chunk)
    if (users) {
      for (const u of users) userMap.set(u.id, u)
    }
  }

  // Count submissions per link
  const { data: subCounts } = await admin
    .from('custom_attendance_submissions')
    .select('link_id')
  const submissionCountMap = new Map<string, number>()
  for (const s of subCounts ?? []) {
    submissionCountMap.set(s.link_id, (submissionCountMap.get(s.link_id) ?? 0) + 1)
  }

  return (
    <CustomAttendanceAdminClient
      orgs={orgs}
      links={links}
      userMap={Object.fromEntries(userMap)}
      submissionCountMap={Object.fromEntries(submissionCountMap)}
    />
  )
}
