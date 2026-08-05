import { createAdminClient } from '@/lib/supabase/admin'
import { isRateLimited, getClientIp } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/custom-attendance/submit
// Public: validate magic link token + whitelist, save attendance dengan custom date/time
export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req)
  if (isRateLimited(`custom-att:${clientIp}`, 10, 60_000)) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan. Tunggu beberapa saat.' },
      { status: 429 }
    )
  }

  const body = await req.json()
  const { token, user_id, date, check_in_time, check_out_time, photo_base64 } = body as {
    token?: string
    user_id?: string
    date?: string
    check_in_time?: string | null
    check_out_time?: string | null
    photo_base64?: string
  }

  if (!token) {
    return NextResponse.json({ error: 'Token diperlukan' }, { status: 400 })
  }
  if (!user_id) {
    return NextResponse.json({ error: 'user_id diperlukan' }, { status: 400 })
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Format tanggal tidak valid' }, { status: 400 })
  }
  if (check_in_time && !/^\d{2}:\d{2}$/.test(check_in_time)) {
    return NextResponse.json({ error: 'Format jam masuk tidak valid' }, { status: 400 })
  }
  if (check_out_time && !/^\d{2}:\d{2}$/.test(check_out_time)) {
    return NextResponse.json({ error: 'Format jam keluar tidak valid' }, { status: 400 })
  }
  if (!check_in_time && !check_out_time) {
    return NextResponse.json({ error: 'Isi minimal jam masuk atau jam keluar' }, { status: 400 })
  }
  if (!photo_base64) {
    return NextResponse.json({ error: 'Foto diperlukan' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Validate token
  const { data: link } = await admin
    .from('custom_attendance_links')
    .select('id, org_id, is_active, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!link || !link.is_active) {
    return NextResponse.json({ error: 'Token tidak valid atau sudah dinonaktifkan' }, { status: 400 })
  }
  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    return NextResponse.json({ error: 'Token sudah kadaluarsa' }, { status: 400 })
  }

  // 2. Whitelist check
  const { data: wl } = await admin
    .from('custom_attendance_link_users')
    .select('user_id')
    .eq('link_id', link.id)
    .eq('user_id', user_id)
    .maybeSingle()

  if (!wl) {
    return NextResponse.json(
      { error: 'Anda tidak terdaftar dalam whitelist link ini' },
      { status: 403 }
    )
  }

  // 3. Validate user active + org match
  const { data: profile } = await admin
    .from('profiles')
    .select('org_id, is_active, full_name')
    .eq('id', user_id)
    .maybeSingle()

  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: 'Karyawan tidak valid' }, { status: 403 })
  }
  if (profile.org_id !== link.org_id) {
    return NextResponse.json({ error: 'Karyawan bukan bagian dari perusahaan ini' }, { status: 403 })
  }

  // 4. Parse datetime (Jakarta time)
  const checkIn = check_in_time
    ? new Date(`${date}T${check_in_time}:00+07:00`).toISOString()
    : null
  const checkOut = check_out_time
    ? new Date(`${date}T${check_out_time}:00+07:00`).toISOString()
    : null

  if (checkIn && checkOut && new Date(checkOut) <= new Date(checkIn)) {
    return NextResponse.json(
      { error: 'Jam keluar harus setelah jam masuk' },
      { status: 400 }
    )
  }

  // 5. Cek existing row utk dapat shift_id existing
  const { data: existing } = await admin
    .from('attendances')
    .select('id, shift_id, check_in_time, check_out_time')
    .eq('user_id', user_id)
    .eq('date', date)
    .maybeSingle()

  // 6. Resolve shift_id kalau nggak ada di existing (3-tier: roster → employee_shifts → department_shifts)
  let shiftId: string | null = existing?.shift_id ?? null

  if (!shiftId) {
    const { data: roster } = await admin
      .from('shift_schedules')
      .select('shift_id')
      .eq('user_id', user_id)
      .eq('date', date)
      .maybeSingle()
    if (roster?.shift_id) {
      shiftId = roster.shift_id
    } else {
      const { data: empShift } = await admin
        .from('employee_shifts')
        .select('shift_id')
        .eq('user_id', user_id)
        .eq('is_active', true)
        .lte('effective_date', date)
        .or(`end_date.is.null,end_date.gte.${date}`)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (empShift?.shift_id) shiftId = empShift.shift_id
    }
  }

  // 7. Upload photo
  const photoBytes = Buffer.from(photo_base64, 'base64')
  const photoPath = `${user_id}/web_custom_${Date.now()}.jpg`
  const { error: uploadError } = await admin.storage
    .from('attendance-photos')
    .upload(photoPath, photoBytes, { contentType: 'image/jpeg', upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: 'Gagal upload foto' }, { status: 500 })
  }

  const { data: urlData } = await admin.storage
    .from('attendance-photos')
    .createSignedUrl(photoPath, 31536000)
  const signedUrl = urlData?.signedUrl ?? ''

  // 8. Build upsert payload
  const upsertPayload: Record<string, unknown> = {
    user_id,
    date,
    check_in_time: checkIn,
    check_out_time: checkOut,
    method: 'custom_link',
    is_verified: true,
    notes: `Via custom link`,
  }

  // Photo: assign ke check_in kalau baru/updated, atau check_out kalau cuma checkout
  const newCheckIn = checkIn && !existing?.check_in_time
  if (newCheckIn) {
    upsertPayload.check_in_photo_url = signedUrl
  }
  if (checkOut) {
    upsertPayload.check_out_photo_url = signedUrl
  }
  // Kalau update existing dengan check_in berubah, tetap update foto check_in
  if (checkIn && existing?.check_in_time && !checkOut) {
    upsertPayload.check_in_photo_url = signedUrl
  }

  if (shiftId) {
    upsertPayload.shift_id = shiftId
  } else if (checkIn) {
    upsertPayload.status = 'hadir'
  }

  const { error: upsertError } = await admin
    .from('attendances')
    .upsert(upsertPayload, { onConflict: 'user_id,date' })

  if (upsertError) {
    console.error('Custom attendance upsert error:', upsertError)
    return NextResponse.json({ error: 'Gagal menyimpan absensi' }, { status: 500 })
  }

  // 9. Audit log
  try {
    await admin.from('custom_attendance_submissions').insert({
      link_id: link.id,
      user_id,
      attendance_date: date,
      check_in_time: checkIn,
      check_out_time: checkOut,
      ip_address: clientIp,
    })
  } catch (e) {
    console.error('Audit log insert failed:', e)
  }

  return NextResponse.json({
    success: true,
    employee_name: profile.full_name,
    date,
    check_in_time: check_in_time ?? null,
    check_out_time: check_out_time ?? null,
  })
}
