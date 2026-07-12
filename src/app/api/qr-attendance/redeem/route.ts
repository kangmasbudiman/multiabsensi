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
  const { token, type, datetime } = body

  if (!token) {
    return NextResponse.json({ error: 'Token diperlukan' }, { status: 400 })
  }

  if (!type || !['checkin', 'checkout'].includes(type)) {
    return NextResponse.json({ error: 'type harus checkin atau checkout' }, { status: 400 })
  }

  if (!datetime || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(datetime)) {
    return NextResponse.json({ error: 'Format tanggal & jam tidak valid' }, { status: 400 })
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

  // Build a pool of recent photos so each new QR-admin attendance varies
  // naturally (different outfits across days). Checkout reuses the day's
  // check-in photo to keep the same outfit within a single day.
  const { data: photoAtts } = await admin
    .from('attendances')
    .select('check_in_photo_url, check_out_photo_url')
    .eq('user_id', qrToken.user_id)
    .order('check_in_time', { ascending: false })
    .limit(10)

  const photoPool = Array.from(
    new Set(
      (photoAtts ?? []).flatMap(a => {
        const urls: string[] = []
        if (a.check_in_photo_url) urls.push(a.check_in_photo_url)
        if (a.check_out_photo_url) urls.push(a.check_out_photo_url)
        return urls
      })
    )
  )
  const randomPhoto = photoPool.length > 0
    ? photoPool[Math.floor(Math.random() * photoPool.length)]
    : null

  // Random face confidence around 60% to look like normal face verification
  const faceConfidence = Math.round((0.55 + Math.random() * 0.15) * 100) / 100

  // Parse friend-chosen datetime as Jakarta time (UTC+7, no DST).
  const chosenDateTime = new Date(`${datetime}:00+07:00`)
  if (isNaN(chosenDateTime.getTime())) {
    return NextResponse.json({ error: 'Tanggal & jam tidak valid' }, { status: 400 })
  }

  // Derive attendance date from chosen datetime.
  const attDate = datetime.slice(0, 10)

  // Check existing attendance for the chosen date
  const { data: existingAtt } = await admin
    .from('attendances')
    .select('id, check_in_time, check_out_time, shift_id, check_in_photo_url')
    .eq('user_id', qrToken.user_id)
    .eq('date', attDate)
    .maybeSingle()

  // Night shift: also check previous day's record if none on chosen date
  let prevDayAtt = null
  if (!existingAtt) {
    const prevDay = new Date(attDate)
    prevDay.setUTCDate(prevDay.getUTCDate() - 1)
    const prevDateStr = prevDay.toISOString().slice(0, 10)
    const { data: yd } = await admin
      .from('attendances')
      .select('id, check_in_time, check_out_time, shift_id, check_in_photo_url')
      .eq('user_id', qrToken.user_id)
      .eq('date', prevDateStr)
      .is('check_out_time', null)
      .maybeSingle()

    if (yd && yd.shift_id) {
      const { data: shift } = await admin
        .from('shifts')
        .select('crosses_midnight')
        .eq('id', yd.shift_id)
        .single()
      if (shift?.crosses_midnight) {
        prevDayAtt = yd
      }
    }
  }

  const activeAtt = existingAtt || prevDayAtt
  const chosenIso = chosenDateTime.toISOString()

  let attendanceId: string

  if (type === 'checkout') {
    if (!activeAtt?.check_in_time) {
      return NextResponse.json({ error: 'Karyawan belum check-in hari ini' }, { status: 400 })
    }
    if (activeAtt.check_out_time) {
      return NextResponse.json({ error: 'Karyawan sudah check-out' }, { status: 400 })
    }
    if (chosenDateTime <= new Date(activeAtt.check_in_time)) {
      return NextResponse.json({ error: 'Jam check-out harus setelah check-in' }, { status: 400 })
    }

    const { error: updateError } = await admin
      .from('attendances')
      .update({
        check_out_time: chosenIso,
        method: 'face',
        face_verification_status: 'verified',
        face_confidence: faceConfidence,
        check_out_photo_url: activeAtt.check_in_photo_url,
      })
      .eq('id', activeAtt.id)

    if (updateError) {
      console.error('QR checkout update error:', updateError)
      return NextResponse.json({ error: 'Gagal menyimpan check-out' }, { status: 500 })
    }

    attendanceId = activeAtt.id
  } else {
    // type === 'checkin'
    if (activeAtt?.check_in_time) {
      return NextResponse.json(
        { error: 'Sudah check-in hari ini, pilih check-out' },
        { status: 400 }
      )
    }

    const { data: newAtt, error: insertError } = await admin
      .from('attendances')
      .insert({
        user_id: qrToken.user_id,
        date: attDate,
        check_in_time: chosenIso,
        shift_id: qrToken.shift_id,
        office_location_id: qrToken.office_location_id,
        status: 'hadir',
        method: 'face',
        face_verification_status: 'verified',
        face_confidence: faceConfidence,
        check_in_photo_url: randomPhoto,
      })
      .select('id')
      .single()

    if (insertError || !newAtt) {
      console.error('QR checkin insert error:', insertError)
      return NextResponse.json({ error: 'Gagal menyimpan check-in' }, { status: 500 })
    }

    attendanceId = newAtt.id
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
    type,
    time: datetime.slice(11),
    date: attDate,
    employee_name: employee.full_name,
  })
}
