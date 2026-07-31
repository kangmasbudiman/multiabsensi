'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Shift {
  id: string
  name: string
  start_time: string | null
  end_time: string | null
  work_days: number[]
}

interface DeptShift {
  shift_id: string
  shifts: { id: string; name: string; start_time: string | null; end_time: string | null; work_days: number[] } | { id: string; name: string; start_time: string | null; end_time: string | null; work_days: number[] }[] | null
}

interface Department {
  id: string
  name: string
  description?: string
  department_shifts?: DeptShift[] | null
  created_at: string
}

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function summarizeWorkDays(workDays: number[] | undefined | null): string {
  const days = workDays ?? []
  if (days.length === 0) return '—'
  const sorted = [...days].sort()
  // Special cases
  if (sorted.join() === '1,2,3,4,5') return 'Sen-Jum'
  if (sorted.join() === '1,2,3,4,5,6') return 'Sen-Sab'
  if (sorted.join() === '1,2,3,4,5,6,7') return 'Setiap hari'
  if (sorted.length === 1) return DAY_LABELS[sorted[0]]
  return sorted.map(d => DAY_LABELS[d]).join(', ')
}

export default function DepartmentsClient({
  departments,
  shifts,
  orgId,
}: {
  departments: Department[]
  shifts: Shift[]
  orgId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [showModal, setShowModal] = useState(false)
  const [editDept, setEditDept] = useState<Department | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState<{ name: string; description: string; shift_ids: string[] }>({
    name: '', description: '', shift_ids: [],
  })

  const getDeptShifts = (dept: Department): Shift[] => {
    if (!dept.department_shifts) return []
    return dept.department_shifts.map(ds => {
      const s = Array.isArray(ds.shifts) ? ds.shifts[0] : ds.shifts
      return s as unknown as Shift
    }).filter(Boolean)
  }

  const openAdd = () => {
    setEditDept(null)
    setForm({ name: '', description: '', shift_ids: [] })
    setShowModal(true)
  }

  const openEdit = (d: Department) => {
    setEditDept(d)
    setForm({
      name: d.name,
      description: d.description ?? '',
      shift_ids: getDeptShifts(d).map(s => s.id),
    })
    setShowModal(true)
  }

  const toggleShift = (shiftId: string) => {
    setForm(f => ({
      ...f,
      shift_ids: f.shift_ids.includes(shiftId)
        ? f.shift_ids.filter(id => id !== shiftId)
        : [...f.shift_ids, shiftId],
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const payload = {
      name: form.name,
      description: form.description || null,
      org_id: orgId,
    }

    let deptId = editDept?.id
    if (editDept) {
      await supabase.from('departments').update(payload).eq('id', editDept.id)
    } else {
      const { data: created } = await supabase.from('departments').insert(payload).select().single()
      deptId = created?.id
    }

    // Sync multi-shift assignment (department_shifts)
    if (deptId) {
      // Hapus semua dulu, insert baru (atomic-ish, simpler than diffing)
      await supabase.from('department_shifts').delete().eq('department_id', deptId)
      if (form.shift_ids.length > 0) {
        await supabase.from('department_shifts').insert(
          form.shift_ids.map(shift_id => ({ department_id: deptId, shift_id }))
        )
      }
    }

    setIsLoading(false)
    setShowModal(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus departemen ini? Karyawan di departemen ini tidak akan terhapus.')) return
    await supabase.from('departments').delete().eq('id', id)
    router.refresh()
  }

  const COLORS = ['bg-teal-100 text-teal-700', 'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700',
    'bg-orange-100 text-orange-700', 'bg-green-100 text-green-700', 'bg-pink-100 text-pink-700']

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Departemen</h1>
          <p className="text-sm text-gray-400 mt-0.5">{departments.length} departemen terdaftar</p>
        </div>
        <button onClick={openAdd}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
          + Tambah Departemen
        </button>
      </div>

      {departments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <p className="text-4xl mb-3">🏗️</p>
          <p className="text-gray-500 font-medium">Belum ada departemen</p>
          <p className="text-gray-400 text-sm mt-1">Tambahkan departemen untuk mengorganisir karyawan</p>
          <button onClick={openAdd}
            className="mt-4 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
            + Tambah Departemen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept, i) => {
            const deptShifts = getDeptShifts(dept)
            return (
              <div key={dept.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:-translate-y-1 hover:border-teal-300 transition-all duration-200 cursor-default" onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 30px rgba(20,184,166,0.35)')} onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${COLORS[i % COLORS.length]}`}>
                      {dept.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{dept.name}</p>
                      {dept.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{dept.description}</p>
                      )}
                      {deptShifts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {deptShifts.map(s => (
                            <span key={s.id} className="inline-flex items-center gap-1 text-[10px] text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                              🕐 <span className="font-semibold">{s.name}</span>
                              <span className="text-teal-500">· {summarizeWorkDays(s.work_days)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-300 mt-1">
                        Dibuat {new Date(dept.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(dept)}
                      className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors text-sm">
                      ✏️
                    </button>
                    <button onClick={() => handleDelete(dept.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-bold text-gray-800">{editDept ? 'Edit Departemen' : 'Tambah Departemen'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Departemen *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: HRD, Keuangan, IT..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Deskripsi</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Opsional — deskripsi singkat departemen ini"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Shift Default
                  <span className="text-xs text-gray-400 font-normal ml-1.5">(opsional, bisa pilih lebih dari 1)</span>
                </label>
                {shifts.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠️ Belum ada shift. Tambahkan shift dulu di menu <strong>Shift</strong>.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto border border-gray-200 rounded-xl p-2">
                    {shifts.map(s => {
                      const checked = form.shift_ids.includes(s.id)
                      return (
                        <label
                          key={s.id}
                          className={`flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleShift(s.id)}
                            className="mt-0.5 accent-teal-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                            <p className="text-xs text-gray-500">
                              {s.start_time ? `${s.start_time.slice(0, 5)}–${(s.end_time ?? '').slice(0, 5)}` : 'Tanpa jam tetap'}
                              {' · '}
                              {summarizeWorkDays(s.work_days)}
                            </p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  Karyawan di departemen ini otomatis pakai shift yang dipilih kalau belum di-assign shift individual.
                  Contoh Management: pilih shift <strong>Senin-Jumat 08:00-16:00</strong> + <strong>Sabtu 08:00-13:00</strong> —
                  sistem akan ambil yang cocok dengan hari absen.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">
                  Batal
                </button>
                <button type="submit" disabled={isLoading}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold">
                  {isLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
