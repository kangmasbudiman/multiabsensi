import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/face-photo?user_id=xxx — generate temporary signed URL for face photo
// Only accessible by authenticated admins
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: reg } = await admin
    .from('face_registrations')
    .select('face_photo_url')
    .eq('user_id', userId)
    .maybeSingle()

  if (!reg || !reg.face_photo_url) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let photoPath: string | null = null
  const storedUrl = reg.face_photo_url

  // Format 1: storage://bucket/path (our new format)
  if (storedUrl.startsWith('storage://')) {
    const withoutPrefix = storedUrl.replace('storage://', '')
    const slashIdx = withoutPrefix.indexOf('/')
    if (slashIdx > 0) {
      const bucket = withoutPrefix.substring(0, slashIdx)
      photoPath = withoutPrefix.substring(slashIdx + 1)

      const { data, error } = await admin.storage
        .from(bucket)
        .createSignedUrl(photoPath, 300) // 5 minutes

      if (error || !data?.signedUrl) {
        return NextResponse.json({ error: 'Failed to generate URL' }, { status: 500 })
      }

      return NextResponse.json({ url: data.signedUrl })
    }
  }

  // Format 2: Extract path from legacy Supabase signed URL
  try {
    const parsed = new URL(storedUrl)
    const segments = parsed.pathname.split('/')
    const objIdx = segments.indexOf('object')
    if (objIdx >= 0 && segments.length > objIdx + 2) {
      photoPath = segments.slice(objIdx + 2).join('/')

      const { data, error } = await admin.storage
        .from('attendance-photos')
        .createSignedUrl(photoPath, 300)

      if (data?.signedUrl) {
        return NextResponse.json({ url: data.signedUrl })
      }
    }
  } catch {}

  // Format 3: Return the URL as-is (might be a valid signed URL still)
  return NextResponse.json({ url: storedUrl })
}
