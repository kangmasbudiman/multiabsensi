import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/public-face-photo?user_id=xxx&org_code=xxx
// Returns a short-lived signed URL for the employee's registered face photo.
// Used during the confirmation step of 1:N face identification.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id')
  const orgCode = req.nextUrl.searchParams.get('org_code')

  if (!userId || !orgCode) {
    return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Validate org
  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('company_code', orgCode)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'Perusahaan tidak valid' }, { status: 404 })
  }

  // Validate user belongs to org and is active
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('org_id', org.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Karyawan tidak valid' }, { status: 404 })
  }

  // Get face registration photo
  const { data: faceReg } = await admin
    .from('face_registrations')
    .select('face_photo_url')
    .eq('user_id', userId)
    .maybeSingle()

  if (!faceReg || !faceReg.face_photo_url) {
    return NextResponse.json({ url: null })
  }

  return NextResponse.json({ url: faceReg.face_photo_url })
}
