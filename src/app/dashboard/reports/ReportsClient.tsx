'use client'

import { useCallback } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import * as XLSX from 'xlsx'

type Attendance = {
  id: string
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

const statusLabels: Record<string, { label: string; class: string }> = {
  hadir: { label: 'Hadir', class: 'bg-green-100 text-green-700' },
  terlambat: { label: 'Terlambat', class: 'bg-yellow-100 text-yellow-700' },
  alpha: { label: 'Alpha', class: 'bg-red-100 text-red-700' },
  izin: { label: 'Izin', class: 'bg-blue-100 text-blue-700' },
  sakit: { label: 'Sakit', class: 'bg-purple-100 text-purple-700' },
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
  const fmtTime = (t: string | null) =>
    t ? format(new Date(t), 'HH:mm') : '-'

  const fmtWorking = (m: number) =>
    m > 0 ? `${Math.floor(m / 60)}j ${m % 60}m` : '-'

  const summary = attendances.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const handleExport = useCallback(() => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const monthLabel = `${MONTHS[month]} ${year}`

    // Build per-employee recap
    const empMap = new Map<string, {
      name: string; empId: string; position: string
      hadir: number; terlambat: number; izin: number; sakit: number; alpha: number
      totalWorkingMinutes: number
    }>()

    // Initialize all employees
    for (const emp of employees) {
      empMap.set(emp.id, {
        name: emp.full_name,
        empId: emp.employee_id ?? '-',
        position: emp.position ?? '-',
        hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpha: 0,
        totalWorkingMinutes: 0,
      })
    }

    // Count from attendance records
    for (const att of attendances) {
      const userId = (att.profiles as any)?.id || att.profiles?.employee_id
      // We need user_id from attendance - use a lookup approach
    }

    // Better approach: group attendances by employee
    const attByEmp = new Map<string, Attendance[]>()
    for (const att of attendances) {
      const key = att.profiles?.full_name ?? 'Unknown'
      if (!attByEmp.has(key)) attByEmp.set(key, [])
      attByEmp.get(key)!.push(att)
    }

    // Sheet 1: Rekap Per Karyawan
    const recapData: Record<string, unknown>[] = []
    let no = 1

    for (const emp of employees) {
      const empAtts = attendances.filter(a => a.profiles?.full_name === emp.full_name)
      let hadir = 0, terlambat = 0, izin = 0, sakit = 0, alphaCount = 0, totalMins = 0

      for (const att of empAtts) {
        switch (att.status) {
          case 'hadir': hadir++; break
          case 'terlambat': terlambat++; break
          case 'izin': izin++; break
          case 'sakit': sakit++; break
          case 'alpha': alphaCount++; break
        }
        totalMins += att.working_minutes || 0
      }

      const totalHariKerja = daysInMonth // simplified: count all days
      const hadirTotal = hadir + terlambat
      const persen = totalHariKerja > 0 ? Math.round((hadirTotal / totalHariKerja) * 100) : 0

      recapData.push({
        'No': no++,
        'Nama Karyawan': emp.full_name,
        'ID Karyawan': emp.employee_id ?? '-',
        'Posisi': emp.position ?? '-',
        'Hadir': hadir,
        'Terlambat': terlambat,
        'Izin': izin,
        'Sakit': sakit,
        'Alpha': alphaCount,
        'Total Jam Kerja': `${Math.floor(totalMins / 60)}j ${totalMins % 60}m`,
        '% Kehadiran': `${persen}%`,
      })
    }

    // Sheet 2: Detail Per Tanggal
    const detailData: Record<string, unknown>[] = []
    let noDetail = 1

    for (const att of attendances) {
      const p = att.profiles
      const s = statusLabels[att.status]?.label ?? att.status

      detailData.push({
        'No': noDetail++,
        'Tanggal': format(new Date(att.date), 'dd MMM yyyy', { locale: id }),
        'Nama Karyawan': p?.full_name ?? '-',
        'ID Karyawan': p?.employee_id ?? '-',
        'Masuk': fmtTime(att.check_in_time),
        'Keluar': fmtTime(att.check_out_time),
        'Terlambat (mnt)': att.late_minutes > 0 ? att.late_minutes : '-',
        'Jam Kerja': fmtWorking(att.working_minutes),
        'Status': s,
      })
    }

    // Create workbook
    const wb = XLSX.utils.book_new()

    const wsRecap = XLSX.utils.json_to_sheet(recapData)
    // Set column widths
    wsRecap['!cols'] = [
      { wch: 4 }, { wch: 25 }, { wch: 15 }, { wch: 20 },
      { wch: 8 }, { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
      { wch: 15 }, { wch: 12 },
    ]
    XLSX.utils.book_append_sheet(wb, wsRecap, 'Rekap Karyawan')

    const wsDetail = XLSX.utils.json_to_sheet(detailData)
    wsDetail['!cols'] = [
      { wch: 4 }, { wch: 15 }, { wch: 25 }, { wch: 15 },
      { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
    ]
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Harian')

    // Download
    const fileName = `Laporan_Kehadiran_${MONTHS[month]}_${year}.xlsx`
    XLSX.writeFile(wb, fileName)
  }, [attendances, employees, month, year])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Absensi</h1>
          <p className="text-sm text-gray-500">{MONTHS[month]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Month selector */}
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
          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={attendances.length === 0}
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

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Tanggal', 'Karyawan', 'Check-In', 'Check-Out', 'Terlambat', 'Jam Kerja', 'Status'].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {attendances.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Tidak ada data absensi</td></tr>
            ) : (
              attendances.map((att) => {
                const p = att.profiles
                const s = statusLabels[att.status] ?? { label: att.status, class: 'bg-gray-100' }
                return (
                  <tr key={att.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{format(new Date(att.date), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{p?.full_name}</p>
                      <p className="text-xs text-gray-400">{p?.employee_id ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{fmtTime(att.check_in_time)}</td>
                    <td className="px-4 py-3 text-sm">{fmtTime(att.check_out_time)}</td>
                    <td className="px-4 py-3 text-sm text-yellow-600">{att.late_minutes > 0 ? `${att.late_minutes} mnt` : '-'}</td>
                    <td className="px-4 py-3 text-sm">{fmtWorking(att.working_minutes)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.class}`}>{s.label}</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
