import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/public-recent-attendance?org_code=xxx
// Returns last 15 check-ins for today (public, for absen page)
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
    return NextResponse.json({ records: [] })
  }

  // Use Indonesia timezone for "today"
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })

  const { data } = await admin
    .from('attendances')
    .select('check_in_time, check_out_time, face_verification_status, profiles!inner(full_name, employee_id, position)')
    .eq('date', today)
    .eq('profiles.org_id', org.id)
    .not('check_in_time', 'is', null)
    .order('check_in_time', { ascending: false })
    .limit(15)

  const records = (data ?? []).map(r => {
    const p = r.profiles as unknown as { full_name: string; employee_id: string | null; position: string | null }
    return {
      full_name: p?.full_name ?? 'Unknown',
      employee_id: p?.employee_id ?? null,
      position: p?.position ?? null,
      check_in_time: r.check_in_time,
      check_out_time: r.check_out_time,
      face_verified: r.face_verification_status === 'verified',
    }
  })

  return NextResponse.json({ records })
}
