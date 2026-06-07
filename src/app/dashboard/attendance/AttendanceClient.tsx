'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useTransition } from 'react'

type Row = {
  id: string
  full_name: string
  employee_id: string | null
  position: string | null
  avatar_url: string | null
  attendance: {
    check_in_time: string | null
    check_out_time: string | null
    check_in_lat: number | null
    check_in_lng: number | null
    check_in_accuracy: number | null
    status: string | null
    is_lembur: boolean
    notes: string | null
    check_in_photo_url: string | null
    check_out_photo_url: string | null
    face_verification_status: string | null
    face_confidence: number | null
    method: string | null
  } | null
  night_shift: { check_in_time: string; shift_name: string } | null
}

type Summary = { total: number; hadir: number; lembur: number; checkedOut: number; absent: number }

export default function AttendanceClient({
  rows, summary, selectedDate, dateLabel, search, statusFilter, page, totalPages, totalFiltered,
}: {
  rows: Row[]
  summary: Summary
  selectedDate: string
  dateLabel: string
  search: string
  statusFilter: string
  page: number
  totalPages: number
  totalFiltered: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [photoModal, setPhotoModal] = useState<{ url: string; name: string; type: string } | null>(null)

  const navigate = useCallback((updates: Record<string, string>) => {
    const sp = new URLSearchParams({ date: selectedDate, search, status: statusFilter, page: String(page), ...updates })
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }, [selectedDate, search, statusFilter, page, router, pathname])

  const fmtTime = (t: string | null) =>
    t ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : null

  const workingHours = (row: Row) => {
    if (!row.attendance?.check_in_time || !row.attendance?.check_out_time) return null
    const mins = Math.floor((new Date(row.attendance.check_out_time).getTime() - new Date(row.attendance.check_in_time).getTime()) / 60000)
    const h = Math.floor(mins / 60), m = mins % 60
    return `${h}j ${m}m`
  }

  const checkinTime = (row: Row) => {
    const t = row.attendance?.check_in_time ?? row.night_shift?.check_in_time
    return t ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : null
  }

  const statusBadge = (row: Row) => {
    if (!row.attendance && row.night_shift) return <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">🌙 Shift Malam</span>
    if (!row.attendance) return <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">Tidak Hadir</span>
    if (row.attendance.is_lembur) return <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">Lembur</span>
    if (row.attendance.status === 'terlambat') return <span className="text-xs bg-yellow-100 text-yellow-600 font-semibold px-2 py-0.5 rounded-full">Terlambat</span>
    return <span className="text-xs bg-green-100 text-green-600 font-semibold px-2 py-0.5 rounded-full">Hadir</span>
  }

  // Calculated stats
  const attendancePercent = summary.total > 0
    ? Math.round(((summary.hadir + summary.lembur) / summary.total) * 100)
    : 0

  const statCards = [
    { label: 'Total Karyawan', value: summary.total, color: 'from-slate-400 to-slate-600', icon: '👥' },
    { label: 'Hadir', value: summary.hadir + summary.lembur, color: 'from-teal-400 to-teal-600', icon: '✅' },
    { label: 'Tidak Hadir', value: summary.absent, color: 'from-red-400 to-red-600', icon: '❌' },
    { label: 'Sudah Checkout', value: summary.checkedOut, color: 'from-blue-400 to-blue-600', icon: '🏃' },
    { label: 'Kehadiran', value: `${attendancePercent}%`, color: attendancePercent >= 80 ? 'from-green-400 to-green-600' : attendancePercent >= 60 ? 'from-yellow-400 to-yellow-600' : 'from-red-400 to-red-600', icon: '📊' },
  ]

  const statusOptions = [
    { value: 'all', label: 'Semua' },
    { value: 'hadir', label: 'Hadir' },
    { value: 'lembur', label: 'Lembur' },
    { value: 'no_checkout', label: 'Belum Checkout' },
    { value: 'checkout', label: 'Sudah Checkout' },
    { value: 'absent', label: 'Tidak Hadir' },
  ]

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Rekap Kehadiran</h1>
          <p className="text-gray-500 text-sm mt-0.5 capitalize">{dateLabel}</p>
        </div>
        {/* Date picker */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(selectedDate + 'T00:00:00')
              d.setDate(d.getDate() - 1)
              navigate({ date: d.toISOString().slice(0, 10), page: '1' })
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
          >‹</button>
          <input
            type="date"
            value={selectedDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => navigate({ date: e.target.value, page: '1' })}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
          <button
            onClick={() => {
              const d = new Date(selectedDate + 'T00:00:00')
              d.setDate(d.getDate() + 1)
              if (d <= new Date()) navigate({ date: d.toISOString().slice(0, 10), page: '1' })
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
          >›</button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className={`bg-gradient-to-br ${s.color} px-4 py-2.5 flex items-center justify-between`}>
              <span className="text-xl">{s.icon}</span>
              <p className="text-2xl font-bold text-white">{s.value}</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-gray-600">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Cari nama, ID, jabatan..."
            defaultValue={search}
            onKeyDown={e => { if (e.key === 'Enter') navigate({ search: (e.target as HTMLInputElement).value, page: '1' }) }}
            onBlur={e => { if (e.target.value !== search) navigate({ search: e.target.value, page: '1' }) }}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
        </div>
        {/* Status filter */}
        <div className="flex gap-1.5 flex-wrap">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => navigate({ status: opt.value, page: '1' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === opt.value
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >{opt.label}</button>
          ))}
        </div>
        <p className="text-xs text-gray-400 ml-auto">{totalFiltered} karyawan</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {pending && (
          <div className="px-6 py-2 bg-teal-50 border-b border-teal-100">
            <p className="text-xs text-teal-600">Memuat data...</p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Karyawan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Masuk</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Keluar</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Durasi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Verifikasi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Foto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-gray-400 text-sm">
                    Tidak ada data untuk filter ini
                  </td>
                </tr>
              ) : rows.map(row => (
                <tr key={row.id} className={`hover:bg-gray-50/50 transition-colors ${!row.attendance && !row.night_shift ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold text-sm shrink-0 overflow-hidden">
                        {row.avatar_url
                          ? <img src={row.avatar_url} alt="" className="w-full h-full object-cover" />
                          : row.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{row.full_name}</p>
                        <p className="text-xs text-gray-400">{row.position ?? row.employee_id ?? '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">{statusBadge(row)}</td>
                  <td className="px-4 py-3.5">
                    {checkinTime(row)
                      ? <span className="text-sm font-semibold text-green-600">{checkinTime(row)}</span>
                      : <span className="text-sm text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    {fmtTime(row.attendance?.check_out_time ?? null)
                      ? <span className="text-sm font-semibold text-blue-600">{fmtTime(row.attendance?.check_out_time ?? null)}</span>
                      : row.attendance || row.night_shift
                        ? <span className="text-xs text-yellow-500 font-medium">Belum checkout</span>
                        : <span className="text-sm text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-gray-600">{workingHours(row) ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    {row.attendance?.face_verification_status
                      ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          row.attendance.face_verification_status === 'verified'
                            ? 'bg-green-100 text-green-700'
                            : row.attendance.face_verification_status === 'failed'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-gray-100 text-gray-500'
                        }`}>
                          {row.attendance.face_verification_status === 'verified' ? '✓' : row.attendance.face_verification_status === 'failed' ? '✗' : '—'}
                          {' '}
                          {row.attendance.face_verification_status === 'verified'
                            ? `Terverifikasi${row.attendance.face_confidence != null ? ` (${Math.round(row.attendance.face_confidence * 100)}%)` : ''}`
                            : row.attendance.face_verification_status === 'failed'
                              ? 'Gagal'
                              : row.attendance.face_verification_status === 'skipped'
                                ? 'Dilewati'
                                : row.attendance.face_verification_status}
                        </span>
                      )
                      : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      {row.attendance?.check_in_photo_url && (
                        <button
                          onClick={() => setPhotoModal({ url: row.attendance!.check_in_photo_url!, name: row.full_name, type: 'Masuk' })}
                          className="w-7 h-7 rounded-lg overflow-hidden border border-gray-200 hover:border-teal-400 transition-colors cursor-pointer"
                          title="Foto masuk"
                        >
                          <img src={row.attendance.check_in_photo_url} alt="" className="w-full h-full object-cover" />
                        </button>
                      )}
                      {row.attendance?.check_out_photo_url && (
                        <button
                          onClick={() => setPhotoModal({ url: row.attendance!.check_out_photo_url!, name: row.full_name, type: 'Keluar' })}
                          className="w-7 h-7 rounded-lg overflow-hidden border border-gray-200 hover:border-teal-400 transition-colors cursor-pointer"
                          title="Foto keluar"
                        >
                          <img src={row.attendance.check_out_photo_url} alt="" className="w-full h-full object-cover" />
                        </button>
                      )}
                      {!row.attendance?.check_in_photo_url && !row.attendance?.check_out_photo_url && (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-gray-500">{row.attendance?.notes ?? '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Halaman {page} dari {totalPages}
            </p>
            <div className="flex gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => navigate({ page: String(page - 1) })}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >← Prev</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                return (
                  <button key={p} onClick={() => navigate({ page: String(p) })}
                    className={`w-8 h-8 text-xs rounded-lg border ${p === page ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                    {p}
                  </button>
                )
              })}
              <button
                disabled={page >= totalPages}
                onClick={() => navigate({ page: String(page + 1) })}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Photo Modal */}
      {photoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPhotoModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-gray-800">{photoModal.name}</p>
                <p className="text-xs text-gray-400">Foto Presensi {photoModal.type}</p>
              </div>
              <button onClick={() => setPhotoModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="bg-gray-900">
              <img src={photoModal.url} alt="Foto presensi" className="w-full object-contain max-h-[60vh]" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
