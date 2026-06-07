'use client'

import { useState, useRef as useReactRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Department, Shift } from '@/types'

interface Employee extends Profile {
  face_data?: unknown
  face_photo_url?: string | null
  has_face_registration?: boolean
}

interface Props {
  employees: Employee[]
  departments: Department[]
  shifts: Shift[]
  positions: { name: string; label: string }[]
  orgId: string
}

// Lazy face photo loader — fetches via API proxy (private, short-lived URL)
function FacePhotoButton({ empId, name, onOpen }: { empId: string; name: string; onOpen: (v: { url: string; name: string }) => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (url) { onOpen({ url, name }); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/face-photo?user_id=${empId}`)
      const data = await res.json()
      if (data.url) {
        setUrl(data.url)
        onOpen({ url: data.url, name })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={load}
      disabled={loading}
      className="w-14 h-14 rounded-xl overflow-hidden border-2 border-green-400 hover:border-green-600 transition-all cursor-pointer shrink-0 shadow-sm hover:shadow-md disabled:opacity-50 flex items-center justify-center bg-green-50"
      title="Klik untuk melihat foto wajah"
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      )}
    </button>
  )
}

const POSITION_COLORS = [
  'bg-red-100 text-red-700',
  'bg-indigo-100 text-indigo-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-purple-100 text-purple-700',
]

export default function EmployeesClient({ employees, departments, shifts, positions, orgId }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const resetPage = () => setPage(1)
  const actionRefs = useReactRef<Record<string, HTMLButtonElement | null>>({})
  const [faceModal, setFaceModal] = useState<{ url: string; name: string } | null>(null)
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 25
  const [showModal, setShowModal] = useState(false)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdInfo, setCreatedInfo] = useState<{ name: string; username: string; email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [resetModal, setResetModal] = useState<{ emp: Employee; password: string } | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [resetCopied, setResetCopied] = useState(false)

  // Face registration modal state
  const [regFaceModal, setRegFaceModal] = useState<Employee | null>(null)
  const regVideoRef = useReactRef<HTMLVideoElement>(null)
  const regCanvasRef = useReactRef<HTMLCanvasElement>(null)
  const regStreamRef = useReactRef<MediaStream | null>(null)
  const [regCameraReady, setRegCameraReady] = useState(false)
  const [regPhoto, setRegPhoto] = useState<string | null>(null)
  const [regProcessing, setRegProcessing] = useState(false)
  const [regComplete, setRegComplete] = useState(false)
  const [regError, setRegError] = useState('')
  const [regModelsLoading, setRegModelsLoading] = useState(false)
  const [regModelsReady, setRegModelsReady] = useState(false)

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  const copyLoginInfo = (info: { name: string; username: string; email: string; password: string }) => {
    const text = `Info Login AbsenKu\nNama: ${info.name}\nUsername: ${info.username}\nPassword: ${info.password}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const [form, setForm] = useState({
    full_name: '', username: '', employee_id: '', department_id: '',
    position: '', phone: '', join_date: '', password: '', division: '',
  })

  const [salaryForm, setSalaryForm] = useState({ base_salary: '', effective_date: new Date().toISOString().slice(0, 10) })
  const [currentSalary, setCurrentSalary] = useState<number | null>(null)
  const [loadingSalary, setLoadingSalary] = useState(false)

  const filtered = employees.filter(e => {
    const matchSearch = !search ||
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.username?.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
      e.position?.toLowerCase().includes(search.toLowerCase())
    const matchDept = !filterDept || e.department_id === filterDept
    const matchStatus = !filterStatus || (filterStatus === 'active' ? e.is_active : !e.is_active)
    return matchSearch && matchDept && matchStatus
  })

  // Pagination
  const totalPages = Math.ceil(filtered.length / perPage)
  const safePage = Math.min(page, totalPages || 1)
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  const openAdd = () => {
    setEditEmployee(null)
    setForm({ full_name: '', username: '', employee_id: '', department_id: '', position: '', phone: '', join_date: '', password: '', division: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = async (emp: Employee) => {
    setEditEmployee(emp)
    setForm({ full_name: emp.full_name, username: emp.username ?? '', employee_id: emp.employee_id ?? '', department_id: emp.department_id ?? '', position: emp.position ?? '', phone: emp.phone ?? '', join_date: emp.join_date ?? '', password: '', division: emp.division ?? '' })
    setSalaryForm({ base_salary: '', effective_date: new Date().toISOString().slice(0, 10) })
    setCurrentSalary(null)
    setError('')
    setShowModal(true)

    // Fetch gaji aktif saat ini
    setLoadingSalary(true)
    const { data } = await supabase
      .from('employee_salaries')
      .select('base_salary, effective_date')
      .eq('user_id', emp.id)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    setCurrentSalary(data?.base_salary ?? null)
    setLoadingSalary(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      if (form.position === 'kepala_ruangan' && !form.department_id) {
        throw new Error('Kepala ruangan wajib memilih ruangan/departemen')
      }
      if (editEmployee) {
        const { error: profileError } = await supabase.from('profiles').update({
          full_name: form.full_name,
          username: form.username,
          employee_id: form.employee_id || null,
          department_id: form.department_id || null,
          position: form.position || null,
          phone: form.phone || null,
          join_date: form.join_date || null,
          division: form.division || null,
        }).eq('id', editEmployee.id)
        if (profileError) throw profileError

        if (form.password) {
          const { error: pwError } = await supabase.functions.invoke('update-employee-password', {
            body: { user_id: editEmployee.id, password: form.password },
          })
          if (pwError) throw pwError
        }

        // Simpan gaji baru jika diisi
        const newSalary = parseFloat(salaryForm.base_salary)
        if (!isNaN(newSalary) && newSalary > 0 && newSalary !== currentSalary) {
          const { error: salaryError } = await supabase.from('employee_salaries').insert({
            user_id: editEmployee.id,
            base_salary: newSalary,
            effective_date: salaryForm.effective_date || new Date().toISOString().slice(0, 10),
          })
          if (salaryError) throw salaryError
        }
      } else {
        if (!form.username) throw new Error('Username wajib diisi')
        const finalPassword = form.password || generatePassword()
        const { data: orgData } = await supabase.from('organizations').select('company_code').eq('id', orgId).single()
        const email = `${form.username}_${orgData?.company_code}@absenku.app`.toLowerCase()
        const { data, error: createError } = await supabase.functions.invoke('create-employee', {
          body: {
            org_id: orgId, email, password: finalPassword,
            full_name: form.full_name, username: form.username,
            employee_id: form.employee_id || null,
            department_id: form.department_id || null,
          },
        })
        if (createError) throw createError
        if (data?.error) throw new Error(data.error)
        // Set division & jabatan jika dipilih
        if (data?.user_id) {
          const updates: Record<string, string> = {}
          if (form.division) updates.division = form.division
          if (form.position) updates.position = form.position
          if (Object.keys(updates).length > 0) {
            await supabase.from('profiles').update(updates).eq('id', data.user_id)
          }
        }
        setShowModal(false)
        setCreatedInfo({ name: form.full_name, username: form.username, email, password: finalPassword })
        router.refresh()
        return
      }
      setShowModal(false)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setIsLoading(false)
    }
  }

  const openResetPassword = (emp: Employee) => {
    setResetModal({ emp, password: generatePassword() })
    setResetDone(false)
    setResetCopied(false)
  }

  const handleResetPassword = async () => {
    if (!resetModal) return
    setResetLoading(true)
    try {
      const { error: pwError } = await supabase.functions.invoke('update-employee-password', {
        body: { user_id: resetModal.emp.id, password: resetModal.password },
      })
      if (pwError) throw pwError
      setResetDone(true)
    } catch {
      alert('Gagal mereset password. Coba lagi.')
    } finally {
      setResetLoading(false)
    }
  }

  const copyResetInfo = () => {
    if (!resetModal) return
    const text = `Info Login AbsenKu\nNama: ${resetModal.emp.full_name}\nUsername: ${resetModal.emp.username}\nPassword Baru: ${resetModal.password}`
    navigator.clipboard.writeText(text)
    setResetCopied(true)
    setTimeout(() => setResetCopied(false), 2000)
  }

  const [deactivateModal, setDeactivateModal] = useState<Employee | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const toggleActive = (emp: Employee) => {
    if (emp.is_active) {
      setDeactivateModal(emp)
    } else {
      supabase.from('profiles').update({ is_active: true }).eq('id', emp.id).then(() => router.refresh())
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateModal) return
    setDeactivating(true)
    try {
      // 1. Delete face registration (biometric data cleanup)
      const { data: faceReg } = await supabase
        .from('face_registrations')
        .select('face_photo_url')
        .eq('user_id', deactivateModal.id)
        .maybeSingle()

      if (faceReg) {
        await supabase.from('face_registrations').delete().eq('user_id', deactivateModal.id)

        // 2. Remove face photo from storage if exists
        if (faceReg.face_photo_url) {
          try {
            const url = new URL(faceReg.face_photo_url)
            const segments = url.pathname.split('/')
            const objIdx = segments.indexOf('object')
            if (objIdx >= 0 && segments.length > objIdx + 2) {
              const filePath = segments.slice(objIdx + 2).join('/')
              await supabase.storage.from('attendance-photos').remove([filePath])
            }
          } catch { /* non-critical */ }
        }
      }

      // 3. Deactivate profile
      await supabase.from('profiles').update({ is_active: false }).eq('id', deactivateModal.id)
      setDeactivateModal(null)
      router.refresh()
    } catch {
      alert('Gagal menonaktifkan karyawan. Coba lagi.')
    } finally {
      setDeactivating(false)
    }
  }

  const activeCount = employees.filter(e => e.is_active).length

  // --- Face Registration Functions ---
  const openFaceRegistration = (emp: Employee) => {
    setRegFaceModal(emp)
    setRegPhoto(null)
    setRegComplete(false)
    setRegError('')
    setRegCameraReady(false)
    setRegProcessing(false)
    setOpenDropdown(null)
  }

  const closeFaceRegistration = () => {
    // Stop camera
    if (regStreamRef.current) {
      regStreamRef.current.getTracks().forEach(t => t.stop())
      regStreamRef.current = null
    }
    setRegFaceModal(null)
    setRegPhoto(null)
    setRegComplete(false)
    setRegError('')
    setRegCameraReady(false)
    setRegProcessing(false)
    setRegModelsReady(false)
    setRegModelsLoading(false)
  }

  const startRegCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      regStreamRef.current = stream
      if (regVideoRef.current) {
        regVideoRef.current.srcObject = stream
        await regVideoRef.current.play()
        setRegCameraReady(true)
      }
    } catch {
      setRegError('Gagal mengakses kamera. Pastikan izin kamera diaktifkan.')
    }
  }

  // Auto-start camera when modal opens
  useEffect(() => {
    if (regFaceModal && !regPhoto && !regComplete) {
      // Load models
      if (!regModelsReady && !regModelsLoading) {
        setRegModelsLoading(true)
        import('@/lib/face-detect').then(({ loadModels }) =>
          loadModels()
            .then(() => setRegModelsReady(true))
            .catch(() => setRegError('Gagal memuat model deteksi wajah'))
            .finally(() => setRegModelsLoading(false))
        )
      }
      startRegCamera()
    }
    if (!regFaceModal) {
      if (regStreamRef.current) {
        regStreamRef.current.getTracks().forEach(t => t.stop())
        regStreamRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regFaceModal, regPhoto, regComplete])

  const captureRegPhoto = async () => {
    const video = regVideoRef.current
    const canvas = regCanvasRef.current
    if (!video || !canvas) return

    // Capture frame
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setRegPhoto(dataUrl)

    // Stop camera
    if (regStreamRef.current) {
      regStreamRef.current.getTracks().forEach(t => t.stop())
      regStreamRef.current = null
    }
    setRegCameraReady(false)

    // Detect face and register
    setRegProcessing(true)
    setRegError('')
    try {
      const { detectAndExtract } = await import('@/lib/face-detect')
      const faceResult = await detectAndExtract(canvas)

      if (!faceResult) {
        setRegError('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas dan pencahayaan cukup.')
        setRegProcessing(false)
        return
      }

      // Send to server
      const base64 = dataUrl.split(',')[1]
      const res = await fetch('/api/register-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: regFaceModal!.id,
          photo_base64: base64,
          descriptor: faceResult.descriptor,
          geometry: faceResult.geometry,
        }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Gagal mendaftarkan wajah')

      setRegComplete(true)
      router.refresh()
    } catch (e: unknown) {
      setRegError(e instanceof Error ? e.message : 'Gagal mendaftarkan wajah')
    } finally {
      setRegProcessing(false)
    }
  }

  const retryRegPhoto = () => {
    setRegPhoto(null)
    setRegError('')
    setRegComplete(false)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Data Karyawan</h1>
          <p className="text-sm text-gray-400 mt-0.5">{activeCount} aktif dari {employees.length} karyawan</p>
        </div>
        <button onClick={openAdd}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
          + Tambah Karyawan
        </button>
      </div>

      {/* Filter & Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex flex-wrap gap-3">
        <input type="text" placeholder="Cari nama, username, ID, jabatan..."
          value={search} onChange={e => { setSearch(e.target.value); resetPage() }}
          className="flex-1 min-w-48 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        <select value={filterDept} onChange={e => { setFilterDept(e.target.value); resetPage() }}
          className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
          <option value="">Semua Departemen</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); resetPage() }}
          className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Karyawan', 'Username / ID', 'Departemen', 'Bagian', 'Jabatan', 'Wajah', 'Foto Wajah', 'Bergabung', 'Status', 'Aksi'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-5 py-3.5 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-gray-400">
                    {search || filterDept || filterStatus ? 'Karyawan tidak ditemukan' : 'Belum ada karyawan. Klik "+ Tambah Karyawan".'}
                  </td>
                </tr>
              ) : paged.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold text-sm shrink-0">
                        {emp.full_name[0]?.toUpperCase()}
                      </div>
                      <p className="font-medium text-sm text-gray-900">{emp.full_name}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-gray-700">{emp.username ?? '-'}</p>
                    <p className="text-xs text-gray-400">{emp.employee_id ?? 'No ID'}</p>
                  </td>
                  <td className="px-5 py-4">
                    {(() => {
                      const deptName = (emp.departments as { name: string } | null)?.name
                      if (!deptName) return <span className="text-xs text-gray-300">Belum ditentukan</span>
                      return (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-50 text-teal-700 border border-teal-100">
                          📍 {deptName}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-5 py-4">
                    {(() => {
                      const div = emp.division
                      if (!div) return <span className="text-xs text-gray-300">-</span>
                      const map: Record<string, { label: string; cls: string }> = {
                        umum:        { label: 'Umum',        cls: 'bg-blue-100 text-blue-700' },
                        penunjang:   { label: 'Penunjang',   cls: 'bg-purple-100 text-purple-700' },
                        keperawatan: { label: 'Keperawatan', cls: 'bg-pink-100 text-pink-700' },
                        medis:       { label: 'Medis',       cls: 'bg-teal-100 text-teal-700' },
                      }
                      const d = map[div] ?? { label: div, cls: 'bg-gray-100 text-gray-600' }
                      return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.cls}`}>{d.label}</span>
                    })()}
                  </td>
                  <td className="px-5 py-4">
                    {(() => {
                      if (!emp.position) return <span className="text-xs text-gray-300">-</span>
                      const posEntry = positions.find(p => p.name === emp.position)
                      const posLabel = posEntry?.label ?? emp.position
                      const posIdx = positions.findIndex(p => p.name === emp.position)
                      const cls = posIdx >= 0 ? POSITION_COLORS[posIdx % POSITION_COLORS.length] : 'bg-gray-100 text-gray-600'
                      return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{posLabel}</span>
                    })()}
                  </td>
                  <td className="px-5 py-4">
                    {(() => {
                      if (emp.has_face_registration) {
                        return (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Terdaftar</span>
                        )
                      }
                      return <span className="text-xs text-gray-400">—</span>
                    })()}
                  </td>
                  <td className="px-5 py-4">
                    {(() => {
                      const hasPath = emp.face_photo_url
                      if (hasPath) {
                        return <FacePhotoButton empId={emp.id} name={emp.full_name} onOpen={setFaceModal} />
                      }
                      return <span className="text-xs text-gray-400">Belum ada</span>
                    })()}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {emp.join_date ? new Date(emp.join_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${emp.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {emp.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div>
                      <button
                        ref={el => { if (el) actionRefs.current[emp.id] = el }}
                        onClick={() => setOpenDropdown(openDropdown === emp.id ? null : emp.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Menampilkan {((safePage - 1) * perPage) + 1}–{Math.min(safePage * perPage, filtered.length)} dari {filtered.length} karyawan
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              {(() => {
                const pages: number[] = []
                const maxVisible = 5
                let start = Math.max(1, safePage - Math.floor(maxVisible / 2))
                const end = Math.min(totalPages, start + maxVisible - 1)
                start = Math.max(1, end - maxVisible + 1)
                for (let i = start; i <= end; i++) pages.push(i)
                return pages.map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                      p === safePage ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                ))
              })()}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Dropdown Portal */}
      {openDropdown && (() => {
        const btn = actionRefs.current[openDropdown]
        const emp = employees.find(e => e.id === openDropdown)
        if (!btn || !emp) return null
        const rect = btn.getBoundingClientRect()
        const menuH = 160
        const openUp = rect.bottom + menuH > window.innerHeight
        const top = openUp ? rect.top - menuH : rect.bottom
        const left = rect.right - 176
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
            <div className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 w-44" style={{ top, left }}>
              <button
                onClick={() => { openEdit(emp); setOpenDropdown(null) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="text-base">✏️</span> Edit Profil
              </button>
              <button
                onClick={() => { openFaceRegistration(emp); setOpenDropdown(null) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-teal-700 hover:bg-teal-50 transition-colors"
              >
                <span className="text-base">📷</span> {emp.has_face_registration ? 'Perbarui Wajah' : 'Daftar Wajah'}
              </button>
              <button
                onClick={() => { openResetPassword(emp); setOpenDropdown(null) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
              >
                <span className="text-base">🔑</span> Reset Password
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={() => { toggleActive(emp); setOpenDropdown(null) }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${emp.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
              >
                <span className="text-base">{emp.is_active ? '🚫' : '✅'}</span>
                {emp.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            </div>
          </>
        )
      })()}

      {/* Modal */}
      {/* Modal Info Login Berhasil */}
      {createdInfo && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center border-b border-gray-100">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">✅</div>
              <h2 className="font-bold text-gray-800 text-lg">Karyawan Berhasil Ditambahkan!</h2>
              <p className="text-sm text-gray-400 mt-1">Bagikan info login ini ke karyawan</p>
            </div>

            <div className="p-6 space-y-3">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Nama</span>
                  <span className="font-semibold text-gray-800">{createdInfo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Username</span>
                  <span className="font-mono font-semibold text-gray-800">{createdInfo.username}</span>
                </div>
                <div className="border-t border-gray-200 pt-2.5 flex justify-between items-center">
                  <span className="text-gray-500">Password</span>
                  <span className="font-mono font-bold text-teal-700 text-base tracking-wider">{createdInfo.password}</span>
                </div>
              </div>

              <p className="text-xs text-gray-400 text-center">Password hanya ditampilkan sekali. Segera bagikan ke karyawan.</p>

              <button
                onClick={() => copyLoginInfo(createdInfo)}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'}`}
              >
                {copied ? '✓ Tersalin!' : '📋 Salin Info Login'}
              </button>

              <button
                onClick={() => setCreatedInfo(null)}
                className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl">🔑</div>
                <div>
                  <h2 className="font-bold text-gray-800">Reset Password</h2>
                  <p className="text-xs text-gray-400">{resetModal.emp.full_name}</p>
                </div>
              </div>
              <button
                onClick={() => setResetModal(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >×</button>
            </div>

            <div className="p-6 space-y-4">
              {!resetDone ? (
                <>
                  <p className="text-sm text-gray-500">
                    Password baru untuk <span className="font-semibold text-gray-700">@{resetModal.emp.username}</span> akan di-reset. Pastikan Anda menyimpan atau menyalin password baru sebelum menutup.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Password Baru</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={resetModal.password}
                        onChange={e => setResetModal(r => r ? { ...r, password: e.target.value } : r)}
                        minLength={6}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setResetModal(r => r ? { ...r, password: generatePassword() } : r)}
                        title="Generate ulang"
                        className="px-3 py-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors text-lg"
                      >
                        🔄
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Bisa diubah manual atau klik 🔄 untuk generate ulang</p>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
                    ⚠️ Karyawan harus menggunakan password baru ini untuk login berikutnya.
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setResetModal(null)}
                      className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={resetLoading || resetModal.password.length < 6}
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                      {resetLoading ? 'Mereset...' : 'Reset Password'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center py-2">
                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">✅</div>
                    <h3 className="font-bold text-gray-800">Password Berhasil Direset!</h3>
                    <p className="text-sm text-gray-400 mt-1">Bagikan info login berikut ke karyawan</p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Nama</span>
                      <span className="font-semibold text-gray-800">{resetModal.emp.full_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Username</span>
                      <span className="font-mono font-semibold text-gray-800">@{resetModal.emp.username}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2.5 flex justify-between items-center">
                      <span className="text-gray-500">Password Baru</span>
                      <span className="font-mono font-bold text-amber-600 text-base tracking-wider">{resetModal.password}</span>
                    </div>
                  </div>

                  <button
                    onClick={copyResetInfo}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${resetCopied ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}
                  >
                    {resetCopied ? '✓ Tersalin!' : '📋 Salin Info Login'}
                  </button>

                  <button
                    onClick={() => setResetModal(null)}
                    className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50"
                  >
                    Selesai
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-800">
                {editEmployee ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
              )}

              {/* Info banner hanya saat tambah */}
              {!editEmployee && (
                <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 text-sm text-teal-700">
                  <p className="font-semibold mb-0.5">📱 Data minimal untuk login</p>
                  <p className="text-xs text-teal-600">Karyawan dapat melengkapi profil lengkap (foto, alamat, dll) melalui aplikasi mobile setelah login.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap *</label>
                  <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Nama lengkap karyawan"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Username *</label>
                  <input required={!editEmployee} value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                    placeholder="budi123"
                    disabled={!!editEmployee}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-gray-50 disabled:text-gray-400" />
                  {!editEmployee && <p className="text-xs text-gray-400 mt-1">Dipakai untuk login ke mobile app</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ID Karyawan</label>
                  <input value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}
                    placeholder="NIP / NIK (opsional)"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password{' '}
                    <span className="text-gray-400 font-normal">
                      {editEmployee ? '(kosongkan jika tidak diubah)' : '(kosongkan untuk auto-generate)'}
                    </span>
                  </label>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    minLength={6} placeholder={editEmployee ? '••••••••' : 'Biarkan kosong untuk auto-generate'}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  {!editEmployee && (
                    <p className="text-xs text-teal-600 mt-1">🔐 Jika dikosongkan, sistem akan membuat password acak yang aman</p>
                  )}
                </div>

                <div className={form.position === 'kepala_ruangan' ? 'ring-2 ring-amber-300 rounded-xl p-3 bg-amber-50' : ''}>
                  <label className={`block text-sm font-medium mb-1.5 ${form.position === 'kepala_ruangan' ? 'text-amber-700' : 'text-gray-700'}`}>
                    {form.position === 'kepala_ruangan' ? '📍 Ruangan (Wajib)' : 'Departemen'}
                  </label>
                  <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}
                    className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white ${
                      form.position === 'kepala_ruangan'
                        ? 'border-amber-300 focus:ring-amber-400'
                        : 'border-gray-200 focus:ring-teal-400'
                    }`}>
                    <option value="">{form.position === 'kepala_ruangan' ? '⚠️ Pilih ruangan...' : 'Pilih departemen (opsional)'}</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {form.position === 'kepala_ruangan' && !form.department_id && (
                    <p className="text-xs text-amber-600 mt-1 font-medium">Kepala ruangan wajib memilih ruangan yang dikelola</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bagian / Divisi</label>
                  <select value={form.division} onChange={e => setForm({ ...form, division: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                    <option value="">Pilih bagian</option>
                    <option value="umum">Bagian Umum</option>
                    <option value="penunjang">Bagian Penunjang</option>
                    <option value="keperawatan">Bagian Keperawatan</option>
                    <option value="medis">Bagian Medis</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Menentukan alur persetujuan cuti karyawan</p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Jabatan</label>
                  <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                    <option value="">Pilih jabatan (opsional)</option>
                    {positions.map(p => (
                      <option key={p.name} value={p.name}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {/* Field tambahan hanya untuk edit */}
                {editEmployee && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">No. HP</label>
                      <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                        placeholder="08xxxxxxxxxx"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Bergabung</label>
                      <input type="date" value={form.join_date} onChange={e => setForm({ ...form, join_date: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    </div>

                    {/* Foto Wajah Terdaftar */}
                    <div className="col-span-2 border-t border-gray-100 pt-4 mt-1">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-gray-700">Foto Wajah Terdaftar</label>
                        {(() => {
                          if (editEmployee.has_face_registration) {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Terverifikasi
                              </span>
                            )
                          }
                          return (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" /> Belum terdaftar
                            </span>
                          )
                        })()}
                      </div>
                      {(() => {
                        const hasPhoto = editEmployee.face_photo_url
                        if (hasPhoto) {
                          return (
                            <div className="flex items-center gap-4">
                              <FacePhotoButton empId={editEmployee.id} name={editEmployee.full_name} onOpen={setFaceModal} />
                              <div className="text-xs text-gray-500 space-y-1">
                                <p>Foto wajah terdaftar melalui aplikasi mobile.</p>
                                <p className="text-gray-400">Klik foto untuk memperbesar.</p>
                              </div>
                            </div>
                          )
                        }
                        if (editEmployee.has_face_registration) {
                          return (
                            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700">
                              Data wajah terdaftar, tetapi foto tidak tersedia. Foto akan otomatis tersimpan saat karyawan melakukan absensi web.
                            </div>
                          )
                        }
                        return (
                          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-500">
                            Karyawan ini belum mendaftarkan wajah. Unduh aplikasi mobile AbsenKu untuk mendaftarkan wajah.
                          </div>
                        )
                      })()}
                    </div>

                    {/* Gaji Pokok */}
                    <div className="col-span-2 border-t border-gray-100 pt-4 mt-1">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-700">💰 Gaji Pokok</label>
                        {loadingSalary ? (
                          <span className="text-xs text-gray-400">Memuat...</span>
                        ) : currentSalary !== null ? (
                          <span className="text-xs text-gray-500">
                            Saat ini: <span className="font-semibold text-gray-700">
                              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(currentSalary)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600">Belum ada data gaji</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Nominal Baru (Rp)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">Rp</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={salaryForm.base_salary
                                ? Number(salaryForm.base_salary.replace(/\D/g, '')).toLocaleString('id-ID')
                                : ''}
                              onChange={e => {
                                const raw = e.target.value.replace(/\D/g, '')
                                setSalaryForm(s => ({ ...s, base_salary: raw }))
                              }}
                              placeholder={currentSalary !== null ? 'Isi untuk ubah gaji' : '0'}
                              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Berlaku Mulai</label>
                          <input
                            type="date"
                            value={salaryForm.effective_date}
                            onChange={e => setSalaryForm(s => ({ ...s, effective_date: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">Kosongkan jika gaji tidak berubah. Setiap perubahan tersimpan sebagai histori.</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">
                  Batal
                </button>
                <button type="submit" disabled={isLoading}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold">
                  {isLoading ? 'Menyimpan...' : editEmployee ? 'Simpan Perubahan' : 'Tambah Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivation Confirmation Modal */}
      {deactivateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center border-b border-gray-100">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">⚠️</div>
              <h2 className="font-bold text-gray-800 text-lg">Nonaktifkan Karyawan?</h2>
              <p className="text-sm text-gray-600 mt-1 font-medium">{deactivateModal.full_name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 space-y-1">
                <p className="font-semibold">Data biometrik wajah akan dihapus permanen.</p>
                <p className="text-xs text-red-600">Deskriptor wajah dan foto referensi tidak dapat dikembalikan. Jika karyawan diaktifkan kembali, mereka harus mendaftar ulang wajah.</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeactivateModal(null)}
                  disabled={deactivating}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={deactivating}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  {deactivating ? 'Memproses...' : 'Ya, Nonaktifkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Face Photo Modal */}
      {faceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setFaceModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-gray-800">{faceModal.name}</p>
                <p className="text-xs text-gray-400">Foto Wajah Terdaftar</p>
              </div>
              <button onClick={() => setFaceModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="bg-gray-900 flex items-center justify-center p-6">
              <img src={faceModal.url} alt="Foto wajah" className="w-56 h-56 object-cover rounded-2xl border-4 border-green-400 shadow-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Face Registration Modal */}
      {regFaceModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center text-xl">📷</div>
                <div>
                  <h2 className="font-bold text-gray-800">
                    {regFaceModal.has_face_registration ? 'Perbarui Data Wajah' : 'Daftarkan Wajah'}
                  </h2>
                  <p className="text-xs text-gray-400">{regFaceModal.full_name}</p>
                </div>
              </div>
              <button onClick={closeFaceRegistration} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {regFaceModal.has_face_registration && !regComplete && !regPhoto && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-xs text-amber-700">
                  ℹ️ Data wajah lama akan digantikan dengan data baru.
                </div>
              )}

              {/* Camera / Photo area */}
              <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-[4/3]">
                {/* Video feed */}
                {!regPhoto && (
                  <video
                    ref={regVideoRef}
                    className={`w-full h-full object-cover ${!regCameraReady ? 'hidden' : ''}`}
                    playsInline
                    muted
                  />
                )}

                {/* Captured photo */}
                {regPhoto && (
                  <img src={regPhoto} alt="Foto" className="w-full h-full object-cover" />
                )}

                {/* Camera not ready */}
                {!regPhoto && !regCameraReady && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-white/40">
                      <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                      <p className="text-xs">Membuka kamera...</p>
                    </div>
                  </div>
                )}

                {/* Face guide oval */}
                {!regPhoto && regCameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-40 h-52 border-2 border-white/30 rounded-full border-dashed" />
                  </div>
                )}

                {/* Processing overlay */}
                {regPhoto && regProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full border-4 border-teal-400 border-t-transparent animate-spin" />
                      <p className="text-white text-sm font-medium">Mendeteksi & menyimpan wajah...</p>
                    </div>
                  </div>
                )}

                {/* Success overlay */}
                {regPhoto && regComplete && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                      <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              <canvas ref={regCanvasRef} className="hidden" />

              {/* Model loading */}
              {regModelsLoading && (
                <div className="text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                  Memuat model deteksi wajah...
                </div>
              )}

              {/* Error */}
              {regError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm text-center">
                  {regError}
                </div>
              )}

              {/* Success message */}
              {regComplete && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-center">
                  <p className="font-semibold">✅ Data wajah berhasil disimpan!</p>
                  <p className="text-xs text-green-600 mt-1">
                    {regFaceModal.full_name} sekarang bisa melakukan absensi Face ID.
                  </p>
                </div>
              )}

              {/* Actions */}
              {!regPhoto && regCameraReady && !regModelsLoading && (
                <button
                  onClick={captureRegPhoto}
                  disabled={!regModelsReady}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  {regModelsReady ? 'Ambil Foto' : 'Menyiapkan...'}
                </button>
              )}

              {regPhoto && !regComplete && regError && (
                <div className="flex gap-3">
                  <button
                    onClick={retryRegPhoto}
                    className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-1.5 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                    </svg>
                    Coba Lagi
                  </button>
                  <button
                    onClick={closeFaceRegistration}
                    className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-sm"
                  >
                    Batal
                  </button>
                </div>
              )}

              {regComplete && (
                <button
                  onClick={closeFaceRegistration}
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors text-sm"
                >
                  Selesai
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
