'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Shift } from '@/types'

const DAY_NAMES = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export default function ShiftsClient({ shifts, orgId }: { shifts: Shift[]; orgId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [showModal, setShowModal] = useState(false)
  const [editShift, setEditShift] = useState<Shift | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', start_time: '08:00', end_time: '17:00',
    late_tolerance_minutes: 15, allowance: 0,
    work_days: [1, 2, 3, 4, 5] as number[],
  })

  const openQuickSaturday = () => {
    const existing = shifts.find(s => s.work_days.includes(1))
    setEditShift(null)
    setForm({
      name: 'Sabtu',
      start_time: existing ? existing.start_time.slice(0, 5) : '08:00',
      end_time: existing ? existing.end_time.slice(0, 5) : '17:00',
      late_tolerance_minutes: existing ? existing.late_tolerance_minutes : 15,
      allowance: existing ? existing.allowance : 0,
      work_days: [6],
    })
    setShowModal(true)
  }

  const openAdd = () => {
    setEditShift(null)
    setForm({ name: '', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, allowance: 0, work_days: [1,2,3,4,5] })
    setShowModal(true)
  }

  const openDuplicate = (s: Shift) => {
    setEditShift(null)
    setForm({
      name: s.name + ' (Salinan)',
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
      late_tolerance_minutes: s.late_tolerance_minutes,
      allowance: s.allowance,
      work_days: [...s.work_days],
    })
    setShowModal(true)
  }

  const openEdit = (s: Shift) => {
    setEditShift(s)
    setForm({ name: s.name, start_time: s.start_time.slice(0,5), end_time: s.end_time.slice(0,5), late_tolerance_minutes: s.late_tolerance_minutes, allowance: s.allowance, work_days: s.work_days })
    setShowModal(true)
  }

  const toggleDay = (day: number) => {
    setForm(f => ({ ...f, work_days: f.work_days.includes(day) ? f.work_days.filter(d => d !== day) : [...f.work_days, day].sort() }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const payload = { ...form, org_id: orgId, start_time: form.start_time + ':00', end_time: form.end_time + ':00' }
    if (editShift) {
      await supabase.from('shifts').update(payload).eq('id', editShift.id)
    } else {
      await supabase.from('shifts').insert(payload)
    }
    setIsLoading(false); setShowModal(false); router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus shift ini?')) return
    await supabase.from('shifts').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manajemen Shift</h1>
          <p className="text-sm text-gray-400 mt-0.5">{shifts.length} shift terdaftar</p>
        </div>
        <div className="flex items-center gap-2">
          {!shifts.some(s => s.work_days.length === 1 && s.work_days.includes(6)) && (
            <button onClick={openQuickSaturday}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
              Setup Sabtu
            </button>
          )}
          <button onClick={openAdd}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
            + Tambah Shift
          </button>
        </div>
      </div>

      {shifts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <p className="text-4xl mb-3">🕐</p>
          <p className="text-gray-500 font-medium">Belum ada shift</p>
          <p className="text-gray-400 text-sm mt-1">Tambahkan shift kerja untuk digunakan karyawan</p>
          <button onClick={openAdd} className="mt-4 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
            + Tambah Shift
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map(s => (
            <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:-translate-y-1 hover:border-teal-300 transition-all duration-200 cursor-default" onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 30px rgba(20,184,166,0.35)')} onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-800">{s.name}</h3>
                  <p className="text-2xl font-bold text-teal-600 mt-1">
                    {s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openDuplicate(s)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg text-sm" title="Duplikat shift">📋</button>
                  <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg text-sm">✏️</button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg text-sm">🗑️</button>
                </div>
              </div>
              <div className="flex gap-1 mb-3">
                {[1,2,3,4,5,6,7].map(d => (
                  <span key={d} className={`flex-1 text-center text-xs py-1 rounded font-medium ${s.work_days.includes(d) ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-300'}`}>
                    {DAY_NAMES[d]}
                  </span>
                ))}
              </div>
              <div className="flex gap-3 text-xs text-gray-500 pt-3 border-t border-gray-50">
                <span>⏱ Toleransi: {s.late_tolerance_minutes} mnt</span>
                {s.allowance > 0 && <span>💰 Rp{s.allowance.toLocaleString('id-ID')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{editShift ? 'Edit Shift' : 'Tambah Shift'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Shift *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Shift Pagi, Shift Siang..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Jam Masuk</label>
                  <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Jam Keluar</label>
                  <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Toleransi Terlambat (menit)</label>
                  <input type="number" min={0} value={form.late_tolerance_minutes} onChange={e => setForm({ ...form, late_tolerance_minutes: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tunjangan Shift (Rp)</label>
                  <input type="number" min={0} value={form.allowance} onChange={e => setForm({ ...form, allowance: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hari Kerja</label>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setForm(f => ({ ...f, work_days: [1,2,3,4,5] }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                      form.work_days.length === 5 && form.work_days.includes(1) && !form.work_days.includes(6)
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'
                    }`}>
                    Senin - Jumat
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, work_days: [6] }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                      form.work_days.length === 1 && form.work_days.includes(6)
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-amber-400'
                    }`}>
                    Sabtu
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, work_days: [1,2,3,4,5,6,7] }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                      form.work_days.length === 7
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                    }`}>
                    Semua Hari
                  </button>
                </div>
                <div className="flex gap-1.5">
                  {[1,2,3,4,5,6,7].map(d => (
                    <button key={d} type="button" onClick={() => toggleDay(d)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${form.work_days.includes(d) ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {DAY_NAMES[d]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Batal</button>
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
