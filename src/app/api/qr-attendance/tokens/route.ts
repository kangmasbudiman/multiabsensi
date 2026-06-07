import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/qr-attendance/tokens?org_id=xxx — Fetch today's QR tokens for a company
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const orgId = req.nextUrl.searchParams.get('org_id')
  if (!orgId) {
    return NextResponse.json({ error: 'org_id diperlukan' }, { status: 400 })
  }

  const admin = createAdminClient()
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })

  const { data: tokens } = await admin
    .from('qr_tokens')
    .select(`
      id, token, status, type, expires_at, used_at, created_at, ip_address,
      user:profiles!qr_tokens_user_id_fkey(full_name, employee_id),
      generator:profiles!qr_tokens_generated_by_fkey(full_name)
    `)
    .eq('org_id', orgId)
    .gte('created_at', today)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ tokens: tokens ?? [] })
}
