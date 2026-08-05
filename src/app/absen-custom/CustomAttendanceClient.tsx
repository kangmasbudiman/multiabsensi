'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, Check, ArrowLeft, AlertTriangle, Calendar, Clock } from 'lucide-react'

interface Props {
  appName: string
  token: string
  orgCode: string
  orgName: string
  assignedNames?: string[]
}

type Step = 'intro' | 'scan' | 'form' | 'result'

interface IdentifiedUser {
  user_id: string
  full_name: string
  employee_id: string | null
  position: string | null
  similarity: number
}

export default function CustomAttendanceClient({ appName, token, orgCode, orgName, assignedNames = [] }: Props) {
  const [step, setStep] = useState<Step>('intro')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scanStatus, setScanStatus] = useState('Memuat...')
  const [modelsReady, setModelsReady] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [identified, setIdentified] = useState<IdentifiedUser | null>(null)
  const [photoBase64, setPhotoBase64] = useState<string>('')

  // Form state
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
  const [date, setDate] = useState(today)
  const [checkInTime, setCheckInTime] = useState('')
  const [checkOutTime, setCheckOutTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ date: string; checkIn: string | null; checkOut: string | null } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Load face-api models
  useEffect(() => {
    const load = async () => {
      try {
        const { loadModels } = await import('@/lib/face-detect')
        await loadModels()
        setModelsReady(true)
      } catch (e) {
        setError('Gagal memuat model wajah. Refresh halaman.')
      }
    }
    load()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startCamera = useCallback(async () => {
    setError('')
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      { video: { facingMode: 'user' }, audio: false },
      { video: true, audio: false },
    ]
    let lastError: unknown = null
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setCameraReady(true)
        }
        return
      } catch (e) {
        lastError = e
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
          streamRef.current = null
        }
      }
    }
    const err = lastError as { name?: string } | undefined
    if (err?.name === 'NotAllowedError') {
      setError('Izin kamera ditolak. Aktifkan izin kamera di browser.')
    } else {
      setError('Gagal mengakses kamera. Pastikan tidak ada aplikasi lain yang memakai kamera.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }, [])

  const handleStartScan = async () => {
    setStep('scan')
    setError('')
    setScanStatus('Memulai kamera...')
    await startCamera()
    if (streamRef.current) setScanStatus('Posisikan wajah di kamera, lalu klik "Identifikasi"')
  }

  const handleIdentify = async () => {
    if (!videoRef.current || !canvasRef.current || !modelsReady) return
    setLoading(true)
    setScanStatus('Mendeteksi wajah...')

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)

    try {
      const { detectSingleDescriptor } = await import('@/lib/face-detect')
      const faceResult = await detectSingleDescriptor(canvas)

      if (!faceResult) {
        setScanStatus('Wajah tidak terdeteksi. Posisikan wajah lebih jelas.')
        setLoading(false)
        return
      }

      setScanStatus('Mengidentifikasi...')
      const res = await fetch('/api/identify-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_code: orgCode,
          captured_descriptor: faceResult.descriptor,
        }),
      })
      const data = await res.json()

      if (!data.identified) {
        setScanStatus('Wajah tidak dikenali. Coba lagi atau hubungi admin.')
        setLoading(false)
        return
      }

      // Cek whitelist
      const wlRes = await fetch(`/api/custom-attendance/check?token=${encodeURIComponent(token)}&user_id=${encodeURIComponent(data.user_id)}`)
      const wlData = await wlRes.json()

      if (!wlData.allowed) {
        setError('Wajah Anda dikenali sebagai ' + data.full_name + ', tetapi tidak terdaftar dalam whitelist link ini.')
        setScanStatus('')
        setLoading(false)
        return
      }

      // Capture photo (resize to max 512px)
      const MAX_DIM = 512
      let exportCanvas = canvas
      if (canvas.width > MAX_DIM || canvas.height > MAX_DIM) {
        const scale = Math.min(MAX_DIM / canvas.width, MAX_DIM / canvas.height)
        exportCanvas = document.createElement('canvas')
        exportCanvas.width = Math.round(canvas.width * scale)
        exportCanvas.height = Math.round(canvas.height * scale)
        exportCanvas.getContext('2d')!.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height)
      }
      const photoDataUrl = exportCanvas.toDataURL('image/jpeg', 0.6)
      const base64 = photoDataUrl.split(',')[1]

      setIdentified({
        user_id: data.user_id,
        full_name: data.full_name,
        employee_id: data.employee_id,
        position: data.position,
        similarity: data.similarity,
      })
      setPhotoBase64(base64)
      stopCamera()
      setStep('form')
      setLoading(false)
    } catch (e) {
      setScanStatus('Error. Coba lagi.')
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!identified) return
    if (!checkInTime && !checkOutTime) {
      setError('Isi minimal jam masuk atau jam keluar')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/custom-attendance/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          user_id: identified.user_id,
          date,
          check_in_time: checkInTime || null,
          check_out_time: checkOutTime || null,
          photo_base64: photoBase64,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal menyimpan')

      setSuccess({
        date,
        checkIn: checkInTime || null,
        checkOut: checkOutTime || null,
      })
      setStep('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan absensi')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setIdentified(null)
    setPhotoBase64('')
    setCheckInTime('')
    setCheckOutTime('')
    setDate(today)
    setSuccess(null)
    setStep('intro')
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-teal-950 to-slate-900 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-teal-500 rounded-lg flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold">{appName[0]?.toUpperCase()}</span>
          </div>
          <h1 className="text-lg font-bold text-white">{orgName}</h1>
          <p className="text-xs text-white/60 mt-1">Absensi Custom</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 flex items-start gap-2 text-left">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-800 leading-relaxed">{error}</p>
          </div>
        )}

        {step === 'intro' && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8 text-teal-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-2">Absensi Custom</h2>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Anda akan diminta mengidentifikasi wajah, lalu mengisi tanggal & jam yang benar untuk absensi ini.
            </p>
            {assignedNames.length > 0 && (
              <div className="mb-4 px-3 py-2.5 bg-teal-50/60 border border-teal-100 rounded-xl text-left">
                <p className="text-[10px] text-teal-700 font-semibold uppercase tracking-wide mb-1.5">
                  Karyawan terdaftar ({assignedNames.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {assignedNames.slice(0, 6).map((name, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 bg-white border border-teal-200 text-teal-800 rounded-full font-medium">
                      {name}
                    </span>
                  ))}
                  {assignedNames.length > 6 && (
                    <span className="text-[11px] px-2 py-0.5 bg-white border border-gray-200 text-gray-500 rounded-full font-medium">
                      +{assignedNames.length - 6} lainnya
                    </span>
                  )}
                </div>
              </div>
            )}
            <button
              onClick={handleStartScan}
              disabled={!modelsReady}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white rounded-xl font-semibold transition-colors"
            >
              {modelsReady ? 'Mulai Identifikasi' : 'Memuat model...'}
            </button>
          </div>
        )}

        {step === 'scan' && (
          <div className="bg-white rounded-2xl shadow-2xl p-5">
            <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden mb-3">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              <canvas ref={canvasRef} className="hidden" />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center text-white/60 text-xs">
                  Memulai kamera...
                </div>
              )}
            </div>
            <p className="text-xs text-center text-gray-600 mb-3 min-h-[1.2em]">{scanStatus}</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  stopCamera()
                  setStep('intro')
                }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleIdentify}
                disabled={loading || !cameraReady || !modelsReady}
                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white rounded-xl font-semibold text-sm"
              >
                {loading ? 'Memproses...' : 'Identifikasi'}
              </button>
            </div>
          </div>
        )}

        {step === 'form' && identified && (
          <div className="bg-white rounded-2xl shadow-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              {photoBase64 && (
                <img
                  src={`data:image/jpeg;base64,${photoBase64}`}
                  alt="capture"
                  className="w-14 h-14 rounded-full object-cover border-2 border-teal-500"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{identified.full_name}</p>
                {identified.employee_id && (
                  <p className="text-[11px] text-gray-500">{identified.employee_id}</p>
                )}
                <p className="text-[10px] text-teal-600">✓ Terverifikasi</p>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mb-3">Isi Tanggal & Jam Absensi</h3>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  <Calendar className="w-3 h-3 inline mr-1" /> Tanggal
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    <Clock className="w-3 h-3 inline mr-1" /> Jam Masuk
                  </label>
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={e => setCheckInTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    <Clock className="w-3 h-3 inline mr-1" /> Jam Keluar
                  </label>
                  <input
                    type="time"
                    value={checkOutTime}
                    onChange={e => setCheckOutTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400">Boleh isi hanya jam masuk atau hanya jam keluar sesuai kebutuhan.</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={submitting}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || (!checkInTime && !checkOutTime)}
                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white rounded-xl font-semibold text-sm"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Absen'}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && success && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Absensi Tersimpan</h2>
            <p className="text-sm text-gray-500 mb-5">{identified?.full_name}</p>
            <div className="bg-teal-50 rounded-xl px-4 py-3 mb-4 space-y-1">
              <p className="text-xs text-gray-600">
                <Calendar className="w-3 h-3 inline mr-1" />
                {new Date(success.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {success.checkIn && (
                <p className="text-sm font-semibold text-teal-700">
                  Masuk: {success.checkIn} WIB
                </p>
              )}
              {success.checkOut && (
                <p className="text-sm font-semibold text-blue-700">
                  Keluar: {success.checkOut} WIB
                </p>
              )}
            </div>
            <button
              onClick={handleReset}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold"
            >
              Selesai
            </button>
          </div>
        )}

        <p className="text-center text-[10px] text-white/40 mt-6">
          Powered by {appName}
        </p>
      </div>
    </div>
  )
}
