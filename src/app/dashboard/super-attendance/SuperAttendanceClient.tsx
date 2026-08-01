'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  resetAttendanceRange,
  overrideAttendance,
  getEmployeeAttendance,
  getAttendanceCounts,
  getAttendanceByDate,
} from '@/app/actions/super-attendance'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Org {
  id: string
  name: string
  company_code: string
  is_active: boolean
}

interface Employee {
  id: string
  full_name: string
  employee_id: string | null
  org_id: string
  is_active: boolean
  departments: { name: string } | null
}

type EditTarget = {
  userId: string
  userName: string
  date: string
  checkInTime: string
  checkOutTime: string
  notes: string
} | null

type ResetTarget = {
  type: 'employee' | 'org' | 'all'
  label: string
  userIds: string[]
} | null

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function firstOfMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}

function lastOfMonth() {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(last)}`
}

function todayStr() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Convert ISO timestamp (UTC) ke 'HH:MM' WIB
function isoToLocalTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  // Tambah offset WIB biar jam yang ditampilin konsisten
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000)
  return `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}`
}

export default function SuperAttendanceClient({
  orgs,
  employees,
}: {
  orgs: Org[]
  employees: Employee[]
}) {
  const [startDate, setStartDate] = useState(firstOfMonth())
  const [endDate, setEndDate] = useState(lastOfMonth())
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState<string>('all')
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set())
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [resetTarget, setResetTarget] = useState<ResetTarget>(null)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({}) // key: userId → total absen in range
  const [orgCounts, setOrgCounts] = useState<Record<string, number>>({}) // key: orgId → total absen in range
  const [viewDate, setViewDate] = useState(todayStr()) // tanggal buat lihat jam masuk/keluar
  const [jamByUser, setJamByUser] = useState<Record<string, { in: string | null; out: string | null }>>({})

  // Auto-hide toast setelah 4 detik
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // Group employees by org
  const employeesByOrg = useMemo(() => {
    const map: Record<string, Employee[]> = {}
    for (const e of employees) {
      if (!map[e.org_id]) map[e.org_id] = []
      map[e.org_id].push(e)
    }
    return map
  }, [employees])

  // Filtered orgs (search + org filter)
  const filteredOrgs = useMemo(() => {
    return orgs.filter(o => {
      if (orgFilter !== 'all' && o.id !== orgFilter) return false
      // Search: org name atau ada employee yang match
      if (search.trim()) {
        const q = search.toLowerCase()
        const orgMatch = o.name.toLowerCase().includes(q)
        const empMatch = (employeesByOrg[o.id] ?? []).some(
          e =>
            e.full_name.toLowerCase().includes(q) ||
            (e.employee_id ?? '').toLowerCase().includes(q)
        )
        if (!orgMatch && !empMatch) return false
      }
      return true
    })
  }, [orgs, orgFilter, search, employeesByOrg])

  // Fetch counts + jam saat range/viewDate berubah atau org di-expand
  useEffect(() => {
    let cancelled = false
    async function fetchCounts() {
      const expandedOrgIds = Array.from(expandedOrgs)
      if (expandedOrgIds.length === 0) return

      // Fetch paralel per org yang di-expand: count range + jam per viewDate
      const results = await Promise.all(
        expandedOrgIds.map(async orgId => {
          const emps = employeesByOrg[orgId] ?? []
          if (emps.length === 0) return { orgId, perUser: {}, total: 0, jam: {} as Record<string, { in: string | null; out: string | null }> }
          const userIds = emps.map(e => e.id)
          const [countRes, jamRes] = await Promise.all([
            getAttendanceCounts({ userIds, startDate, endDate }),
            getAttendanceByDate({ userIds, date: viewDate }),
          ])
          const perUser = countRes.data ?? {}
          const total = Object.values(perUser).reduce((a, b) => a + b, 0)
          return { orgId, perUser, total, jam: jamRes.data ?? {} }
        })
      )

      if (cancelled) return

      const newCounts: Record<string, number> = {}
      const newOrgCounts: Record<string, number> = {}
      const newJam: Record<string, { in: string | null; out: string | null }> = {}
      for (const r of results) {
        newOrgCounts[r.orgId] = r.total
        Object.assign(newCounts, r.perUser)
        Object.assign(newJam, r.jam)
      }
      setCounts(prev => ({ ...prev, ...newCounts }))
      setOrgCounts(prev => ({ ...prev, ...newOrgCounts }))
      // Replace entirely biar jam tanggal lama nggak nyangkut
      setJamByUser(newJam)
    }
    fetchCounts()
    return () => { cancelled = true }
  }, [expandedOrgs, startDate, endDate, employeesByOrg, viewDate])

  function toggleOrg(orgId: string) {
    setExpandedOrgs(prev => {
      const next = new Set(prev)
      if (next.has(orgId)) next.delete(orgId)
      else next.add(orgId)
      return next
    })
  }

  async function openEditModal(emp: Employee) {
    // Set target dulu biar modal kebuka (empty state)
    setEditTarget({
      userId: emp.id,
      userName: emp.full_name,
      date: todayStr(),
      checkInTime: '',
      checkOutTime: '',
      notes: '',
    })
    // Lalu fetch existing attendance untuk tanggal hari ini
    const result = await getEmployeeAttendance(emp.id, todayStr())
    if (result.error) {
      setToast({ type: 'error', msg: `Gagal load data: ${result.error}` })
      return
    }
    const data = result.data
    setEditTarget(prev => prev ? {
      ...prev,
      checkInTime: data ? isoToLocalTime(data.check_in_time) : '',
      checkOutTime: data ? isoToLocalTime(data.check_out_time) : '',
      notes: data?.notes ?? '',
    } : prev)
  }

  // Saat user ganti tanggal di modal, fetch ulang existing attendance
  async function handleEditDateChange(newDate: string) {
    if (!editTarget) return
    setEditTarget({ ...editTarget, date: newDate, checkInTime: '', checkOutTime: '', notes: '' })
    const result = await getEmployeeAttendance(editTarget.userId, newDate)
    if (result.error) {
      setToast({ type: 'error', msg: `Gagal load data: ${result.error}` })
      return
    }
    const data = result.data
    setEditTarget(prev => prev ? {
      ...prev,
      checkInTime: data ? isoToLocalTime(data.check_in_time) : '',
      checkOutTime: data ? isoToLocalTime(data.check_out_time) : '',
      notes: data?.notes ?? '',
    } : prev)
  }

  async function handleSaveEdit() {
    if (!editTarget) return
    setSaving(true)
    const result = await overrideAttendance({
      userId: editTarget.userId,
      date: editTarget.date,
      checkInTime: editTarget.checkInTime || null,
      checkOutTime: editTarget.checkOutTime || null,
      notes: editTarget.notes,
    })
    setSaving(false)
    if (result.error) {
      setToast({ type: 'error', msg: `Gagal: ${result.error}` })
    } else {
      setToast({ type: 'success', msg: `Jam ${editTarget.userName} tanggal ${editTarget.date} berhasil diupdate` })
      setEditTarget(null)
      // Trigger refresh counts + jam (especially kalau editTarget.date === viewDate)
      setExpandedOrgs(prev => new Set(prev))
    }
  }

  function openResetEmployee(emp: Employee) {
    setResetTarget({
      type: 'employee',
      label: `${emp.full_name}${emp.employee_id ? ` (${emp.employee_id})` : ''}`,
      userIds: [emp.id],
    })
    setResetConfirmText('')
  }

  function openResetOrg(org: Org) {
    const emps = employeesByOrg[org.id] ?? []
    setResetTarget({
      type: 'org',
      label: `${org.name} (${emps.length} karyawan)`,
      userIds: emps.map(e => e.id),
    })
    setResetConfirmText('')
  }

  function openResetAll() {
    setResetTarget({
      type: 'all',
      label: `SEMUA karyawan di ${orgs.length} perusahaan (${employees.length} total)`,
      userIds: employees.map(e => e.id),
    })
    setResetConfirmText('')
  }

  async function handleConfirmReset() {
    if (!resetTarget) return
    if (resetConfirmText !== 'HAPUS') {
      setToast({ type: 'error', msg: 'Ketik "HAPUS" (huruf besar) untuk konfirmasi' })
      return
    }
    setSaving(true)
    const result = await resetAttendanceRange({
      userIds: resetTarget.userIds,
      startDate,
      endDate,
      scope: resetTarget.type,
    })
    setSaving(false)
    if (result.error) {
      setToast({ type: 'error', msg: `Gagal: ${result.error}` })
    } else {
      setToast({
        type: 'success',
        msg: `Berhasil hapus ${result.deleted} record absen${result.photos ? ` + ${result.photos} foto` : ''}`,
      })
      setResetTarget(null)
      setResetConfirmText('')
      // Refresh counts
      setExpandedOrgs(prev => new Set(prev))
    }
  }

  const totalAbsenAllOrgs = Object.values(orgCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header card */}
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl shadow-md p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center text-2xl shrink-0">
              📋
            </div>
            <div>
              <h1 className="text-2xl font-bold">Manajemen Absensi</h1>
              <p className="text-sm text-purple-100 mt-1 max-w-2xl">
                Kelola absen karyawan lintas perusahaan. Reset range tanggal atau override jam masuk/keluar manual per tanggal.
              </p>
            </div>
          </div>
          <Button
            onClick={openResetAll}
            disabled={employees.length === 0}
            className="bg-red-500 hover:bg-red-600 text-white border-0 shadow-sm"
          >
            🗑 Reset SEMUA Absen
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-lg">🏭</div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Perusahaan</p>
              <p className="text-xl font-bold text-gray-900">{filteredOrgs.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-lg">👥</div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Karyawan</p>
              <p className="text-xl font-bold text-gray-900">{employees.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-lg">✅</div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Absen di Range</p>
              <p className="text-xl font-bold text-gray-900">{totalAbsenAllOrgs}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-lg">📅</div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Lihat Jam</p>
              <p className="text-xl font-bold text-gray-900 font-mono">{viewDate.slice(5)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`p-3 rounded-xl text-sm border ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Filter card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <span className="text-base">🎛️</span>
          <h2 className="text-sm font-semibold text-gray-700">Filter & Pencarian</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <Label htmlFor="start-date" className="text-xs text-gray-600">Dari Tanggal (reset)</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end-date" className="text-xs text-gray-600">Sampai Tanggal (reset)</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="view-date" className="text-xs text-gray-600">Lihat Jam Tanggal</Label>
              <Input
                id="view-date"
                type="date"
                value={viewDate}
                onChange={e => setViewDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="search" className="text-xs text-gray-600">Cari Karyawan</Label>
              <Input
                id="search"
                type="text"
                placeholder="Nama / ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="org-filter" className="text-xs text-gray-600">Filter Perusahaan</Label>
              <select
                id="org-filter"
                className="w-full h-9 px-3 rounded-md border border-gray-200 bg-white text-sm"
                value={orgFilter}
                onChange={e => setOrgFilter(e.target.value)}
              >
                <option value="all">Semua Perusahaan ({orgs.length})</option>
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({employeesByOrg[o.id]?.length ?? 0})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* List grouped by org */}
      <div className="space-y-3">
        {filteredOrgs.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white border border-gray-100 rounded-2xl shadow-sm">
            <div className="text-4xl mb-2">🔍</div>
            Tidak ada perusahaan yang cocok dengan filter.
          </div>
        )}

        {filteredOrgs.map(org => {
          const orgEmps = employeesByOrg[org.id] ?? []
          const isExpanded = expandedOrgs.has(org.id)
          const totalAbsen = orgCounts[org.id] ?? 0
          return (
            <div
              key={org.id}
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-shadow ${
                isExpanded ? 'border-purple-200 shadow-md' : 'border-gray-100'
              }`}
            >
              {/* Org header (clickable) */}
              <button
                type="button"
                onClick={() => toggleOrg(org.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 text-sm shrink-0">
                    🏢
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      {org.name}
                      {!org.is_active && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          nonaktif
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      <span className="font-mono">{org.company_code}</span>
                      {' · '}<span className="text-blue-600 font-medium">{orgEmps.length} karyawan</span>
                      {' · '}<span className="text-green-600 font-medium">{totalAbsen} absen</span>
                      {' '}<span className="text-gray-400">({startDate.slice(5)}–{endDate.slice(5)})</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isExpanded && orgEmps.length > 0 && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); openResetOrg(org) }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); openResetOrg(org) } }}
                      className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 px-2 py-1 rounded-md cursor-pointer transition-colors"
                    >
                      🗑 Reset Org
                    </span>
                  )}
                  <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                </div>
              </button>

              {/* Employee list */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50">
                  {orgEmps.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-gray-500">
                      <div className="text-2xl mb-1">📭</div>
                      Belum ada karyawan di org ini.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-white text-gray-500 text-xs uppercase tracking-wide">
                          <tr>
                            <th className="text-left px-5 py-3 font-medium">Nama</th>
                            <th className="text-left px-4 py-3 font-medium">Dept</th>
                            <th className="text-left px-4 py-3 font-medium">Employee ID</th>
                            <th className="text-left px-4 py-3 font-medium">
                              <span className="inline-flex items-center gap-1">
                                Masuk
                                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded normal-case">
                                  {viewDate.slice(5)}
                                </span>
                              </span>
                            </th>
                            <th className="text-left px-4 py-3 font-medium">Keluar</th>
                            <th className="text-right px-4 py-3 font-medium">Total Absen</th>
                            <th className="text-right px-5 py-3 font-medium">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orgEmps
                            .filter(e => {
                              if (!search.trim()) return true
                              const q = search.toLowerCase()
                              return (
                                e.full_name.toLowerCase().includes(q) ||
                                (e.employee_id ?? '').toLowerCase().includes(q)
                              )
                            })
                            .map(emp => {
                              const jam = jamByUser[emp.id]
                              return (
                                <tr key={emp.id} className="border-t border-gray-100 hover:bg-purple-50/30 transition-colors">
                                  <td className="px-5 py-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                                        {emp.full_name[0]?.toUpperCase()}
                                      </div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-gray-900">{emp.full_name}</span>
                                        {!emp.is_active && (
                                          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                                            nonaktif
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">
                                    {emp.departments?.name ?? <span className="text-gray-300">-</span>}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                                    {emp.employee_id ?? <span className="text-gray-300">-</span>}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-xs">
                                    {jam?.in ? (
                                      <span className="inline-flex items-center gap-1 text-green-700">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                        {isoToLocalTime(jam.in)}
                                      </span>
                                    ) : (
                                      <span className="text-gray-300">--:--</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-xs">
                                    {jam?.out ? (
                                      <span className="inline-flex items-center gap-1 text-blue-700">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                        {isoToLocalTime(jam.out)}
                                      </span>
                                    ) : (
                                      <span className="text-gray-300">--:--</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className="inline-flex items-center justify-center min-w-7 px-2 py-0.5 bg-gray-100 rounded-full font-semibold text-gray-700 text-xs">
                                      {counts[emp.id] ?? 0}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 text-right whitespace-nowrap">
                                    <button
                                      onClick={() => openEditModal(emp)}
                                      className="inline-flex items-center gap-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700 px-2 py-1 rounded-md mr-1 text-xs font-medium transition-colors"
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      onClick={() => openResetEmployee(emp)}
                                      className="inline-flex items-center gap-1 text-red-600 hover:bg-red-50 hover:text-red-700 px-2 py-1 rounded-md text-xs font-medium transition-colors"
                                    >
                                      🗑 Reset
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal Edit Jam */}
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Absen Manual</DialogTitle>
            <DialogDescription>
              Override jam masuk/keluar untuk{' '}
              <span className="font-medium text-gray-900">{editTarget?.userName}</span>. Status & late_minutes
              dihitung otomatis oleh trigger kalau shift sudah diset.
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-3 py-2">
              <div>
                <Label htmlFor="edit-date">Tanggal</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editTarget.date}
                  onChange={e => handleEditDateChange(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-check-in">Jam Masuk (WIB)</Label>
                  <Input
                    id="edit-check-in"
                    type="time"
                    value={editTarget.checkInTime}
                    onChange={e => setEditTarget({ ...editTarget, checkInTime: e.target.value })}
                    placeholder="09:00"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-check-out">Jam Keluar (WIB)</Label>
                  <Input
                    id="edit-check-out"
                    type="time"
                    value={editTarget.checkOutTime}
                    onChange={e => setEditTarget({ ...editTarget, checkOutTime: e.target.value })}
                    placeholder="17:00"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-notes">Catatan (opsional)</Label>
                <textarea
                  id="edit-notes"
                  className="w-full min-h-20 px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                  placeholder="Alasan koreksi..."
                  value={editTarget.notes}
                  onChange={e => setEditTarget({ ...editTarget, notes: e.target.value })}
                />
              </div>
              <p className="text-xs text-gray-500">
                Kosongkan jam untuk clear value. Simpan akan upsert (insert jika belum ada, update jika sudah ada).
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Reset Confirm */}
      <Dialog open={!!resetTarget} onOpenChange={open => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Reset Absen</DialogTitle>
            <DialogDescription>
              Tindakan ini <span className="font-semibold text-red-600">TIDAK BISA DIBATALKAN</span>.
              Semua record absen + foto di storage akan dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          {resetTarget && (
            <div className="space-y-3 py-2 text-sm">
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 space-y-1">
                <div>
                  <span className="text-gray-500">Target:</span>{' '}
                  <span className="font-medium">{resetTarget.label}</span>
                </div>
                <div>
                  <span className="text-gray-500">Range:</span>{' '}
                  <span className="font-mono">{startDate}</span> s/d{' '}
                  <span className="font-mono">{endDate}</span>
                </div>
                <div>
                  <span className="text-gray-500">Jumlah karyawan affected:</span>{' '}
                  <span className="font-medium">{resetTarget.userIds.length}</span>
                </div>
              </div>
              <div>
                <Label htmlFor="reset-confirm">
                  Ketik <span className="font-mono font-bold">HAPUS</span> untuk konfirmasi
                </Label>
                <Input
                  id="reset-confirm"
                  type="text"
                  value={resetConfirmText}
                  onChange={e => setResetConfirmText(e.target.value)}
                  placeholder="HAPUS"
                  className="font-mono"
                  autoComplete="off"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={saving}>
              Batal
            </Button>
            <Button
              onClick={handleConfirmReset}
              disabled={saving || resetConfirmText !== 'HAPUS'}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving ? 'Memproses...' : 'Hapus Permanen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
