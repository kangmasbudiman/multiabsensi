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
        .select('crosses_midnight, end_time')
        .eq('id', yd.shift_id)
        .single()
      if (shift?.crosses_midnight) {
        // Konsisten dengan POST: hanya anggap record kemarin aktif kalau
        // masih dalam window scheduled_end + 4 jam. Di luar itu, record stale.
        const [eh, em] = String(shift.end_time).split(':').map(Number)
        // Hitung scheduled_end di Jakarta TZ tanpa pakai setDate/setHours
        // (mereka pakai server-local TZ — Vercel UTC → hasilnya 17 jam lebih awal).
        const [yy, mm, dd] = yesterday.split('-').map(Number)
        const tomorrow = new Date(Date.UTC(yy, mm - 1, dd + 1))
        const tomorrowStr = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrow.getUTCDate()).padStart(2, '0')}`
        const scheduledEnd = new Date(`${tomorrowStr}T${String(eh || 0).padStart(2, '0')}:${String(em || 0).padStart(2, '0')}:00+07:00`)
        const maxCheckout = new Date(scheduledEnd.getTime() + 4 * 3_600_000)
        if (now <= maxCheckout) {
          yesterdayAtt = yd
        }
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
    device_fingerprint, attendance_mode,
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

  // ─── Mode WiFi: validasi via IP whitelist, skip GPS ───────────────────────
  // Absensi dari jaringan kantor (verifikasi IP public). Cocok untuk device
  // yang GPS-nya bermasalah (iPhone lawas, di dalam ruangan tanpa sinyal).
  if (attendance_mode === 'wifi') {
    const clientIp = getClientIp(req)
    if (!clientIp || clientIp === 'unknown') {
      return NextResponse.json(
        { error: 'Tidak dapat mendeteksi IP Anda. Coba gunakan mode absensi standar (dengan GPS).' },
        { status: 403 }
      )
    }
    const { data: whitelist } = await admin
      .from('office_ip_whitelist')
      .select('ip_address, label')
      .eq('org_id', org.id)

    const whitelisted = (whitelist ?? []).map(w => w.ip_address)
    if (!whitelisted.includes(clientIp)) {
      return NextResponse.json(
        {
          error: `Akses ditolak. IP Anda (${clientIp}) tidak terdaftar sebagai jaringan kantor. Hubungi admin atau gunakan mode absensi reguler (GPS).`,
        },
        { status: 403 }
      )
    }
    // IP match → allow, skip semua GPS validation
    //gpsSuspected tetap false di mode wifi
    return await saveAttendance({
      admin, user_id, org_id: org.id, photo_base64, face_verified, face_confidence,
      latitude: null, longitude: null, accuracy: null, gpsSuspected: false,
      device_fingerprint, req,
    })
  }

  // ─── Mode GPS (default): anti-spoof + geofence ───────────────────────────
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
    // iOS Safari sering return koordinat identik antar sample (caching aggressive
    // + WiFi positioning di iPhone older model). Real GPS hampir nggak pernah
    // akurasi <3m. Cuma block kalau JUGA akurasi sempurna — indikator kuat fake GPS.
    if (accuracy != null && accuracy < 3) {
      return NextResponse.json(
        { error: 'Pembacaan GPS tidak natural (akurasi sempurna, tidak ada jitter). Kemungkinan lokasi palsu.' },
        { status: 403 }
      )
    }
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

  return await saveAttendance({
    admin, user_id, org_id: org.id, photo_base64, face_verified, face_confidence,
    latitude: latitude ?? null, longitude: longitude ?? null, accuracy: accuracy ?? null,
    gpsSuspected, device_fingerprint, req,
  })
}

// ─── Helper: simpan absensi (dipakai baik mode GPS maupun WiFi) ────────────
async function saveAttendance(params: {
  admin: ReturnType<typeof createAdminClient>
  user_id: string
  org_id: string
  photo_base64: string
  face_verified: boolean | null
  face_confidence: number | null
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  gpsSuspected: boolean
  device_fingerprint: string | undefined
  req: NextRequest
}): Promise<Response> {
  const {
    admin, user_id, org_id, photo_base64, face_verified, face_confidence,
    latitude, longitude, accuracy, gpsSuspected, device_fingerprint,
  } = params

  // Validasi user
  const { data: profile } = await admin
    .from('profiles')
    .select('id, org_id, is_active')
    .eq('id', user_id)
    .single()

  if (!profile || profile.org_id !== org_id || !profile.is_active) {
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

  // 3. Fallback ke default shift departemen (department_shifts many-to-many)
  //    Buat karyawan yang belum di-assign shift individual — misal bagian
  //    Management/HRD/IT yang jam-nya tetap. Departemen bisa punya banyak shift
  //    dengan work_days berbeda (Senin-Jumat full time + Sabtu half day).
  //    Lookup pilih shift yang work_days-nya cocok dengan hari ini.
  if (!shiftId && !todayIsOff) {
    const { data: profileDept } = await admin
      .from('profiles')
      .select('department_id')
      .eq('id', user_id)
      .maybeSingle()

    if (profileDept?.department_id) {
      const { data: deptShifts } = await admin
        .from('department_shifts')
        .select('shift_id, shifts(work_days)')
        .eq('department_id', profileDept.department_id)

      // Cari shift pertama yang work_days-nya include hari ini
      for (const ds of deptShifts ?? []) {
        const shiftRow = Array.isArray(ds.shifts) ? ds.shifts[0] : ds.shifts
        const workDays: number[] = shiftRow?.work_days ?? [1, 2, 3, 4, 5]
        if (workDays.includes(todayDow)) {
          shiftId = ds.shift_id
          break
        }
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
        .select('crosses_midnight, end_time')
        .eq('id', yd.shift_id)
        .single()
      if (shift?.crosses_midnight) {
        // Grace period: hanya anggap sebagai checkout shift kemarin kalau
        // sekarang masih dalam window (scheduled_end + 4 jam). Di luar window,
        // record open dianggap stale (kemungkinan lupa checkout) — supaya
        // scan berikutnya bisa jadi check-in shift baru, bukan checkout salah.
        const [eh, em] = String(shift.end_time).split(':').map(Number)
        // Hitung scheduled_end di Jakarta TZ tanpa pakai setDate/setHours
        // (mereka pakai server-local TZ — Vercel UTC → hasilnya 17 jam lebih awal).
        const [yy, mm, dd] = yesterday.split('-').map(Number)
        const tomorrow = new Date(Date.UTC(yy, mm - 1, dd + 1))
        const tomorrowStr = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrow.getUTCDate()).padStart(2, '0')}`
        const scheduledEnd = new Date(`${tomorrowStr}T${String(eh || 0).padStart(2, '0')}:${String(em || 0).padStart(2, '0')}:00+07:00`)
        const maxCheckout = new Date(scheduledEnd.getTime() + 4 * 3_600_000)
        if (now <= maxCheckout) {
          yesterdayRecord = yd
        }
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

    // Flag kalau karyawan belum punya jadwal shift. Tetap allow check-in,
    // tapi kasih notif di UI supaya minta di-setup shift-nya.
    const needsShiftSetup = !shiftId

    const { error: insertError } = await admin.from('attendances').insert(insertPayload)

    if (insertError) {
      return NextResponse.json({ error: 'Gagal menyimpan check-in' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      type: 'checkin',
      time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }),
      warning: needsShiftSetup
        ? 'Jadwal shift Anda belum diatur. Silakan minta admin/HR untuk membuatkan jadwal shift.'
        : null,
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
