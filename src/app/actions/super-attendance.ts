'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function assertSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'super_admin') throw new Error('Forbidden')
  return user.id
}

function safeRole(e: unknown): string {
  if (e instanceof Error) return e.message
  return 'Unauthorized'
}

// Fetch attendance record untuk 1 karyawan di 1 tanggal spesifik
// Dipakai modal Edit Jam buat preload value existing
export async function getEmployeeAttendance(userId: string, date: string) {
  try {
    await assertSuperAdmin()
  } catch (e) {
    return { error: safeRole(e) }
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('attendances')
    .select('check_in_time, check_out_time, notes')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()
  if (error) return { error: error.message }
  return { data }
}

// Fetch count attendance per user dalam range (untuk display di list)
// Dipakai saat org di-expand, biar nggak ngeload semua row
export async function getAttendanceCounts(opts: {
  userIds: string[]
  startDate: string
  endDate: string
}) {
  try {
    await assertSuperAdmin()
  } catch (e) {
    return { error: safeRole(e) }
  }
  if (!opts.userIds.length) return { data: {} as Record<string, number> }

  const admin = createAdminClient()

  // Paginasi 1000/request (bypass Supabase cap), count per user client-side
  const counts: Record<string, number> = {}
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await admin
      .from('attendances')
      .select('user_id')
      .in('user_id', opts.userIds)
      .gte('date', opts.startDate)
      .lte('date', opts.endDate)
      .range(from, from + 999)
    if (error) return { error: error.message }
    if (!data?.length) break
    for (const r of data) {
      counts[r.user_id] = (counts[r.user_id] ?? 0) + 1
    }
    if (data.length < 1000) break
  }
  return { data: counts }
}

export async function resetAttendanceRange(opts: {
  userIds: string[]
  startDate: string
  endDate: string
  scope: 'employee' | 'org' | 'all'
}) {
  if (!opts.userIds.length) return { error: 'Tidak ada karyawan dipilih' }
  if (!opts.startDate || !opts.endDate) return { error: 'Range tanggal tidak valid' }
  if (opts.startDate > opts.endDate) return { error: 'Tanggal mulai harus sebelum tanggal akhir' }

  let userId: string
  try {
    userId = await assertSuperAdmin()
  } catch (e) {
    return { error: safeRole(e) }
  }

  const admin = createAdminClient()

  // Fetch records yang akan dihapus (paginasi 1000/request, bypass Supabase cap)
  const records: Array<{ id: string; check_in_photo_url: string | null; check_out_photo_url: string | null }> = []
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await admin
      .from('attendances')
      .select('id, check_in_photo_url, check_out_photo_url')
      .in('user_id', opts.userIds)
      .gte('date', opts.startDate)
      .lte('date', opts.endDate)
      .range(from, from + 999)
    if (error) return { error: error.message }
    if (!data?.length) break
    records.push(...data)
    if (data.length < 1000) break
  }

  // Collect photo paths (extract relative path dari public URL)
  const photoPaths: string[] = []
  for (const r of records) {
    for (const url of [r.check_in_photo_url, r.check_out_photo_url]) {
      if (!url) continue
      const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/attendance-photos\/(.+)$/)
      if (match) photoPaths.push(match[1])
    }
  }

  // Hapus photos dari storage (best-effort)
  let photosDeleted = 0
  if (photoPaths.length > 0) {
    try {
      const { error: storageErr } = await admin.storage.from('attendance-photos').remove(photoPaths)
      if (!storageErr) photosDeleted = photoPaths.length
    } catch {}
  }

  // Hapus attendance records
  const { error: deleteErr } = await admin
    .from('attendances')
    .delete()
    .in('user_id', opts.userIds)
    .gte('date', opts.startDate)
    .lte('date', opts.endDate)

  if (deleteErr) return { error: deleteErr.message }

  revalidatePath('/dashboard/super-attendance')
  return {
    success: true,
    deleted: records.length,
    photos: photosDeleted,
    actor: userId,
  }
}

