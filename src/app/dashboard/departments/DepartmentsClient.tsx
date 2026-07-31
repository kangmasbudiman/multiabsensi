'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Shift {
  id: string
  name: string
  start_time: string | null
  end_time: string | null
}

interface NestedShift {
  id: string
  name: string
}

interface Department {
  id: string
  name: string
  description?: string
  default_shift_id: string | null
  shifts?: NestedShift | NestedShift[] | null
  created_at: string
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
  const [form, setForm] = useState({ name: '', description: '', default_shift_id: '' })

  const getShiftName = (dept: Department): string | null => {
    if (!dept.shifts) return null
    const s = Array.isArray(dept.shifts) ? dept.shifts[0] : dept.shifts
    return s?.name ?? null
  }

  // Lookup shift name dari list shift (untuk info tambahan di badge)
  const findShiftName = (shiftId: string | null): string | null => {
    if (!shiftId) return null
    return shifts.find(s => s.id === shiftId)?.name ?? null
  }

  const openAdd = () => {
    setEditDept(null)
    setForm({ name: '', description: '', default_shift_id: '' })
    setShowModal(true)
  }

  const openEdit = (d: Department) => {
    setEditDept(d)
    setForm({
      name: d.name,
      description: d.description ?? '',
      default_shift_id: d.default_shift_id ?? '',
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const payload = {
      name: form.name,
      description: form.description || null,
      default_shift_id: form.default_shift_id || null,
      org_id: orgId,
    }
    if (editDept) {
      await supabase.from('departments').update(payload).eq('id', editDept.id)
    } else {
      await supabase.from('departments').insert(payload)
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
          {departments.map((dept, i) => (
            <div key={dept.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:-translate-y-1 hover:border-teal-300 transition-all duration-200 cursor-default" style={{ ['--tw-shadow' as string]: '0 0 0 0 transparent' }} onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 30px rgba(20,184,166,0.35)')} onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
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
                    {getShiftName(dept) && (
                      <p className="inline-flex items-center gap-1 text-[11px] text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full mt-1.5">
                        🕐 Shift: <span className="font-semibold">{getShiftName(dept)}</span>
                      </p>
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
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
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
                  <span className="text-xs text-gray-400 font-normal ml-1.5">(opsional)</span>
                </label>
                <select
                  value={form.default_shift_id}
                  onChange={(e) => setForm({ ...form, default_shift_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                >
                  <option value="">— Tidak ada shift default —</option>
                  {shifts.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.start_time ? ` (${s.start_time.slice(0, 5)}–${(s.end_time ?? '').slice(0, 5)})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Karyawan di departemen ini otomatis pakai shift tersebut kalau belum di-assign shift individual. Cocok untuk bagian tetap seperti Management, HRD, IT.
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
