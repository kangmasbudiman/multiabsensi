'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  token: string
  valid: boolean
  reason: 'not_found' | 'revoked' | 'expired' | null
  orgName: string
  departments: { id: string; name: string }[]
  positions: { name: string; label: string }[]
  expiresAt: string | null
}

const DIVISIONS = [
  { name: '', label: 'Tidak ada' },
  { name: 'umum', label: 'Bagian Umum' },
  { name: 'penunjang', label: 'Bagian Penunjang' },
  { name: 'keperawatan', label: 'Bagian Keperawatan' },
  { name: 'medis', label: 'Bagian Medis' },
]

export default function RegisterClient({ token, valid, reason, orgName, departments, positions, expiresAt }: Props) {
  const [step, setStep] = useState<'welcome' | 'form' | 'camera' | 'success' | 'error'>(valid ? 'welcome' : 'error')
  const [form, setForm] = useState({
    full_name: '', employee_id: '', department_id: '',
    division: '', position: '', phone: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [modelsReady, setModelsReady] = useState(false)
  const [detecting, setDetecting] = useState(false)

  // Success state
  const [username, setUsername] = useState('')

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraReady(true)
      }
    } catch {
      setError('Gagal mengakses kamera. Pastikan izin kamera diaktifkan dan menggunakan HTTPS.')
    }
  }

  // Load face-api models + start camera when entering camera step
  useEffect(() => {
    if (step !== 'camera') return
    let cancelled = false
    import('@/lib/face-detect')
      .then(({ loadModels }) => loadModels())
      .then(() => { if (!cancelled) setModelsReady(true) })
      .catch(() => { if (!cancelled) setError('Gagal memuat model deteksi wajah') })
    startCamera()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const captureAndSubmit = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    setError('')
    setDetecting(true)

    try {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      setCapturedPhoto(dataUrl)

      const { detectAndExtract } = await import('@/lib/face-detect')
      const faceResult = await detectAndExtract(canvas)

      if (!faceResult) {
        setError('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas dengan pencahayaan cukup.')
        setDetecting(false)
        setCapturedPhoto(null)
        return
      }

      setSubmitting(true)
      const base64 = dataUrl.split(',')[1]
      const res = await fetch('/api/public-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          ...form,
          photo_base64: base64,
          descriptor: faceResult.descriptor,
          geometry: faceResult.geometry,
        }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Gagal mendaftarkan')

      setUsername(data.username || '')
      setStep('success')

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mendaftarkan wajah')
      setCapturedPhoto(null)
    } finally {
      setDetecting(false)
      setSubmitting(false)
    }
  }

  // ============ ERROR STATE ============
  if (!valid) {
    const messages: Record<string, { title: string; desc: string }> = {
      not_found: { title: 'Link Tidak Valid', desc: 'Link pendaftaran tidak ditemukan. Periksa kembali link yang Anda terima.' },
      revoked: { title: 'Link Dinonaktifkan', desc: 'Link pendaftaran ini sudah dinonaktifkan oleh admin. Hubungi admin untuk link baru.' },
      expired: { title: 'Link Kedaluwarsa', desc: 'Masa berlaku link ini sudah habis. Hubungi admin untuk mendapatkan link baru.' },
    }
    const msg = reason ? messages[reason] : messages.not_found

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">⚠️</div>
            <h1 className="text-lg font-bold text-gray-800">{msg.title}</h1>
            <p className="text-sm text-gray-500 mt-2">{msg.desc}</p>
          </div>
          <div className="bg-gray-50 px-6 py-4 text-center">
            <p className="text-xs text-gray-400">{orgName}</p>
          </div>
        </div>
      </div>
    )
  }

  // ============ WELCOME STEP ============
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
          <div className="bg-teal-600 px-6 py-8 text-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-3xl flex items-center justify-center text-5xl mx-auto mb-4">👋</div>
            <h1 className="text-xl font-bold text-white">Selamat Datang!</h1>
            <p className="text-teal-100 text-sm mt-1">Pendaftaran Karyawan {orgName}</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center text-xs font-bold text-teal-700 shrink-0">1</div>
                <p>Isi data diri Anda (nama, NIK, departemen, jabatan)</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center text-xs font-bold text-teal-700 shrink-0">2</div>
                <p>Ambil foto wajah untuk absensi Face ID</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center text-xs font-bold text-teal-700 shrink-0">3</div>
                <p>Selesai — Anda siap untuk absensi</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
              {expiresAt ? (
                <>⏰ Link berlaku sampai <span className="font-semibold">{new Date(expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></>
              ) : (
                <>✨ Link aktif tanpa batas waktu — bisa dipakai banyak karyawan</>
              )}
            </div>
            <button
              onClick={() => setStep('form')}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors"
            >
              Mulai Pendaftaran
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============ FORM STEP ============
  if (step === 'form') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
        <div className="max-w-md mx-auto pt-6 pb-12">
          <button onClick={() => setStep('welcome')} className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">
            ← Kembali
          </button>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h1 className="text-lg font-bold text-gray-800">Data Diri</h1>
              <p className="text-xs text-gray-400 mt-0.5">{orgName}</p>
            </div>
            <form
              className="p-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!form.full_name.trim()) {
                  setError('Nama lengkap wajib diisi')
                  return
                }
                setError('')
                setStep('camera')
              }}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap *</label>
                <input
                  required
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Nama sesuai KTP"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">NIK / ID Karyawan</label>
                <input
                  value={form.employee_id}
                  onChange={e => setForm({ ...form, employee_id: e.target.value })}
                  placeholder="NIP / NIK (opsional)"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Departemen</label>
                <select
                  value={form.department_id}
                  onChange={e => setForm({ ...form, department_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                >
                  <option value="">Pilih departemen (opsional)</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bagian / Divisi</label>
                <select
                  value={form.division}
                  onChange={e => setForm({ ...form, division: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                >
                  {DIVISIONS.map(d => <option key={d.name} value={d.name}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Jabatan</label>
                <select
                  value={form.position}
                  onChange={e => setForm({ ...form, position: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                >
                  <option value="">Pilih jabatan (opsional)</option>
                  {positions.map(p => <option key={p.name} value={p.name}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">No. HP</label>
                <input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm">{error}</div>
              )}
              <button
                type="submit"
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors"
              >
                Lanjut ke Pendaftaran Wajah →
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ============ CAMERA STEP ============
  if (step === 'camera') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
        <div className="max-w-md mx-auto pt-6 pb-12">
          <button onClick={() => setStep('form')} className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">
            ← Kembali
          </button>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h1 className="text-lg font-bold text-gray-800">Daftarkan Wajah</h1>
              <p className="text-xs text-gray-400 mt-0.5">Posisikan wajah di dalam area oval</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-[4/3]">
                {!capturedPhoto && (
                  <video
                    ref={videoRef}
                    className={`w-full h-full object-cover ${!cameraReady ? 'hidden' : ''}`}
                    playsInline
                    muted
                  />
                )}
                {capturedPhoto && (
                  <img src={capturedPhoto} alt="Foto" className="w-full h-full object-cover" />
                )}
                {!capturedPhoto && !cameraReady && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-white/40">
                      <p className="text-xs">Membuka kamera...</p>
                    </div>
                  </div>
                )}
                {!capturedPhoto && cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-40 h-52 border-2 border-white/40 rounded-full border-dashed" />
                  </div>
                )}
                {detecting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full border-4 border-teal-400 border-t-transparent animate-spin" />
                      <p className="text-white text-sm font-medium">Memproses...</p>
                    </div>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
              {cameraReady && !modelsReady && !error && (
                <div className="text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                  Memuat model deteksi wajah...
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm">{error}</div>
              )}
              {capturedPhoto && !error && submitting && (
                <div className="bg-teal-50 border border-teal-100 text-teal-700 px-4 py-2.5 rounded-xl text-sm text-center">
                  Menyimpan data...
                </div>
              )}
              {!capturedPhoto && cameraReady && (
                <button
                  onClick={captureAndSubmit}
                  disabled={!modelsReady || detecting}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  {modelsReady ? 'Ambil Foto & Daftarkan' : 'Menyiapkan...'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============ SUCCESS STEP ============
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-800">Pendaftaran Berhasil!</h1>
          <p className="text-sm text-gray-500 mt-1">Selamat datang di {orgName}</p>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 text-sm text-teal-700">
            <p className="font-semibold mb-1">🎉 Anda siap untuk absensi</p>
            <p className="text-xs text-teal-600">
              Buka aplikasi absensi, masukkan kode perusahaan, lalu hadapkan wajah ke kamera.
            </p>
          </div>
          {username && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Username (untuk mobile app)</span>
                <span className="font-mono font-semibold text-gray-800">{username}</span>
              </div>
              <p className="text-xs text-gray-400 pt-1 border-t border-gray-200">
                Simpan info ini jika nanti butuh login ke aplikasi mobile.
              </p>
            </div>
          )}
          <button
            onClick={() => window.location.href = '/absen'}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors"
          >
            Lanjut ke Absensi
          </button>
        </div>
      </div>
    </div>
  )
}
