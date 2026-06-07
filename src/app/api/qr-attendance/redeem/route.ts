import { createAdminClient } from '@/lib/supabase/admin'
import { isRateLimited, getClientIp } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/qr-attendance/redeem — Public: confirm and record attendance
export async function POST(req: NextRequest) {
  // Rate limit: max 10 per IP per minute
  const clientIp = getClientIp(req)
  if (isRateLimited(`qr-redeem:${clientIp}`, 10, 60_000)) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan. Tunggu beberapa saat.' },
      { status: 429 }
    )
  }

  const body = await req.json()
  const { token } = body

  if (!token) {
    return NextResponse.json({ error: 'Token diperlukan' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Look up and validate token
  const { data: qrToken } = await admin
    .from('qr_tokens')
    .select('id, token, status, expires_at, type, user_id, org_id, shift_id, office_location_id, generated_by')
    .eq('token', token)
    .single()

  if (!qrToken) {
    return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 404 })
  }

  if (qrToken.status !== 'active') {
    return NextResponse.json(
      { error: qrToken.status === 'used' ? 'Token sudah digunakan' : 'Token sudah kadaluarsa' },
      { status: 400 }
    )
  }

  const now = new Date()
  if (new Date(qrToken.expires_at) <= now) {
    await admin.from('qr_tokens').update({ status: 'expired' }).eq('id', qrToken.id)
    return NextResponse.json({ error: 'Token sudah kadaluarsa' }, { status: 400 })
  }

  // Get employee profile
  const { data: employee } = await admin
    .from('profiles')
    .select('id, full_name, is_active')
    .eq('id', qrToken.user_id)
    .single()

  if (!employee || !employee.is_active) {
    return NextResponse.json({ error: 'Karyawan tidak valid' }, { status: 403 })
  }

  const today = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })

  // Check existing attendance for today
  const { data: existingAtt } = await admin
    .from('attendances')
    .select('id, check_in_time, check_out_time, shift_id')
    .eq('user_id', qrToken.user_id)
    .eq('date', today)
    .maybeSingle()

  // Night shift: also check yesterday's record if no record today
  let yesterdayAtt = null
  if (!existingAtt) {
    const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
    const { data: yd } = await admin
      .from('attendances')
      .select('id, check_in_time, check_out_time, shift_id')
      .eq('user_id', qrToken.user_id)
      .eq('date', yesterday)
      .is('check_out_time', null)
      .maybeSingle()

    if (yd && yd.shift_id) {
      const { data: shift } = await admin
        .from('shifts')
        .select('crosses_midnight')
        .eq('id', yd.shift_id)
        .single()
      if (shift?.crosses_midnight) {
        yesterdayAtt = yd
      }
    }
  }

  const activeAtt = existingAtt || yesterdayAtt

  let attendanceType: 'checkin' | 'checkout'
  let attendanceId: string

  if (qrToken.type === 'checkout') {
    // QR specifically for checkout
    if (!activeAtt?.check_in_time) {
      return NextResponse.json({ error: 'Karyawan belum check-in' }, { status: 400 })
    }
    if (activeAtt.check_out_time) {
      return NextResponse.json({ error: 'Karyawan sudah check-out' }, { status: 400 })
    }

    // Update existing record with checkout
    const { error: updateError } = await admin
      .from('attendances')
      .update({
        check_out_time: now.toISOString(),
        method: 'qr_admin',
        is_verified: true,
        verified_by: qrToken.generated_by,
        notes: 'QR Admin Check-out',
      })
      .eq('id', activeAtt.id)

    if (updateError) {
      console.error('QR checkout update error:', updateError)
      return NextResponse.json({ error: 'Gagal menyimpan check-out' }, { status: 500 })
    }

    attendanceType = 'checkout'
    attendanceId = activeAtt.id
  } else {
    // QR for checkin
    if (activeAtt?.check_in_time) {
      // Already checked in — use as checkout instead
      if (activeAtt.check_out_time) {
        return NextResponse.json({ error: 'Sudah check-in dan check-out' }, { status: 400 })
      }

      const { error: updateError } = await admin
        .from('attendances')
        .update({
          check_out_time: now.toISOString(),
          method: 'qr_admin',
          is_verified: true,
          verified_by: qrToken.generated_by,
          notes: 'QR Admin Check-out',
        })
        .eq('id', activeAtt.id)

      if (updateError) {
        console.error('QR checkout update error:', updateError)
        return NextResponse.json({ error: 'Gagal menyimpan check-out' }, { status: 500 })
      }

      attendanceType = 'checkout'
      attendanceId = activeAtt.id
    } else {
      // No record yet — insert check-in
      const { data: newAtt, error: insertError } = await admin
        .from('attendances')
        .insert({
          user_id: qrToken.user_id,
          date: today,
          check_in_time: now.toISOString(),
          shift_id: qrToken.shift_id,
          office_location_id: qrToken.office_location_id,
          status: 'hadir',
          method: 'qr_admin',
          is_verified: true,
          verified_by: qrToken.generated_by,
          notes: 'QR Admin Check-in',
        })
        .select('id')
        .single()

      if (insertError || !newAtt) {
        console.error('QR checkin insert error:', insertError)
        return NextResponse.json({ error: 'Gagal menyimpan check-in' }, { status: 500 })
      }

      attendanceType = 'checkin'
      attendanceId = newAtt.id
    }
  }

  // Mark token as used
  await admin
    .from('qr_tokens')
    .update({
      status: 'used',
      used_at: now.toISOString(),
      attendance_id: attendanceId,
      ip_address: clientIp,
    })
    .eq('id', qrToken.id)

  return NextResponse.json({
    success: true,
    type: attendanceType,
    time: timeStr,
    employee_name: employee.full_name,
  })
}
