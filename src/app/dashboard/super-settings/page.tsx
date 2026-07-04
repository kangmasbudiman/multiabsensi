import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPlatformName } from '@/lib/platform'
import SuperSettingsClient from './SuperSettingsClient'

export default async function SuperSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('id', user!.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/dashboard')

  const [
    { data: orgs },
    { count: totalUsers },
    platformName,
  ] = await Promise.all([
    supabase.from('organizations').select('*').order('registered_at', { ascending: false }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    getPlatformName(),
  ])

  const approved = orgs?.filter(o => o.status === 'approved') ?? []
  const pending = orgs?.filter(o => o.status === 'pending') ?? []
  const rejected = orgs?.filter(o => o.status === 'rejected') ?? []

  return (
    <SuperSettingsClient
      orgs={approved}
      pending={pending}
      rejected={rejected}
      totalUsers={totalUsers ?? 0}
      approverId={profile.id}
      initialPlatformName={platformName}
    />
  )
}
