import { createClient } from '@/lib/supabase/server'
import NetworkClient from './NetworkClient'

export const dynamic = 'force-dynamic'

export default async function NetworkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user!.id)
    .single()

  let orgCode = ''
  if (profile?.org_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('company_code')
      .eq('id', profile.org_id)
      .single()
    orgCode = org?.company_code ?? ''
  }

  return <NetworkClient orgCode={orgCode} />
}
