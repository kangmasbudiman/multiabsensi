import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import LoginClient from './LoginClient'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: org } = await supabase
    .from('organizations')
    .select('app_name')
    .eq('is_active', true)
    .limit(1)
    .single()

  const appName = org?.app_name ?? 'AbsenKu'

  return (
    <Suspense>
      <LoginClient appName={appName} />
    </Suspense>
  )
}
