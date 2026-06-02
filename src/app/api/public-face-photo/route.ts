import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/public-face-photo?user_id=xxx&org_code=xxx
// Returns a short-lived signed URL for the employee's registered face photo.
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

  const storedUrl = faceReg.face_photo_url

  // Format: storage://bucket/path
  if (storedUrl.startsWith('storage://')) {
    const withoutPrefix = storedUrl.replace('storage://', '')
    const slashIdx = withoutPrefix.indexOf('/')
    if (slashIdx > 0) {
      const bucket = withoutPrefix.substring(0, slashIdx)
      const photoPath = withoutPrefix.substring(slashIdx + 1)

      const { data } = await admin.storage
        .from(bucket)
        .createSignedUrl(photoPath, 60) // 60-second expiry

      return NextResponse.json({ url: data?.signedUrl ?? null })
    }
  }

  // Fallback: return URL as-is
  return NextResponse.json({ url: storedUrl })
}