// Fetch attendance (check_in/out) untuk list user di 1 tanggal spesifik
// Dipakai di list buat nampilin jam per karyawan
export async function getAttendanceByDate(opts: {
  userIds: string[]
  date: string
}) {
  try {
    await assertSuperAdmin()
  } catch (e) {
    return { error: safeRole(e) }
  }
  if (!opts.userIds.length) return { data: {} as Record<string, { in: string | null; out: string | null }> }
  if (!opts.date) return { error: 'date diperlukan' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('attendances')
    .select('user_id, check_in_time, check_out_time')
    .in('user_id', opts.userIds)
    .eq('date', opts.date)

  if (error) return { error: error.message }

  const map: Record<string, { in: string | null; out: string | null }> = {}
  for (const r of data ?? []) {
    map[r.user_id] = { in: r.check_in_time, out: r.check_out_time }
  }
  return { data: map }
}

export async function overrideAttendance(opts: {
  userId: string
  date: string
  checkInTime: string | null
  checkOutTime: string | null
  notes?: string
}) {
  if (!opts.userId) return { error: 'user_id diperlukan' }
  if (!opts.date) return { error: 'date diperlukan' }

  let actorId: string
  try {
    actorId = await assertSuperAdmin()
  } catch (e) {
    return { error: safeRole(e) }
  }

  const admin = createAdminClient()

  const { data: employee } = await admin
    .from('profiles')
    .select('org_id, full_name')
    .eq('id', opts.userId)
    .single()
  if (!employee) return { error: 'Karyawan tidak ditemukan' }

  // Combine date + time → ISO dengan timezone UTC+7 (WIB)
  const checkIn = opts.checkInTime
    ? new Date(`${opts.date}T${opts.checkInTime}:00+07:00`).toISOString()
    : null
  const checkOut = opts.checkOutTime
    ? new Date(`${opts.date}T${opts.checkOutTime}:00+07:00`).toISOString()
    : null

  // Cek existing row biar tahu apakah ini insert atau update (buat verified_by log)
  const { data: existing } = await admin
    .from('attendances')
    .select('id, shift_id')
    .eq('user_id', opts.userId)
    .eq('date', opts.date)
    .maybeSingle()

  // Kalau existing row nggak punya shift_id, cari shift aktif user utk tanggal ini
  // biar trigger calculate_attendance_status bisa fire (calc late_minutes & status)
  let shiftId = existing?.shift_id ?? null
  if (!shiftId) {
    const { data: roster } = await admin
      .from('shift_schedules')
      .select('shift_id')
      .eq('user_id', opts.userId)
      .eq('date', opts.date)
      .maybeSingle()
    if (roster?.shift_id) {
      shiftId = roster.shift_id
    } else {
      const { data: empShift } = await admin
        .from('employee_shifts')
        .select('shift_id')
        .eq('user_id', opts.userId)
        .eq('is_active', true)
        .lte('effective_date', opts.date)
        .or(`end_date.is.null,end_date.gte.${opts.date}`)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (empShift?.shift_id) shiftId = empShift.shift_id
    }
  }

  const upsertPayload: Record<string, unknown> = {
    user_id: opts.userId,
    date: opts.date,
    check_in_time: checkIn,
    check_out_time: checkOut,
    notes: opts.notes?.trim() || null,
    is_verified: true,
    verified_by: actorId,
    method: 'manual_override',
  }

  if (shiftId) {
    upsertPayload.shift_id = shiftId
  } else if (checkIn) {
    // Shift tetap nggak ketemu → trigger nggak fire → set status manual biar muncul di laporan
    upsertPayload.status = 'hadir'
  }

  const { error } = await admin
    .from('attendances')
    .upsert(upsertPayload, { onConflict: 'user_id,date' })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/super-attendance')
  revalidatePath('/dashboard/attendance')
  revalidatePath('/dashboard/reports')
  revalidatePath('/dashboard')
  return { success: true }
}
