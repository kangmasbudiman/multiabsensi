import { createClient } from '@/lib/supabase/server'
import { format, subDays } from 'date-fns'
import { id } from 'date-fns/locale'
import AttendanceChart from './_components/AttendanceChart'
import RunningText from '@/components/admin/RunningText'
import StatCards from './_components/StatCards'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role, position, department_id, departments(name)')
    .eq('id', user!.id)
    .single()

  if (profile?.role === 'super_admin') {
    return <SuperAdminDashboard supabase={supabase} />
  }

  if (profile?.position === 'kepala_ruangan' && profile?.department_id) {
    return (
      <KepalaRuanganDashboard
        supabase={supabase}
        orgId={profile.org_id}
        departmentId={profile.department_id}
        departmentName={(profile.departments as unknown as { name: string } | null)?.name ?? 'Ruangan'}
      />
    )
  }

  return <AdminDashboard supabase={supabase} orgId={profile?.org_id!} />
}

async function SuperAdminDashboard({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const [
    { data: companies },
    { count: totalUsers },
  ] = await Promise.all([
    supabase.from('organizations').select('*').order('registered_at', { ascending: false }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ])

  const pending = companies?.filter(c => c.status === 'pending') ?? []
  const approved = companies?.filter(c => c.status === 'approved') ?? []
  const rejected = companies?.filter(c => c.status === 'rejected') ?? []

  const stats = [
    { label: 'Total Perusahaan', value: companies?.length ?? 0, sub: 'Semua status', icon: '🏭', bg: 'from-teal-400 to-teal-600' },
    { label: 'Perusahaan Aktif', value: approved.length, sub: 'Sudah disetujui', icon: '✅', bg: 'from-green-400 to-green-600' },
    { label: 'Menunggu Verifikasi', value: pending.length, sub: 'Perlu ditinjau', icon: '⏳', bg: 'from-yellow-400 to-orange-500' },
    { label: 'Total Pengguna', value: totalUsers ?? 0, sub: 'Semua role', icon: '👥', bg: 'from-indigo-400 to-indigo-600' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard Platform</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })}
        </p>
      </div>

      {pending.length > 0 && (
        <Link href="/dashboard/super-settings" className="block">
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-xl shrink-0">⏳</div>
            <div className="flex-1">
              <p className="font-semibold text-orange-800">
                {pending.length} Pendaftaran Menunggu Verifikasi
              </p>
              <p className="text-sm text-orange-600 mt-0.5">Klik untuk meninjau dan menyetujui pendaftaran</p>
            </div>
            <span className="text-orange-400 text-lg">→</span>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className={`bg-gradient-to-br ${s.bg} p-4 flex items-center justify-between`}>
              <span className="text-3xl">{s.icon}</span>
              <p className="text-3xl font-bold text-white">{s.value}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-semibold text-gray-700">{s.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Pendaftaran Terbaru</h2>
            <p className="text-xs text-gray-400 mt-0.5">10 pendaftaran terakhir</p>
          </div>
          <Link href="/dashboard/companies" className="text-sm text-teal-600 hover:underline font-medium">
            Lihat semua →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Perusahaan</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PIC</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Industri</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal Daftar</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {companies?.slice(0, 10).map(c => {
                const statusStyle: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  approved: 'bg-green-100 text-green-700',
                  rejected: 'bg-red-100 text-red-700',
                }
                const statusLabel: Record<string, string> = {
                  pending: 'Menunggu',
                  approved: 'Disetujui',
                  rejected: 'Ditolak',
                }
                return (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center text-teal-600 font-bold text-sm shrink-0">
                          {c.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{c.name}</p>
                          <p className="text-xs text-teal-600 font-bold tracking-wider">{c.company_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-gray-700">{c.owner_name}</p>
                      <p className="text-xs text-gray-400">{c.owner_email}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-gray-600">{c.industry ?? '-'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-gray-600">
                        {new Date(c.registered_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusStyle[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {statusLabel[c.status] ?? c.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {(!companies || companies.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-sm">
                    Belum ada perusahaan yang mendaftar
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Internal donut chart component ─────────────────────────────────────────
function _AttendanceDonut({
  present,
  lembur,
  absent,
  total,
}: {
  present: number
  lembur: number
  absent: number
  total: number
}) {
  const circumference = 2 * Math.PI * 40 // ≈ 251.33
  const C = circumference

  const safeTotal = total > 0 ? total : 1

  // segment lengths
  const presentLen = (present / safeTotal) * C
  const lemburLen = (lembur / safeTotal) * C
  const absentLen = (absent / safeTotal) * C

  // offsets – segments are drawn CCW starting from the top (-90° rotation)
  const presentOffset = 0
  const lemburOffset = presentLen
  const absentOffset = presentLen + lemburLen

  const pct = total > 0 ? Math.round((present / total) * 100) : 0

  const segments = [
    { color: '#0d9488', len: presentLen, offset: presentOffset, label: 'Hadir', value: present },
    { color: '#f97316', len: lemburLen, offset: lemburOffset, label: 'Lembur', value: lembur },
    { color: '#ef4444', len: absentLen, offset: absentOffset, label: 'Belum', value: absent },
  ]

  return (
    <div className="flex items-center gap-6">
      {/* SVG Donut */}
      <div className="relative w-24 h-24 shrink-0">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          {/* Background track */}
          <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="12" />
          {segments.map((seg) =>
            seg.len > 0 ? (
              <circle
                key={seg.label}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={seg.color}
                strokeWidth="12"
                strokeDasharray={`${seg.len} ${C}`}
                strokeDashoffset={-seg.offset}
                strokeLinecap="butt"
              />
            ) : null
          )}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-bold text-gray-800 leading-none">{pct}%</p>
          <p className="text-[9px] text-gray-400 mt-0.5">hadir</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-xs text-gray-500 w-10">{seg.label}</span>
            <span className="text-xs font-bold text-gray-800">{seg.value}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-gray-300" />
          <span className="text-xs text-gray-400 w-10">Total</span>
          <span className="text-xs font-bold text-gray-600">{total}</span>
        </div>
      </div>
    </div>
  )
}

async function KepalaRuanganDashboard({ supabase, orgId, departmentId, departmentName }: {
  supabase: Awaited<ReturnType<typeof createClient>>
  orgId: string
  departmentId: string
  departmentName: string
}) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const [
    { data: allEmployees },
    { data: todayAttendances },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, employee_id, position').eq('org_id', orgId).eq('department_id', departmentId).eq('role', 'employee').eq('is_active', true).order('full_name'),
    supabase.from('attendances').select('user_id, check_in_time, check_out_time, status, is_lembur').eq('date', today).order('check_in_time', { ascending: true }),
  ])

  const employees = allEmployees ?? []
  const attendedIds = new Set((todayAttendances ?? []).map(a => a.user_id))
  const presentList = employees.filter(e => attendedIds.has(e.id)).map(e => ({
    ...e,
    attendance: (todayAttendances ?? []).find(a => a.user_id === e.id)!,
  }))
  const absentList = employees.filter(e => !attendedIds.has(e.id))
  const lemburCount = presentList.filter(e => e.attendance.is_lembur).length
  const employeeIds = employees.map(e => e.id)
  const totalStaff = employees.length

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard Ruangan</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {format(now, "EEEE, dd MMMM yyyy", { locale: id })}
        </p>
      </div>

      {/* Room info card */}
      <div className="bg-gradient-to-r from-amber-400 to-amber-500 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-amber-100 text-xs font-medium uppercase tracking-wider">Ruangan Anda</p>
            <p className="text-2xl font-bold mt-1">{departmentName}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{totalStaff}</p>
            <p className="text-amber-100 text-xs">Staff aktif</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{presentList.length}</p>
          <p className="text-xs text-gray-500 mt-1">✅ Hadir</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-3xl font-bold text-red-500">{absentList.length}</p>
          <p className="text-xs text-gray-500 mt-1">❌ Belum Absen</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-3xl font-bold text-orange-500">{lemburCount}</p>
          <p className="text-xs text-gray-500 mt-1">🔥 Lembur</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">Kehadiran Hari Ini</p>
          <span className="text-sm font-bold text-teal-600">
            {totalStaff > 0 ? Math.round(presentList.length / totalStaff * 100) : 0}%
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-3 bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all"
            style={{ width: `${totalStaff > 0 ? Math.round(presentList.length / totalStaff * 100) : 0}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">{presentList.length} dari {totalStaff} staff sudah absen</p>
      </div>

      {/* Quick link to roster */}
      <Link href="/dashboard/roster" className="block">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🗓️</span>
            <div>
              <p className="font-semibold text-gray-800">Kelola Jadwal Dinas</p>
              <p className="text-xs text-gray-400">Atur roster shift untuk ruangan {departmentName}</p>
            </div>
          </div>
          <span className="text-teal-500 text-lg">→</span>
        </div>
      </Link>

      {/* Realtime check-in notifications removed — lihat di HP masing-masing */}
    </div>
  )
}

async function AdminDashboard({ supabase, orgId }: { supabase: Awaited<ReturnType<typeof createClient>>, orgId: string }) {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const today = now.toISOString().slice(0, 10)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10)
  const monthName = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  const [
    { data: announcements },
    { count: totalEmployees },
    { count: totalDepartments },
    { count: totalShifts },
    { data: recentEmployees },
    { data: payrolls },
    { count: rosterFilled },
    { count: rosterTotal },
    { data: todayAttendances },
    { data: allEmployees },
  ] = await Promise.all([
    supabase.from('announcements').select('id, content').eq('org_id', orgId).eq('is_active', true).order('created_at', { ascending: false }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true).eq('role', 'employee'),
    supabase.from('departments').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
    supabase.from('shifts').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
    supabase.from('profiles').select('id, full_name, employee_id, join_date, departments(name)').eq('org_id', orgId).eq('role', 'employee').eq('is_active', true).order('created_at', { ascending: false }).limit(5),
    supabase.from('payrolls').select('net_salary, status').eq('org_id', orgId).eq('month', month).eq('year', year),
    supabase.from('shift_schedules').select('user_id', { count: 'exact', head: true }).eq('org_id', orgId).gte('date', startDate).lte('date', endDate).eq('is_off', false),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('role', 'employee').eq('is_active', true),
    supabase.from('attendances').select('user_id, check_in_time, check_out_time, status, is_lembur').eq('date', today).order('check_in_time', { ascending: true }),
    supabase.from('profiles').select('id, full_name, employee_id, position').eq('org_id', orgId).eq('role', 'employee').eq('is_active', true).order('full_name'),
  ])

  const totalPayroll = payrolls?.reduce((s, p) => s + p.net_salary, 0) ?? 0
  const paidCount = payrolls?.filter(p => p.status === 'paid').length ?? 0
  const daysInMonth = new Date(year, month, 0).getDate()
  const rosterPct = (rosterTotal ?? 0) > 0
    ? Math.round(((rosterFilled ?? 0) / ((rosterTotal ?? 0) * daysInMonth)) * 100)
    : 0

  // Kehadiran hari ini
  const attendedIds = new Set((todayAttendances ?? []).map(a => a.user_id))
  const presentList = (allEmployees ?? []).filter(e => attendedIds.has(e.id)).map(e => ({
    ...e,
    attendance: (todayAttendances ?? []).find(a => a.user_id === e.id)!,
  }))
  const absentList = (allEmployees ?? []).filter(e => !attendedIds.has(e.id))
  const lemburCount = presentList.filter(e => e.attendance.is_lembur).length
  const employeeIds = (allEmployees ?? []).map(e => e.id)

  const stats = [
    { label: 'Total Karyawan', value: totalEmployees ?? 0, sub: 'Karyawan aktif', icon: '👥', bg: 'from-teal-400 to-teal-600', href: '/dashboard/employees' },
    { label: 'Departemen', value: totalDepartments ?? 0, sub: 'Departemen aktif', icon: '🏗️', bg: 'from-blue-400 to-blue-600', href: '/dashboard/departments' },
    { label: 'Jenis Shift', value: totalShifts ?? 0, sub: 'Shift terdaftar', icon: '🕐', bg: 'from-purple-400 to-purple-600', href: '/dashboard/shifts' },
    { label: 'Penggajian', value: payrolls?.length ?? 0, sub: `${paidCount} sudah dibayar`, icon: '💰', bg: 'from-orange-400 to-orange-500', href: '/dashboard/payroll' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {format(now, "EEEE, dd MMMM yyyy", { locale: id })}
        </p>
      </div>

      {announcements && announcements.length > 0 && <RunningText items={announcements} />}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className={`bg-gradient-to-br ${s.bg} p-4 flex items-center justify-between`}>
              <span className="text-3xl">{s.icon}</span>
              <p className="text-3xl font-bold text-white">{s.value}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-semibold text-gray-700">{s.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Roster bulan ini */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-800">Roster {monthName}</h2>
              <p className="text-xs text-gray-400">Progress pengisian jadwal</p>
            </div>
            <Link href="/dashboard/roster" className="text-xs text-teal-600 hover:underline font-medium">Kelola →</Link>
          </div>
          <div className="flex items-center justify-center py-4">
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="12" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#14b8a6" strokeWidth="12"
                  strokeDasharray={`${rosterPct * 2.51} 251`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold text-gray-800">{rosterPct}%</p>
                <p className="text-[10px] text-gray-400">terisi</p>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400">
            {rosterFilled ?? 0} dari {(rosterTotal ?? 0) * daysInMonth} slot jadwal
          </p>
        </div>

        {/* Penggajian bulan ini */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-800">Penggajian {monthName}</h2>
              <p className="text-xs text-gray-400">Rekap gaji bulan ini</p>
            </div>
            <Link href="/dashboard/payroll" className="text-xs text-teal-600 hover:underline font-medium">Kelola →</Link>
          </div>
          {payrolls && payrolls.length > 0 ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Total Gaji Bersih</p>
                <p className="text-xl font-bold text-gray-800">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalPayroll)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                {[
                  { label: 'Draft', count: payrolls.filter(p => p.status === 'draft').length, color: 'text-yellow-600' },
                  { label: 'Disetujui', count: payrolls.filter(p => p.status === 'approved').length, color: 'text-blue-600' },
                  { label: 'Dibayar', count: paidCount, color: 'text-green-600' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className={`text-lg font-bold ${s.color}`}>{s.count}</p>
                    <p className="text-[10px] text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm">Belum dihitung</p>
              <Link href="/dashboard/payroll" className="text-xs text-teal-600 hover:underline mt-1 block">Hitung sekarang →</Link>
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Menu Cepat</h2>
          <div className="space-y-2">
            {[
              { href: '/dashboard/employees', icon: '👥', label: 'Tambah Karyawan', sub: 'Daftarkan karyawan baru' },
              { href: '/dashboard/roster', icon: '🗓️', label: 'Isi Roster', sub: `Jadwal ${monthName}` },
              { href: '/dashboard/payroll', icon: '💰', label: 'Hitung Gaji', sub: `Penggajian ${monthName}` },
              { href: '/dashboard/shifts', icon: '🕐', label: 'Kelola Shift', sub: 'Atur jam kerja' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-teal-600 transition-colors">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Kehadiran Hari Ini */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-4 justify-between">
          {/* Left: title + date + badges */}
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="font-semibold text-gray-800">Kehadiran Hari Ini</h2>
            <p className="text-xs text-gray-400">
              {format(now, "EEEE, dd MMMM yyyy", { locale: id })}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-green-600 font-semibold bg-green-50 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                {presentList.length} Hadir
              </div>
              <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold bg-red-50 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-red-400 rounded-full inline-block" />
                {absentList.length} Belum
              </div>
            </div>
          </div>

          {/* Right: Donut chart */}
          <_AttendanceDonut
            present={presentList.length}
            lembur={lemburCount}
            absent={absentList.length}
            total={allEmployees?.length ?? 0}
          />
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all"
                style={{ width: `${(allEmployees?.length ?? 0) > 0 ? Math.round(presentList.length / (allEmployees?.length ?? 1) * 100) : 0}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-teal-600">
              {(allEmployees?.length ?? 0) > 0 ? Math.round(presentList.length / (allEmployees?.length ?? 1) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Karyawan terbaru */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Karyawan Terbaru</h2>
            <p className="text-xs text-gray-400 mt-0.5">5 karyawan terakhir ditambahkan</p>
          </div>
          <Link href="/dashboard/employees" className="text-sm text-teal-600 hover:underline font-medium">Lihat semua →</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recentEmployees && recentEmployees.length > 0 ? recentEmployees.map(emp => (
            <div key={emp.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold text-sm shrink-0">
                  {emp.full_name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">{emp.full_name}</p>
                  <p className="text-xs text-gray-400">{emp.employee_id ?? 'No ID'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{(emp.departments as unknown as { name: string } | null)?.name ?? '-'}</p>
                <p className="text-xs text-gray-400">
                  {emp.join_date ? new Date(emp.join_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                </p>
              </div>
            </div>
          )) : (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-400 text-sm">Belum ada karyawan</p>
            </div>
          )}
        </div>
      </div>

      {/* Realtime check-in notifications removed — lihat di HP masing-masing */}
    </div>
  )
}
