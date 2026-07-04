import { createAdminClient } from '@/lib/supabase/admin'

export const DEFAULT_PLATFORM_NAME = 'AbsenKu'

// Service-role client bypasses RLS so anon users (landing/login/register) can
// read the platform name. Super admin "Save Platform Name" writes the same
// app_name to every row, so any non-null value is the platform-wide setting.
export async function getPlatformName(): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('organizations')
    .select('app_name')
    .not('app_name', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data?.app_name?.trim() || DEFAULT_PLATFORM_NAME
}
