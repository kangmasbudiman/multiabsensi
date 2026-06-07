import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isRateLimited, getClientIp } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'

// POST /api/qr-attendance/generate — Admin generates a QR token for an employee
export async function POST(req: NextRequest) {
  // Rate limit: max 20 generate per admin per minute
  const clientIp = getClientIp(req)
  if (isRateLimited(`qr-gen:${clientIp}`, 20, 60_000)) {
    return NextResponse.json(
      { error: 'Terlalu banyak permintaan. Tunggu beberapa saat.' },
      { status: 429 }
    )
  }

  // Authenticate admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Verify admin role
  const { data: adminProfile } = await admin
    .from('profiles')
    .select('id, org_id, role')
    .eq('id', user.id)
    .single()

  if (!adminProfile || adminProfile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Akses ditolak — hanya Super Admin' }, { status: 403 })
  }

  // Parse request body
  const body = await req.json()
  const { user_id, org_id, type = 'checkin', expiry_minutes = 30 } = body

  if (!user_id) {
    return NextResponse.json({ error: 'user_id diperlukan' }, { status: 400 })
  }

  if (!org_id) {
    return NextResponse.json({ error: 'org_id diperlukan' }, { status: 400 })
  }

  if (!['checkin', 'checkout'].includes(type)) {
    return NextResponse.json({ error: 'type harus checkin atau checkout' }, { status: 400 })
  }

  // Validate target employee
  const { data: employee } = await admin
    .from('profiles')
    .select('id, full_name, employee_id, org_id, is_active')
    .eq('id', user_id)
    .single()

  if (!employee || employee.org_id !== org_id || !employee.is_active) {
    return NextResponse.json({ error: 'Karyawan tidak valid' }, { status: 404 })
  }

  // Check today's attendance
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
  const { data: existingAtt } = await admin
    .from('attendances')
    .select('id, check_in_time, check_out_time')
    .eq('user_id', user_id)
    .eq('date', today)
    .maybeSingle()

  if (type === 'checkin' && existingAtt?.check_in_time) {
    return NextResponse.json({ error: 'Karyawan sudah check-in hari ini' }, { status: 400 })
  }
  if (type === 'checkout' && existingAtt?.check_out_time) {
    return NextResponse.json({ error: 'Karyawan sudah check-out hari ini' }, { status: 400 })
  }
  if (type === 'checkout' && !existingAtt?.check_in_time) {
    return NextResponse.json({ error: 'Karyawan belum check-in hari ini' }, { status: 400 })
  }

  // Find employee's active shift for today
  const dayOfWeek = new Date().getDay() // 0=Sun, 1=Mon, ...
  const { data: schedule } = await admin
    .from('employee_shifts')
    .select('shift_id, shifts(id, name, start_time, end_time, late_tolerance_minutes)')
    .eq('user_id', user_id)
    .single()

  // Find default office location
  const { data: officeLoc } = await admin
    .from('office_locations')
    .select('id')
    .eq('org_id', org_id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  // Calculate expiry
  const now = new Date()
  const expiresAt = new Date(now.getTime() + expiry_minutes * 60_000)

  // Insert QR token
  const { data: qrToken, error: insertError } = await admin
    .from('qr_tokens')
    .insert({
      org_id: org_id,
      user_id,
      generated_by: adminProfile.id,
      shift_id: schedule?.shift_id ?? null,
      office_location_id: officeLoc?.id ?? null,
      type,
      status: 'active',
      expires_at: expiresAt.toISOString(),
    })
    .select('token')
    .single()

  if (insertError || !qrToken) {
    console.error('QR token insert error:', insertError)
    return NextResponse.json({ error: 'Gagal membuat QR token' }, { status: 500 })
  }

  // Generate QR code data URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'http://localhost:3000'
  const qrUrl = `${baseUrl}/qr-checkin/${qrToken.token}`
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 256,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
  })

  return NextResponse.json({
    success: true,
    token: qrToken.token,
    qr_data_url: qrDataUrl,
    qr_url: qrUrl,
    expires_at: expiresAt.toISOString(),
    employee_name: employee.full_name,
    employee_id: employee.employee_id,
    type,
  })
}
