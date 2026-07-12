'use client'

import { useCallback, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import * as XLSX from 'xlsx'

type Attendance = {
  id: string
  user_id: string
  date: string
  check_in_time: string | null
  check_out_time: string | null
  late_minutes: number
  working_minutes: number
  status: string
  is_check_in_mock_suspected: boolean
  profiles: { full_name: string; employee_id?: string; position?: string } | null
}

type Employee = {
  id: string
  full_name: string
  employee_id: string | null
  position: string | null
}

const MONTHS = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const DAY_ABBR = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

const statusLabels: Record<string, { label: string; short: string; class: string; cellClass: string }> = {
  hadir: { label: 'Hadir', short: 'H', class: 'bg-green-100 text-green-700', cellClass: 'bg-green-50 text-green-700' },
  terlambat: { label: 'Terlambat', short: 'T', class: 'bg-yellow-100 text-yellow-700', cellClass: 'bg-yellow-50 text-yellow-700' },
  alpha: { label: 'Alpha', short: 'A', class: 'bg-red-100 text-red-700', cellClass: 'bg-red-50 text-red-700' },
  izin: { label: 'Izin', short: 'I', class: 'bg-blue-100 text-blue-700', cellClass: 'bg-blue-50 text-blue-700' },
  sakit: { label: 'Sakit', short: 'S', class: 'bg-purple-100 text-purple-700', cellClass: 'bg-purple-50 text-purple-700' },
}

export default function ReportsClient({
  attendances,
  employees,
  month,
  year,
}: {
  attendances: Attendance[]
  employees: Employee[]
  month: number
  year: number
}) {
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState('')

  const fmtTime = (t: string | null) =>
    t ? format(new Date(t), 'HH:mm') : ''

  const fmtWorking = (m: number) =>
    m > 0 ? `${Math.floor(m / 60)}j ${m % 60}m` : '-'

  const daysInMonth = new Date(year, month, 0).getDate()

  const dateStrings = useMemo(() => (
    Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    })
  ), [year, month, daysInMonth])

  const attByUserDate = useMemo(() => {
    const m = new Map<string, Map<string, Attendance>>()
    for (const att of attendances) {
      if (!m.has(att.user_id)) m.set(att.user_id, new Map())
      m.get(att.user_id)!.set(att.date, att)
    }
    return m
  }, [attendances])

  const positions = useMemo(() => {
    const s = new Set<string>()
    for (const e of employees) if (e.position) s.add(e.position)
    return Array.from(s).sort()
  }, [employees])

  const filteredEmployees = useMemo(() => (
    employees.filter(e => {
      if (positionFilter && e.position !== positionFilter) return false
      if (search) {
        const s = search.toLowerCase()
        return e.full_name.toLowerCase().includes(s)
          || (e.employee_id ?? '').toLowerCase().includes(s)
      }
      return true
    })
  ), [employees, search, positionFilter])

  const summary = useMemo(() => (
    attendances.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  ), [attendances])

  const handleExport = useCallback(() => {
    const wb = XLSX.utils.book_new()

    // ── Sheet 1: Rekap Per Karyawan ────────────────────────────────────────
    const recapData: Record<string, unknown>[] = []
    let noRecap = 1
    for (const emp of filteredEmployees) {
      const empAttMap = attByUserDate.get(emp.id)
      let hadir = 0, terlambat = 0, izin = 0, sakit = 0, alpha = 0, totalMins = 0
      if (empAttMap) {
        for (const att of empAttMap.values()) {
          switch (att.status) {
            case 'hadir': hadir++; break
            case 'terlambat': terlambat++; break
            case 'izin': izin++; break
            case 'sakit': sakit++; break
            case 'alpha': alpha++; break
          }
          totalMins += att.working_minutes || 0
        }
      }
      const hadirTotal = hadir + terlambat
      const persen = daysInMonth > 0 ? Math.round((hadirTotal / daysInMonth) * 100) : 0

      recapData.push({
        'No': noRecap++,
        'Nama Karyawan': emp.full_name,
        'ID Karyawan': emp.employee_id ?? '-',
        'Posisi': emp.position ?? '-',
        'Hadir': hadir,
        'Terlambat': terlambat,
        'Izin': izin,
        'Sakit': sakit,
        'Alpha': alpha,
        'Total Jam Kerja': `${Math.floor(totalMins / 60)}j ${totalMins % 60}m`,
        '% Kehadiran': `${persen}%`,
      })
    }
    const wsRecap = XLSX.utils.json_to_sheet(recapData)
    wsRecap['!cols'] = [
      { wch: 4 }, { wch: 25 }, { wch: 15 }, { wch: 20 },
      { wch: 8 }, { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
      { wch: 15 }, { wch: 12 },
    ]
    XLSX.utils.book_append_sheet(wb, wsRecap, 'Rekap Karyawan')

    // ── Sheet 2: Detail Pivot (dates as columns) ───────────────────────────
    // Use non-numeric header labels (e.g., "1 Sen") — JS sorts integer-like
    // string keys before named ones, which would put date columns on the left.
    const dateHeaders = Array.from({ length: daysInMonth }, (_, i) => {
      const ds = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
      const dow = new Date(ds + 'T00:00:00').getDay()
      return `${i + 1} ${DAY_ABBR[dow]}`
    })
    const pivotHeaders = ['No', 'Nama', 'ID', 'Posisi', ...dateHeaders, 'Hadir', 'Total Jam Kerja']

    const pivotData: Record<string, unknown>[] = []
    let noPivot = 1
    for (const emp of filteredEmployees) {
      const empAttMap = attByUserDate.get(emp.id)
      const row: Record<string, unknown> = {
        'No': noPivot++,
        'Nama': emp.full_name,
        'ID': emp.employee_id ?? '-',
        'Posisi': emp.position ?? '-',
      }
      let hadirCount = 0
      let totalMins = 0

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const att = empAttMap?.get(dateStr)
        let cellText = ''
        if (att) {
          if (att.status === 'hadir' || att.status === 'terlambat') {
            const ci = fmtTime(att.check_in_time)
            const co = fmtTime(att.check_out_time)
            cellText = co ? `${ci}/${co}` : ci
            hadirCount++
            totalMins += att.working_minutes || 0
          } else {
            cellText = statusLabels[att.status]?.short ?? att.status[0]?.toUpperCase() ?? '?'
          }
        }
        row[dateHeaders[d - 1]] = cellText
      }
      row['Hadir'] = hadirCount
      row['Total Jam Kerja'] = `${Math.floor(totalMins / 60)}j ${totalMins % 60}m`

      pivotData.push(row)
    }
    const wsPivot = XLSX.utils.json_to_sheet(pivotData, { header: pivotHeaders })
    wsPivot['!cols'] = [
      { wch: 4 }, { wch: 25 }, { wch: 12 }, { wch: 18 },
      ...Array.from({ length: daysInMonth }, () => ({ wch: 11 })),
      { wch: 7 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, wsPivot, 'Detail Absensi')

    const fileName = `Laporan_Kehadiran_${MONTHS[month]}_${year}.xlsx`
    XLSX.writeFile(wb, fileName)
  }, [attByUserDate, filteredEmployees, daysInMonth, month, year])

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Absensi</h1>
          <p className="text-sm text-gray-500">{MONTHS[month]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <form className="flex items-center gap-2">
            <select name="month" defaultValue={month}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
              {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select name="year" defaultValue={year}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button type="submit" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 font-medium">Filter</button>
          </form>
          <button
            onClick={handleExport}
            disabled={attendances.length === 0 && employees.length === 0}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            <span>📥</span> Export Excel
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {Object.entries({ hadir: 'Hadir', terlambat: 'Terlambat', alpha: 'Alpha', izin: 'Izin', sakit: 'Sakit' }).map(([k, label]) => (
          <div key={k} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold text-gray-900">{summary[k] ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama / ID karyawan..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <select
          value={positionFilter}
          onChange={e => setPositionFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          <option value="">Semua Posisi</option>
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-xs text-gray-400">
          {filteredEmployees.length} karyawan
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3 text-xs flex-wrap">
        <span className="text-gray-500 font-medium">Kode:</span>
        {Object.entries(statusLabels).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={`px-1.5 py-0.5 rounded font-bold ${v.cellClass}`}>{v.short}</span>
            <span className="text-gray-600">{v.label}</span>
          </span>
        ))}
        <span className="text-gray-400">· Format sel: MM:MM (masuk/keluar)</span>
      </div>

      {/* Pivot Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="border-collapse min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide min-w-[180px]">Karyawan</th>
                {dateStrings.map((ds, i) => {
                  const day = new Date(ds + 'T00:00:00')
                  const dow = day.getDay()
                  const isWeekend = dow === 0 || dow === 6
                  return (
                    <th key={ds} className={`px-1 py-2 text-center text-[10px] font-semibold uppercase ${isWeekend ? 'text-red-400 bg-red-50/50' : 'text-gray-500'}`}>
                      <div>{i + 1}</div>
                      <div className="text-[9px] font-normal">{DAY_ABBR[dow]}</div>
                    </th>
                  )
                })}
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase bg-gray-50 sticky right-0 z-10">Hadir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={daysInMonth + 2} className="text-center py-12 text-gray-400">
                    {employees.length === 0 ? 'Belum ada karyawan' : 'Tidak ditemukan'}
                  </td>
                </tr>
              ) : filteredEmployees.map(emp => {
                const empAttMap = attByUserDate.get(emp.id)
                let hadirCount = 0
                return (
                  <tr key={emp.id} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-gray-100">
                      <p className="text-sm font-medium text-gray-800 truncate">{emp.full_name}</p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {emp.employee_id && <span>{emp.employee_id}</span>}
                        {emp.employee_id && emp.position && <span> · </span>}
                        {emp.position && <span>{emp.position}</span>}
                      </p>
                    </td>
                    {dateStrings.map(ds => {
                      const att = empAttMap?.get(ds)
                      const day = new Date(ds + 'T00:00:00')
                      const dow = day.getDay()
                      const isWeekend = dow === 0 || dow === 6

                      if (!att) {
                        return (
                          <td key={ds} className={`px-1 py-2 text-center text-[10px] ${isWeekend ? 'bg-red-50/30' : ''}`}>
                            <span className="text-gray-200">·</span>
                          </td>
                        )
                      }

                      if (att.status === 'hadir' || att.status === 'terlambat') {
                        hadirCount++
                        const s = statusLabels[att.status]
                        const ci = fmtTime(att.check_in_time)
                        const co = fmtTime(att.check_out_time)
                        return (
                          <td key={ds} className={`px-1 py-2 text-center text-[9px] leading-tight ${s.cellClass}`}>
                            <div className="font-semibold">{ci || '·'}</div>
                            <div className="text-gray-500">{co || '·'}</div>
                          </td>
                        )
                      }

                      const s = statusLabels[att.status] ?? { short: att.status[0]?.toUpperCase() ?? '?', cellClass: 'bg-gray-100 text-gray-600' }
                      return (
                        <td key={ds} className={`px-1 py-2 text-center text-[10px] font-bold ${s.cellClass}`}>
                          {s.short}
                        </td>
                      )
                    })}
                    <td className="sticky right-0 z-10 bg-white px-3 py-2 text-center text-sm font-bold text-teal-700 border-l border-gray-100">
                      {hadirCount}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        💡 Sel berwarna menunjukkan status kehadiran. Sel kosong (·) = tidak ada data absen.
        Hover di sel untuk lihat detail. Untuk rincian lengkap, gunakan Export Excel.
      </p>
    </div>
  )
}
