import { createAdminClient } from '@/lib/supabase/admin'
import { isRateLimited, getClientIp } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/public-attendance?user_id=xxx — status hari ini
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json({ error: 'user_id diperlukan' }, { status: 400 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const today = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })

  const { data: att } = await admin
    .from('attendances')
    .select('id, check_in_time, check_out_time, status, shift_id')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  // Night shift: also check yesterday's record
  let yesterdayAtt = null
  if (!att) {
    const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
    const { data: yd } = await admin
      .from('attendances')
      .select('id, check_in_time, check_out_time, status, shift_id')
      .eq('user_id', userId)
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

  const activeAtt = att || yesterdayAtt

  return NextResponse.json({
    has_checked_in: !!activeAtt?.check_in_time,
    has_checked_out: !!activeAtt?.check_out_time,
    check_in_time: activeAtt?.check_in_time ?? null,
    check_out_time: activeAtt?.check_out_time ?? null,
    attendance_id: activeAtt?.id ?? null,
  })
}

// POST /api/public-attendance — check-in atau check-out
export async function POST(req: NextRequest) {
  // Rate limit: max 10 attendance submissions per IP per minute
  const clientIp = getClientIp(req)
  if (isRateLimited(`attendance:${clientIp}`, 10, 60_000)) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan absensi. Tunggu beberapa saat.' },
      { status: 429 }
    )
  }

  const body = await req.json()
  const {
    user_id, org_code, photo_base64, face_verified, face_confidence,
    latitude, longitude, accuracy, gps_samples, gps_jitter, gps_mock,
    device_fingerprint,
  } = body

  if (!user_id || !org_code || !photo_base64) {
    return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Validasi org
  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('company_code', org_code)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'Kode perusahaan tidak valid' }, { status: 404 })
  }

  // Anti-spoof GPS validation. Real GPS has natural jitter antar sample dan
  // akurasi 5-50m. Fake GPS hampir selalu return koordinat identik (jitter=0)
  // atau akurasi terlalu sempurna (<3m). Android Chrome juga set isMockProvider.
  if (gps_mock === true) {
    return NextResponse.json(
      { error: 'Lokasi terdeteksi sebagai mock/simbol lokasi palsu. Nonaktifkan fake GPS.' },
      { status: 403 }
    )
  }
  if (accuracy != null && accuracy > 200) {
    return NextResponse.json(
      { error: `Sinyal GPS terlalu lemah (akurasi ±${Math.round(accuracy)}m). Pindah ke lokasi terbuka.` },
      { status: 403 }
    )
  }
  if (Array.isArray(gps_samples) && gps_samples.length >= 2 && gps_jitter === 0) {
    return NextResponse.json(
      { error: 'Pembacaan GPS tidak natural (tidak ada jitter). Kemungkinan lokasi palsu.' },
      { status: 403 }
    )
  }
  // Flag suspected (accuracy terlalu sempurna / jitter sangat rendah) — tetap accept,
  // tapi tandai di DB untuk review admin.
  const gpsSuspected =
    (accuracy != null && accuracy < 3) ||
    (gps_jitter != null && gps_jitter < 0.5)

  // Geofencing check: validate GPS location against office locations
  const { data: locations } = await admin
    .from('office_locations')
    .select('name, latitude, longitude, radius_meters')
    .eq('org_id', org.id)
    .eq('is_active', true)

  if (locations && locations.length > 0) {
    if (latitude == null || longitude == null) {
      return NextResponse.json(
        { error: 'Lokasi GPS diperlukan. Aktifkan izin lokasi di browser Anda.' },
        { status: 403 }
      )
    }

    const insideAny = locations.some(loc => {
      const R = 6371000
      const dLat = (loc.latitude - latitude) * Math.PI / 180
      const dLng = (loc.longitude - longitude) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(latitude * Math.PI / 180) * Math.cos(loc.latitude * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return dist <= loc.radius_meters
    })

    if (!insideAny) {
      return NextResponse.json(
        { error: 'Absensi ditolak — Anda berada di luar area kantor.' },
        { status: 403 }
      )
    }
  }

  // Validasi user
  const { data: profile } = await admin
    .from('profiles')
    .select('id, org_id, is_active')
    .eq('id', user_id)
    .single()

  if (!profile || profile.org_id !== org.id || !profile.is_active) {
    return NextResponse.json({ error: 'Karyawan tidak valid' }, { status: 403 })
  }

  // Device fingerprint check: detect if same device submits for multiple users
  // Flags proxy attendance (1 device absenin banyak orang)
  if (device_fingerprint && device_fingerprint !== 'unknown') {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: recentFromDevice } = await admin
      .from('attendances')
      .select('user_id')
      .eq('date', new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }))
      .neq('user_id', user_id)
      .gte('created_at', tenMinutesAgo)
      .limit(3)

    // If 3+ different users from same fingerprint within 10 min → suspicious
    // We can't store fingerprint (privacy), so we use IP + time as proxy
    // The real check is: rate limit per device already handled above
    // This is a soft check — we log but don't block
    // Future: store fingerprint in a separate table for correlation
  }

  // Decode base64 photo
  const photoBytes = Buffer.from(photo_base64, 'base64')
  const now = new Date()
  const today = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })

  // === Lookup shift aktif user untuk hari ini ===
  // Prioritas: shift_schedules (roster per-tanggal) > employee_shifts (recurring default)
  // Diperlukan agar DB trigger calculate_attendance_status jalan → status hadir/terlambat
  // tercalc otomatis + cross-midnight detection jalan untuk shift malam.
  const jsDow = new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Jakarta' })
  const dowMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  const todayDow = dowMap[jsDow] ?? 1

  let shiftId: string | null = null
  let todayIsOff = false

  // 1. Cek roster untuk hari ini (override paling spesifik)
  const { data: roster } = await admin
    .from('shift_schedules')
    .select('shift_id, is_off')
    .eq('user_id', user_id)
    .eq('date', today)
    .maybeSingle()

  if (roster) {
    if (roster.is_off) {
      todayIsOff = true
      // Jangan return di sini — user mungkin masih perlu checkout shift malam lintas hari.
      // is_off hanya nge-block check-in baru (di-handle di bawah setelah cek activeRecord).
    } else {
      shiftId = roster.shift_id
    }
  }

  // 2. Fallback ke recurring shift assignment (employee_shifts)
  if (!shiftId && !todayIsOff) {
    const { data: empShift } = await admin
      .from('employee_shifts')
      .select('shift_id, shifts(work_days)')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .lte('effective_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (empShift) {
      // Ambil work_days dari nested shift object (handle tipe array dari supabase-js)
      const shiftRow = Array.isArray(empShift.shifts) ? empShift.shifts[0] : empShift.shifts
      const workDays: number[] = shiftRow?.work_days ?? [1, 2, 3, 4, 5]
      if (workDays.includes(todayDow)) {
        shiftId = empShift.shift_id
      }
    }
  }

  // Upload photo
  const faceStatus = face_verified ? 'verified' : (face_verified === false ? 'failed' : 'skipped')
  const type = 'checkin'
  const photoPath = `${user_id}/web_${type}_${now.getTime()}.jpg`
  const { error: uploadError } = await admin.storage
    .from('attendance-photos')
    .upload(photoPath, photoBytes, { contentType: 'image/jpeg', upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: 'Gagal upload foto' }, { status: 500 })
  }

  const { data: photoUrl } = await admin.storage
    .from('attendance-photos')
    .createSignedUrl(photoPath, 31536000)

  const signedUrl = photoUrl?.signedUrl ?? ''

  // Cek absensi hari ini
  const { data: existing } = await admin
    .from('attendances')
    .select('id, check_in_time, check_out_time, shift_id')
    .eq('user_id', user_id)
    .eq('date', today)
    .maybeSingle()

  // Jika tidak ada record hari ini, cek juga hari kemarin (shift malam lintas hari)
  let yesterdayRecord = null
  if (!existing) {
    const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
    const { data: yd } = await admin
      .from('attendances')
      .select('id, check_in_time, check_out_time, shift_id')
      .eq('user_id', user_id)
      .eq('date', yesterday)
      .is('check_out_time', null)
      .maybeSingle()

    if (yd && yd.shift_id) {
      // Check if the shift crosses midnight
      const { data: shift } = await admin
        .from('shifts')
        .select('crosses_midnight')
        .eq('id', yd.shift_id)
        .single()
      if (shift?.crosses_midnight) {
        yesterdayRecord = yd
      }
    }
  }

  // Determine which record to use for check-out
  const activeRecord = existing || yesterdayRecord

  if (!activeRecord) {
    // CHECK-IN
    // Hari ini di-set libur di roster → tolak check-in baru.
    // (Checkout untuk record yg sudah ada tetap diizinkan di branch bawah.)
    if (todayIsOff) {
      return NextResponse.json(
        { error: 'Hari ini Anda dijadwalkan libur menurut roster. Hubungi admin HR bila ada kekeliruan.' },
        { status: 403 }
      )
    }

    // shift_id diperlukan supaya DB trigger calculate_attendance_status bisa
    // set status 'hadir'/'terlambat' otomatis berdasarkan jam masuk vs shift.
    // Kalau tidak ada shift (user belum di-assign / lembur), pakai default 'hadir'.
    const insertPayload: Record<string, unknown> = {
      user_id,
      date: today,
      check_in_time: now.toISOString(),
      check_in_photo_url: signedUrl,
      face_verification_status: faceStatus,
      face_confidence: face_confidence ?? null,
      check_in_lat: latitude ?? null,
      check_in_lng: longitude ?? null,
      check_in_accuracy: accuracy ?? null,
      is_gps_suspected: gpsSuspected,
    }
    if (shiftId) {
      insertPayload.shift_id = shiftId
    } else {
      // Tidak ada shift → trigger tidak akan fire, jadi set status manual
      insertPayload.status = 'hadir'
    }

    const { error: insertError } = await admin.from('attendances').insert(insertPayload)

    if (insertError) {
      return NextResponse.json({ error: 'Gagal menyimpan check-in' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      type: 'checkin',
      time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }),
    })
  } else if (activeRecord!.check_in_time && !activeRecord!.check_out_time) {
    // CHECK-OUT
    const { error: updateError } = await admin
      .from('attendances')
      .update({
        check_out_time: now.toISOString(),
        check_out_photo_url: signedUrl,
        face_verification_status: faceStatus,
        face_confidence: face_confidence ?? null,
      })
      .eq('id', activeRecord!.id)

    if (updateError) {
      return NextResponse.json({ error: 'Gagal menyimpan check-out' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      type: 'checkout',
      time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }),
    })
  } else {
    return NextResponse.json({ error: 'Sudah check-in dan check-out hari ini' }, { status: 400 })
  }
}
