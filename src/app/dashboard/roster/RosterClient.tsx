'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { syncNationalHolidays, addHoliday, deleteHoliday } from '@/app/actions/holidays'

interface Employee { id: string; full_name: string; employee_id?: string; department_id?: string; departments?: { name: string } | null }
interface Shift { id: string; name: string; start_time: string; end_time: string }
interface Department { id: string; name: string }
interface Schedule { user_id: string; shift_id: string | null; date: string; is_off: boolean }
interface Holiday { date: string; name: string; is_national: boolean }

interface Props {
  employees: Employee[]
  shifts: Shift[]
  departments: Department[]
  schedules: Schedule[]
  holidays: Holiday[]
  month: number
  year: number
  orgId: string
  isDeptHead: boolean
}

const SHIFT_COLORS = [
  'bg-teal-500 text-white',
  'bg-blue-500 text-white',
  'bg-purple-500 text-white',
  'bg-orange-500 text-white',
  'bg-rose-500 text-white',
  'bg-indigo-500 text-white',
]
const SHIFT_COLORS_LIGHT = [
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
]

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export default function RosterClient({ employees, shifts, departments, schedules, holidays, month, year, orgId, isDeptHead }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [filterDept, setFilterDept] = useState(isDeptHead ? (employees[0]?.department_id ?? '') : '')
  const [saving, setSaving] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [activeCell, setActiveCell] = useState<string | null>(null)
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null)
  const [activeCellData, setActiveCellData] = useState<{ empId: string; dayNum: number; isHoliday: boolean; holidayName: string; sched: Schedule | undefined } | null>(null)
  const [showBulk, setShowBulk] = useState(false)
  const [showHolidays, setShowHolidays] = useState(false)
  const [empSearch, setEmpSearch] = useState('')

  // Bulk form state
  const [bulkEmpIds, setBulkEmpIds] = useState<string[]>([])
  const [bulkShiftId, setBulkShiftId] = useState('')
  const [bulkType, setBulkType] = useState<'all' | 'weekdays' | 'saturday' | 'sunday' | 'range' | 'off'>('weekdays')
  const [bulkFrom, setBulkFrom] = useState('')
  const [bulkTo, setBulkTo] = useState('')

  // Holiday management state
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayName, setNewHolidayName] = useState('')
  const [holidayList, setHolidayList] = useState<Holiday[]>(holidays)
  useEffect(() => { setHolidayList(holidays) }, [holidays])
  const [deletingDate, setDeletingDate] = useState<string | null>(null)
  const [addingHoliday, setAddingHoliday] = useState(false)

  const [scheduleMap, setScheduleMap] = useState<Record<string, Schedule>>(() => {
    const m: Record<string, Schedule> = {}
    for (const s of schedules) m[`${s.user_id}_${s.date}`] = s
    return m
  })

  const shiftColorMap: Record<string, string> = {}
  const shiftColorLightMap: Record<string, string> = {}
  shifts.forEach((s, i) => {
    shiftColorMap[s.id] = SHIFT_COLORS[i % SHIFT_COLORS.length]
    shiftColorLightMap[s.id] = SHIFT_COLORS_LIGHT[i % SHIFT_COLORS_LIGHT.length]
  })

  // Holiday map: date string → holiday name
  const holidayMap: Record<string, string> = {}
  for (const h of holidayList) holidayMap[h.date] = h.name

  const daysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month - 1, i + 1)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
    return {
      num: i + 1,
      dayName: DAY_NAMES[d.getDay()],
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      dayOfWeek: d.getDay(),
      dateStr,
      isHoliday: !!holidayMap[dateStr],
      holidayName: holidayMap[dateStr] ?? '',
    }
  })

  // Holidays for current month (for display in panel)
  const monthHolidays = holidayList.filter(h => {
    const d = new Date(h.date)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })

  const filtered = employees.filter(e => {
    const matchDept = !filterDept || e.department_id === filterDept
    const matchSearch = !empSearch || e.full_name.toLowerCase().includes(empSearch.toLowerCase())
    return matchDept && matchSearch
  })

  const dateStr = (day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const assignCell = useCallback(async (userId: string, day: number, shiftId: string | null, isOff: boolean) => {
    const date = dateStr(day)
    const key = `${userId}_${date}`
    setSaving(key)
    setActiveCell(null)
    const { error } = await supabase.from('shift_schedules').upsert(
      { user_id: userId, org_id: orgId, shift_id: isOff ? null : shiftId, date, is_off: isOff },
      { onConflict: 'user_id,date' }
    )
    if (!error) setScheduleMap(prev => ({ ...prev, [key]: { user_id: userId, shift_id: shiftId, date, is_off: isOff } }))
    setSaving(null)
  }, [orgId])

  const clearCell = useCallback(async (userId: string, day: number) => {
    const date = dateStr(day)
    const key = `${userId}_${date}`
    setSaving(key)
    setActiveCell(null)
    await supabase.from('shift_schedules').delete().eq('user_id', userId).eq('date', date)
    setScheduleMap(prev => { const n = { ...prev }; delete n[key]; return n })
    setSaving(null)
  }, [])

  // Bulk assign
  const handleBulkApply = async () => {
    if (bulkEmpIds.length === 0) return alert('Pilih minimal 1 karyawan')
    if (bulkType !== 'off' && !bulkShiftId) return alert('Pilih shift')
    if (bulkType === 'range' && (!bulkFrom || !bulkTo)) return alert('Isi tanggal dari-sampai')

    setBulkLoading(true)

    const targetDays = days.filter(d => {
      if (bulkType === 'all') return true
      if (bulkType === 'weekdays') return !d.isWeekend
      if (bulkType === 'saturday') return d.dayOfWeek === 6
      if (bulkType === 'sunday') return d.dayOfWeek === 0
      if (bulkType === 'off') return true
      if (bulkType === 'range') {
        const from = parseInt(bulkFrom), to = parseInt(bulkTo)
        return d.num >= from && d.num <= to
      }
      return false
    })

    const rows = bulkEmpIds.flatMap(uid =>
      targetDays.map(d => ({
        user_id: uid,
        org_id: orgId,
        shift_id: bulkType === 'off' ? null : bulkShiftId,
        date: dateStr(d.num),
        is_off: bulkType === 'off',
      }))
    )

    const { error } = await supabase.from('shift_schedules').upsert(rows, { onConflict: 'user_id,date' })

    if (!error) {
      const newMap = { ...scheduleMap }
      for (const r of rows) newMap[`${r.user_id}_${r.date}`] = { user_id: r.user_id, shift_id: r.shift_id, date: r.date, is_off: r.is_off }
      setScheduleMap(newMap)
      setShowBulk(false)
      setBulkEmpIds([])
    } else {
      alert('Gagal: ' + error.message)
    }
    setBulkLoading(false)
  }

  // Holiday management
  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    const res = await syncNationalHolidays(year, orgId)
    if (res.error) {
      setSyncMsg('❌ ' + res.error)
    } else {
      setSyncMsg(`✅ ${res.count} hari libur berhasil dimuat untuk tahun ${year}`)
      router.refresh()
    }
    setSyncing(false)
  }

  const handleAddHoliday = async () => {
    if (!newHolidayDate || !newHolidayName.trim()) return
    setAddingHoliday(true)
    const res = await addHoliday(orgId, newHolidayDate, newHolidayName.trim())
    if (!res.error) {
      setHolidayList(prev => {
        const next = prev.filter(h => h.date !== newHolidayDate)
        return [...next, { date: newHolidayDate, name: newHolidayName.trim(), is_national: false }]
      })
      setNewHolidayDate('')
      setNewHolidayName('')
    }
    setAddingHoliday(false)
  }

  const handleDeleteHoliday = async (date: string) => {
    setDeletingDate(date)
    const res = await deleteHoliday(orgId, date)
    if (!res.error) {
      setHolidayList(prev => prev.filter(h => h.date !== date))
    }
    setDeletingDate(null)
  }

  const toggleBulkEmp = (id: string) => setBulkEmpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleAllEmp = () => setBulkEmpIds(prev => prev.length === filtered.length ? [] : filtered.map(e => e.id))

  const navigateMonth = (dir: number) => {
    let m = month + dir, y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    router.push(`/dashboard/roster?month=${m}&year=${y}`)
  }

  const monthName = new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const filledCount = (empId: string) => days.filter(d => scheduleMap[`${empId}_${dateStr(d.num)}`]).length
  const selectedDept = departments.find(d => d.id === filterDept)

  // Admin harus pilih departemen dulu
  if (!isDeptHead && !filterDept) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Roster Bulanan</h1>
            <p className="text-sm text-gray-400 mt-0.5">Jadwal shift harian per karyawan</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigateMonth(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold">‹</button>
            <span className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 min-w-36 text-center capitalize">{monthName}</span>
            <button onClick={() => navigateMonth(1)} className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold">›</button>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="text-center mb-8">
            <p className="text-4xl mb-3">🏗️</p>
            <h2 className="font-bold text-gray-800 text-lg">Pilih Departemen</h2>
            <p className="text-sm text-gray-400 mt-1">Roster ditampilkan per departemen agar lebih mudah dikelola</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {departments.map(dept => {
              const empCount = employees.filter(e => e.department_id === dept.id).length
              return (
                <button
                  key={dept.id}
                  onClick={() => setFilterDept(dept.id)}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-gray-100 hover:border-teal-300 hover:bg-teal-50 transition-all group"
                >
                  <div className="w-12 h-12 bg-teal-100 group-hover:bg-teal-200 rounded-xl flex items-center justify-center text-teal-600 font-bold text-lg transition-colors">
                    {dept.name[0]?.toUpperCase()}
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{dept.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{empCount} karyawan</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Roster Bulanan</h1>
          <p className="text-sm text-gray-400 mt-0.5">Jadwal shift harian per karyawan</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigateMonth(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold">‹</button>
          <span className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 min-w-36 text-center capitalize">{monthName}</span>
          <button onClick={() => navigateMonth(1)} className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold">›</button>
        </div>
      </div>

      {/* Bulk Assign panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-3 overflow-hidden">
        <button
          onClick={() => setShowBulk(!showBulk)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center text-teal-600 text-lg">⚡</span>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">Isi Massal</p>
              <p className="text-xs text-gray-400">Assign shift ke banyak karyawan sekaligus</p>
            </div>
          </div>
          <span className={`text-gray-400 transition-transform duration-200 ${showBulk ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {showBulk && (
          <div className="border-t border-gray-100 p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">1. Pilih Karyawan</p>
                <button onClick={toggleAllEmp} className="text-xs text-teal-600 hover:underline font-medium">
                  {bulkEmpIds.length === filtered.length ? 'Batal pilih semua' : 'Pilih semua'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                {filtered.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => toggleBulkEmp(emp.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      bulkEmpIds.includes(emp.id)
                        ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <span>{bulkEmpIds.includes(emp.id) ? '✓' : ''}</span>
                    {emp.full_name}
                  </button>
                ))}
              </div>
              {bulkEmpIds.length > 0 && (
                <p className="text-xs text-teal-600 mt-1.5">{bulkEmpIds.length} karyawan dipilih</p>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">2. Pilih Shift / Libur</p>
              <div className="flex flex-wrap gap-2">
                {shifts.map((s, i) => (
                  <button key={s.id} onClick={() => { setBulkShiftId(s.id); if (bulkType === 'off') setBulkType('weekdays') }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      bulkShiftId === s.id && bulkType !== 'off'
                        ? SHIFT_COLORS[i % SHIFT_COLORS.length] + ' border-transparent shadow-sm'
                        : SHIFT_COLORS_LIGHT[i % SHIFT_COLORS_LIGHT.length] + ' hover:shadow-sm'
                    }`}>
                    {s.name} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                  </button>
                ))}
                <button onClick={() => { setBulkType('off'); setBulkShiftId('') }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    bulkType === 'off' ? 'bg-gray-500 text-white border-transparent' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                  }`}>
                  Libur
                </button>
              </div>
            </div>

            {bulkType !== 'off' && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">3. Terapkan ke Hari</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { val: 'weekdays', label: 'Hari Kerja (Sen–Jum)' },
                    { val: 'saturday', label: 'Sabtu' },
                    { val: 'sunday', label: 'Minggu' },
                    { val: 'all', label: 'Semua Hari' },
                    { val: 'range', label: 'Rentang Tanggal' },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setBulkType(opt.val as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        bulkType === opt.val ? 'bg-teal-600 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {bulkType === 'range' && (
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs text-gray-500">Tanggal</span>
                    <select value={bulkFrom} onChange={e => setBulkFrom(e.target.value)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                      <option value="">Dari</option>
                      {days.map(d => <option key={d.num} value={d.num}>{d.num}</option>)}
                    </select>
                    <span className="text-xs text-gray-400">–</span>
                    <select value={bulkTo} onChange={e => setBulkTo(e.target.value)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                      <option value="">Sampai</option>
                      {days.map(d => <option key={d.num} value={d.num}>{d.num}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleBulkApply}
              disabled={bulkLoading || bulkEmpIds.length === 0}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {bulkLoading ? 'Menerapkan...' : `Terapkan ke ${bulkEmpIds.length} karyawan`}
            </button>
          </div>
        )}
      </div>

      {/* Holiday panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
        <button
          onClick={() => setShowHolidays(!showHolidays)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 text-lg">🗓</span>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">Hari Libur Nasional</p>
              <p className="text-xs text-gray-400">
                {monthHolidays.length > 0
                  ? `${monthHolidays.length} hari libur di bulan ini`
                  : 'Belum ada data libur — klik untuk sync'}
              </p>
            </div>
          </div>
          <span className={`text-gray-400 transition-transform duration-200 ${showHolidays ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {showHolidays && (
          <div className="border-t border-gray-100 p-5 space-y-4">
            {/* Sync from API */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
              >
                {syncing ? '⟳ Memuat...' : '🔄 Sync Libur Nasional ' + year}
              </button>
              {syncMsg && <p className="text-xs text-gray-600">{syncMsg}</p>}
            </div>

            {/* Add custom holiday */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Tambah Libur Kustom</p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={e => setNewHolidayDate(e.target.value)}
                  min={`${year}-01-01`}
                  max={`${year}-12-31`}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <input
                  type="text"
                  placeholder="Nama hari libur..."
                  value={newHolidayName}
                  onChange={e => setNewHolidayName(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 flex-1 min-w-40"
                />
                <button
                  onClick={handleAddHoliday}
                  disabled={addingHoliday || !newHolidayDate || !newHolidayName.trim()}
                  className="px-4 py-1.5 bg-gray-800 hover:bg-gray-900 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Tambah
                </button>
              </div>
            </div>

            {/* List holidays this month */}
            {monthHolidays.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Libur bulan {monthName}</p>
                <div className="space-y-1.5">
                  {monthHolidays
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(h => (
                      <div key={h.date} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                        <span className="text-xs font-bold text-amber-700 min-w-16">
                          {new Date(h.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-sm text-gray-700 flex-1">{h.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${h.is_national ? 'bg-amber-200 text-amber-700' : 'bg-gray-200 text-gray-600'}`}>
                          {h.is_national ? 'Nasional' : 'Kustom'}
                        </span>
                        <button
                          onClick={() => handleDeleteHoliday(h.date)}
                          disabled={deletingDate === h.date}
                          className="text-gray-300 hover:text-red-400 text-xs transition-colors disabled:opacity-40"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dept info + search */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">
          <span className="text-teal-600 font-bold text-sm">🏗️ {selectedDept?.name ?? 'Departemen'}</span>
          <span className="text-xs text-teal-500">{filtered.length} karyawan</span>
          {!isDeptHead && (
            <button onClick={() => { setFilterDept(''); setEmpSearch('') }}
              className="ml-1 text-xs text-teal-400 hover:text-teal-600 font-medium">
              Ganti ↗
            </button>
          )}
        </div>
        <input
          type="text"
          placeholder="Cari karyawan..."
          value={empSearch}
          onChange={e => setEmpSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 w-48"
        />
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {shifts.map((s, i) => (
            <span key={s.id} className={`text-xs px-2 py-1 rounded-lg font-semibold ${SHIFT_COLORS[i % SHIFT_COLORS.length]}`}>
              {s.name.slice(0, 2)} = {s.name}
            </span>
          ))}
          <span className="text-xs px-2 py-1 rounded-lg font-semibold bg-gray-200 text-gray-600">L = Libur</span>
          <span className="text-xs px-2 py-1 rounded-lg font-semibold bg-amber-100 text-amber-700">🔴 = Libur Nasional</span>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <p className="text-3xl mb-3">📅</p>
          <p className="text-gray-500 font-medium">Belum ada karyawan</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="border-collapse" style={{ minWidth: `${200 + daysInMonth * 44}px` }}>
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="sticky left-0 bg-white z-20 text-left text-xs font-semibold text-gray-500 px-4 py-4 min-w-48 border-r border-gray-100">
                    Karyawan
                  </th>
                  {days.map(d => {
                    const isToday = d.num === new Date().getDate() && month === new Date().getMonth() + 1 && year === new Date().getFullYear()
                    return (
                      <th
                        key={d.num}
                        title={d.isHoliday ? d.holidayName : undefined}
                        className={`text-center py-2 w-11 ${
                          d.isHoliday ? 'bg-amber-50/80' :
                          d.isWeekend ? 'bg-rose-50/60' :
                          'bg-gray-50/60'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1 px-0.5">
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                            d.isHoliday ? 'text-amber-500' :
                            d.isWeekend ? 'text-rose-400' :
                            'text-gray-400'
                          }`}>
                            {d.isHoliday ? '🔴' : d.dayName}
                          </span>
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            isToday ? 'bg-teal-500 text-white shadow-sm shadow-teal-200' :
                            d.isHoliday ? 'bg-amber-400 text-white' :
                            d.isWeekend ? 'text-rose-500' :
                            'text-gray-600'
                          }`}>
                            {d.num}
                          </span>
                        </div>
                      </th>
                    )
                  })}
                  <th className="text-center text-xs font-semibold text-gray-400 px-3 py-4 min-w-16 bg-gray-50/60">Terisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="sticky left-0 bg-white border-r border-gray-100 px-4 py-2 z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold text-xs shrink-0">
                          {emp.full_name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-xs text-gray-800 whitespace-nowrap">{emp.full_name}</p>
                          <p className="text-[10px] text-gray-400">{(emp.departments as { name: string } | null)?.name ?? '-'}</p>
                        </div>
                      </div>
                    </td>

                    {days.map(d => {
                      const key = `${emp.id}_${d.dateStr}`
                      const sched = scheduleMap[key]
                      const shift = sched?.shift_id ? shifts.find(s => s.id === sched.shift_id) : null
                      const isSavingThis = saving === key
                      const isOpen = activeCell === key
                      const isToday = d.num === new Date().getDate() && month === new Date().getMonth() + 1 && year === new Date().getFullYear()

                      return (
                        <td key={d.num} className={`relative text-center py-1.5 px-0.5 ${
                          d.isHoliday ? 'bg-amber-50/40' :
                          d.isWeekend ? 'bg-rose-50/30' : ''
                        } ${isToday ? 'bg-teal-50/40' : ''}`}>
                          <button
                            onClick={(e) => {
                              if (isOpen) {
                                setActiveCell(null)
                                setPopupPos(null)
                                setActiveCellData(null)
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setActiveCell(key)
                                setPopupPos({ top: rect.bottom + 4, left: rect.left + rect.width / 2 })
                                setActiveCellData({ empId: emp.id, dayNum: d.num, isHoliday: d.isHoliday, holidayName: d.holidayName, sched: sched ? { ...sched } : undefined })
                              }
                            }}
                            disabled={!!isSavingThis}
                            title={d.isHoliday && !sched ? d.holidayName : undefined}
                            className={`w-9 h-8 rounded-xl mx-auto flex items-center justify-center text-[10px] font-bold transition-all
                              ${isSavingThis ? 'opacity-40 cursor-wait' : 'cursor-pointer hover:scale-110'}
                              ${sched?.is_off ? 'bg-gray-200 text-gray-600 ring-1 ring-gray-300' :
                                shift ? `${shiftColorMap[shift.id]} shadow-sm` :
                                d.isHoliday ? 'bg-amber-100 text-amber-400 hover:bg-amber-200' :
                                'bg-transparent hover:bg-gray-100 text-gray-200 hover:text-gray-400'}
                            `}
                          >
                            {isSavingThis ? '⟳' : sched?.is_off ? 'L' : shift ? shift.name.slice(0, 2) : d.isHoliday ? '🔴' : '·'}
                          </button>
                        </td>
                      )
                    })}

                    <td className="text-center px-3 py-2">
                      <span className={`text-xs font-bold ${filledCount(emp.id) === daysInMonth ? 'text-teal-600' : 'text-gray-400'}`}>
                        {filledCount(emp.id)}/{daysInMonth}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeCell && popupPos && activeCellData && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => { setActiveCell(null); setPopupPos(null); setActiveCellData(null) }} />
          <div
            className="fixed bg-white rounded-xl shadow-xl border border-gray-100 z-[101] p-1.5 w-36"
            style={{ top: popupPos.top, left: popupPos.left, transform: 'translateX(-50%)' }}
            onClick={e => e.stopPropagation()}
          >
            {activeCellData.isHoliday && (
              <p className="text-[10px] text-amber-600 px-3 py-1 font-semibold truncate">{activeCellData.holidayName}</p>
            )}
            {shifts.map((s, i) => (
              <button key={s.id}
                onClick={() => { assignCell(activeCellData.empId, activeCellData.dayNum, s.id, false); setActiveCell(null); setPopupPos(null); setActiveCellData(null) }}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold mb-0.5 ${SHIFT_COLORS[i % SHIFT_COLORS.length]} opacity-90 hover:opacity-100`}>
                {s.name}
              </button>
            ))}
            <button onClick={() => { assignCell(activeCellData.empId, activeCellData.dayNum, null, true); setActiveCell(null); setPopupPos(null); setActiveCellData(null) }}
              className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 mb-0.5">
              Libur
            </button>
            {activeCellData.sched && (
              <button onClick={() => { clearCell(activeCellData.empId, activeCellData.dayNum); setActiveCell(null); setPopupPos(null); setActiveCellData(null) }}
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50">
                Hapus
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
