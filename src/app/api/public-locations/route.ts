import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/public-locations?org_code=xxx
// Returns active office locations for geofencing check
export async function GET(req: NextRequest) {
  const orgCode = req.nextUrl.searchParams.get('org_code')
  if (!orgCode) {
    return NextResponse.json({ error: 'org_code diperlukan' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('company_code', orgCode)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'Perusahaan tidak valid' }, { status: 404 })
  }

  const { data: locations } = await admin
    .from('office_locations')
    .select('name, latitude, longitude, radius_meters')
    .eq('org_id', org.id)
    .eq('is_active', true)

  return NextResponse.json({
    locations: locations ?? [],
  })
}
