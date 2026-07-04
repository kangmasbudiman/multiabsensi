import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import AttendanceClient from './AttendanceClient'

export const dynamic = 'force-dynamic'

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; search?: string; status?: string; page?: string }>
}) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user!.id).single()
  const orgId = profile!.org_id!

  const params = await searchParams
  const today = format(new Date(), 'yyyy-MM-dd')
  const selectedDate = params.date ?? today
  const search = params.search ?? ''
  const statusFilter = params.status ?? 'all'
  const page = parseInt(params.page ?? '1')
  const pageSize = 20

  // Ambil semua karyawan aktif (pakai admin client bypass RLS)
  const { data: employees } = await admin
    .from('profiles')
    .select('id, full_name, employee_id, position, avatar_url')
    .eq('org_id', orgId)
    .eq('role', 'employee')
    .eq('is_active', true)
    .order('full_name')

  // Ambil absensi (admin client bypass RLS)
  const employeeIds = (employees ?? []).map(e => e.id)
  const { data: attendances, error: attError } = await admin
    .from('attendances')
    .select('user_id, check_in_time, check_out_time, check_in_lat, check_in_lng, check_in_accuracy, status, is_lembur, notes, check_in_photo_url, check_out_photo_url, face_verification_status, face_confidence, method, photo_purged_at')
    .eq('date', selectedDate)
    .in('user_id', employeeIds.length > 0 ? employeeIds : ['__none__'])

  if (attError) console.error('Attendance query error:', attError)

  const attendanceMap = new Map((attendances ?? []).map(a => [a.user_id, a]))

  // Night shift check: for employees without attendance today,
  // check if they have an active night shift from yesterday (not yet checked out)
  const employeesWithoutAttendance = (employees ?? []).filter(e => !attendanceMap.has(e.id))
  let nightShiftFromYesterday = new Map<string, { check_in_time: string; shift_name: string }>()

  if (employeesWithoutAttendance.length > 0) {
    const yesterday = new Date(new Date(selectedDate + 'T00:00:00').getTime() - 86400000)
      .toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
    const empIds = employeesWithoutAttendance.map(e => e.id)

    const { data: yesterdayAtts } = await admin
      .from('attendances')
      .select('user_id, check_in_time, shift_id, shifts!inner(name, crosses_midnight)')
      .eq('date', yesterday)
      .in('user_id', empIds.length > 0 ? empIds : ['__none__'])
      .is('check_out_time', null)
      .eq('shifts.crosses_midnight', true)

    for (const ya of (yesterdayAtts ?? [])) {
      const shift = (ya.shifts as any)?.[0] ?? ya.shifts as any
      nightShiftFromYesterday.set(ya.user_id, {
        check_in_time: ya.check_in_time,
        shift_name: shift?.name ?? 'Shift Malam',
      })
    }
  }

  // Gabungkan data
  const rows = (employees ?? []).map(emp => ({
    ...emp,
    attendance: attendanceMap.get(emp.id) ?? null,
    night_shift: nightShiftFromYesterday.get(emp.id) ?? null,
  }))

  // Filter
  const filtered = rows.filter(r => {
    const matchSearch = search
      ? r.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
        r.position?.toLowerCase().includes(search.toLowerCase())
      : true
    const att = r.attendance
    const matchStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'hadir' ? (att?.status === 'hadir' || att?.status === 'terlambat') :
      statusFilter === 'lembur' ? att?.is_lembur === true :
      statusFilter === 'checkout' ? !!att?.check_out_time :
      statusFilter === 'no_checkout' ? (att?.check_in_time && !att?.check_out_time) :
      statusFilter === 'absent' ? !att :
      true
    return matchSearch && matchStatus
  })

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  // Summary counts (night shift from yesterday = not absent, they're still working)
  const absentCount = rows.filter(r => !r.attendance && !nightShiftFromYesterday.has(r.id)).length
  const nightShiftCount = nightShiftFromYesterday.size

  const summary = {
    total: rows.length,
    hadir: rows.filter(r => r.attendance && !r.attendance.is_lembur).length + nightShiftCount,
    lembur: rows.filter(r => r.attendance?.is_lembur).length,
    checkedOut: rows.filter(r => r.attendance?.check_out_time).length,
    absent: absentCount,
  }

  const dateLabel = format(new Date(selectedDate + 'T00:00:00'), 'EEEE, dd MMMM yyyy', { locale: id })

  return (
    <AttendanceClient
      rows={paginated}
      summary={summary}
      selectedDate={selectedDate}
      dateLabel={dateLabel}
      search={search}
      statusFilter={statusFilter}
      page={page}
      totalPages={totalPages}
      totalFiltered={filtered.length}
    />
  )
}
