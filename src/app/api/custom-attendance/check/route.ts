import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/custom-attendance/check?token=XXX&user_id=YYY
// Public: check apakah user_id ada di whitelist link ini
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const userId = req.nextUrl.searchParams.get('user_id')

  if (!token || !userId) {
    return NextResponse.json({ allowed: false, error: 'Token dan user_id diperlukan' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Validate token
  const { data: link } = await admin
    .from('custom_attendance_links')
    .select('id, is_active, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!link || !link.is_active) {
    return NextResponse.json({ allowed: false, error: 'Token tidak valid' })
  }
  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    return NextResponse.json({ allowed: false, error: 'Token kadaluarsa' })
  }

  // Check whitelist
  const { data: wl } = await admin
    .from('custom_attendance_link_users')
    .select('user_id')
    .eq('link_id', link.id)
    .eq('user_id', userId)
    .maybeSingle()

  return NextResponse.json({ allowed: !!wl })
}
