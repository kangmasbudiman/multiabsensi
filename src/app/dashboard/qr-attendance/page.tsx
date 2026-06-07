import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import QrAttendanceClient from './QrAttendanceClient'

export const dynamic = 'force-dynamic'

export default async function QrAttendancePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/dashboard')

  // Fetch all active companies
  const { data: companies } = await supabase
    .from('organizations')
    .select('id, name, company_code, app_name')
    .eq('is_active', true)
    .order('name')

  return <QrAttendanceClient companies={companies ?? []} />
}
