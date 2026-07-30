import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/office-locations/audit?location_id=xxx — riwayat perubahan 1 lokasi
// GET /api/office-locations/audit — semua riwayat di org (limit 50 terakhir)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 })
  }

  const locationId = req.nextUrl.searchParams.get('location_id')
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 200)

  let query = admin
    .from('office_location_audits')
    .select('id, location_id, location_name, action, changes, changed_by_name, changed_by_role, created_at')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data: audits, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ audits: audits ?? [] })
}
