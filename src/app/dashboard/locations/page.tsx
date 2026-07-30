import { createClient } from '@/lib/supabase/server'
import LocationsClient from './LocationsClient'

export default async function LocationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user!.id).single()
  const { data: locations } = await supabase.from('office_locations').select('*').eq('org_id', profile!.org_id).order('name')
  return <LocationsClient locations={locations ?? []} />
}
