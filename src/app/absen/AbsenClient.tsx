'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Check, Camera, ArrowLeft, Building2, ScanFace, MapPin, MapPinOff } from 'lucide-react'

type OfficeLocation = { name: string; latitude: number; longitude: number; radius_meters: number }
type Org = { id: string; name: string; address?: string | null }

type Step = 'org' | 'scan' | 'confirm' | 'result'

type IdentifiedEmployee = {
  user_id: string
  full_name: string
  employee_id: string | null
  position: string | null
  similarity: number
  photoUrl: string | null
}

// Auto-redirect result component
function AutoRedirectResult({
  type,
  time,
  employeeName,
  onRedirect,
}: {
  type: 'checkin' | 'checkout'
  time: string
  employeeName?: string
  onRedirect: () => void
}) {
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setTimeout(onRedirect, 0)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onRedirect])

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
      <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
        <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center">
          <Check className="w-8 h-8 text-white" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">
        {type === 'checkin' ? 'Check-in Berhasil!' : 'Check-out Berhasil!'}
      </h2>
      <p className="text-sm text-gray-500 mb-5">{employeeName}</p>
      <div className="bg-teal-50 rounded-xl px-6 py-4 mb-6">
        <p className="text-3xl font-bold text-teal-600">{time} WIB</p>
      </div>
      {type === 'checkin' && (
        <p className="text-xs text-gray-400 mb-4">Jangan lupa check-out sebelum pulang</p>
      )}
      <div className="space-y-2">
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-teal-500 h-full rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${((3 - countdown) / 3) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-400">
          Kembali ke pemindai wajah dalam {countdown} detik...
        </p>
        <button
          onClick={onRedirect}
          className="text-xs text-teal-600 hover:text-teal-700 font-medium"
        >
          Kembali sekarang
        </button>
      </div>
    </div>
  )
}

export default function AbsenClient({ appName = 'AbsenKu' }: { appName?: string }) {
  const [orgCode, setOrgCode] = useState('')
  const [org, setOrg] = useState<Org | null>(null)
  const [step, setStep] = useState<Step>('org')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Face registration info
  const [faceRegCount, setFaceRegCount] = useState(0)

  // Device fingerprint
  const getDeviceFingerprint = (): string => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      ctx!.textBaseline = 'top'
      ctx!.font = '14px Arial'
      ctx!.fillText('fingerprint', 2, 2)
      const canvasData = canvas.toDataURL()
      const nav = navigator
      const raw = `${nav.userAgent}|${nav.language}|${screen.width}x${screen.height}|${canvasData.slice(-50)}`
      let hash = 0
      for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash |= 0
      }
      return Math.abs(hash).toString(36)
    } catch {
      return 'unknown'
    }
  }

  // Geofencing
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [gpsSamples, setGpsSamples] = useState<Array<{ lat: number; lng: number; accuracy: number }>>([])
  const [gpsJitter, setGpsJitter] = useState<number | null>(null)
  const [gpsMockDetected, setGpsMockDetected] = useState(false)
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([])
  const [locationStatus, setLocationStatus] = useState<'unknown' | 'checking' | 'inside' | 'outside' | 'denied' | 'no_geofence'>('unknown')
  const [nearestOffice, setNearestOffice] = useState<{ name: string; distance: number } | null>(null)

  // Strict: only allow scan when GPS proves we're inside, OR admin hasn't configured any geofence.
  // Initial state 'unknown' must BLOCK — never allow scanning before location is verified.
  const canScan = locationStatus === 'inside' || locationStatus === 'no_geofence'

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)

  // Face scanning
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsReady, setModelsReady] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState<string>('')
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const isScanningRef = useRef(false)
  const lastScanTimeRef = useRef(0)
  const consecutiveFailuresRef = useRef(0)
  const prevDescriptorRef = useRef<number[] | null>(null)
  const liveFramesRef = useRef(0)
  const blinkDetectedRef = useRef(false)
  const prevEarRef = useRef<number | null>(null)

  // Identified employee & confirmation
  const [identifiedEmployee, setIdentifiedEmployee] = useState<IdentifiedEmployee | null>(null)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [todayStatus, setTodayStatus] = useState<{ has_checked_in: boolean; has_checked_out: boolean } | null>(null)

  // Result
  const [result, setResult] = useState<{ type: 'checkin' | 'checkout'; time: string } | null>(null)

  // Recent attendance
  const [recentAttendance, setRecentAttendance] = useState<Array<{
    full_name: string
    employee_id: string | null
    position: string | null
    check_in_time: string | null
    check_out_time: string | null
    face_verified: boolean
  }>>([])

  // Load saved org code
  useEffect(() => {
    try {
      const saved = localStorage.getItem('absenku_org_code')
      if (saved) setOrgCode(saved)
    } catch {}
  }, [])

  // Auto-submit if ?code= is in the URL (e.g. from printed QR at office)
  const autoSubmitRef = useRef(false)
  useEffect(() => {
    if (autoSubmitRef.current) return
    const urlCode = new URLSearchParams(window.location.search).get('code')
    if (urlCode && /^[A-Za-z0-9_-]+$/.test(urlCode)) {
      autoSubmitRef.current = true
      searchOrg(urlCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch recent attendance whenever on scan step
  useEffect(() => {
    if (step === 'scan' && orgCode.trim()) {
      fetch(`/api/public-recent-attendance?org_code=${encodeURIComponent(orgCode.trim())}`)
        .then(r => r.json())
        .then(d => setRecentAttendance(d.records ?? []))
        .catch(() => {})
    }
  }, [step, orgCode])

  // Camera lifecycle — only start if canScan
  useEffect(() => {
    if (step === 'scan' && canScan) {
      startCamera()
    } else {
      stopCamera()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, canScan])

  // Load face models only when can scan
  useEffect(() => {
    if (step === 'scan' && canScan && faceRegCount > 0 && !modelsReady && !modelsLoading) {
      setModelsLoading(true)
      import('@/lib/face-detect').then(({ loadModels }) =>
        loadModels()
          .then(() => setModelsReady(true))
          .catch(() => setError('Gagal memuat model verifikasi wajah'))
          .finally(() => setModelsLoading(false))
      )
    }
  }, [step, canScan, faceRegCount, modelsReady, modelsLoading])

  // Start scanning when models are ready and camera is on
  useEffect(() => {
    if (step === 'scan' && canScan && modelsReady && cameraReady) {
      const timer = setTimeout(() => startScanning(), 500)
      return () => clearTimeout(timer)
    } else {
      stopScanning()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, canScan, modelsReady, cameraReady])

  // --- Helpers ---
  const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  // Location check — fresh GPS reading, compute distance, set status.
  // Strict: if GPS reading is too imprecise to fit inside radius, treat as outside.
  // Anti-spoof: ambil 3 sample GPS, hitung jitter, cek flag mock provider (Android).
  const checkLocation = async (locations: OfficeLocation[]) => {
    setLocationStatus('checking')
    try {
      const samples: Array<{ lat: number; lng: number; accuracy: number; mock: boolean }> = []
      for (let i = 0; i < 3; i++) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          })
        })
        // Non-standard: Android Chrome mengisi isMockProvider=true kalau lokasi palsu.
        const isMock = (pos as GeolocationPosition & { isMockProvider?: boolean }).isMockProvider === true
        samples.push({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 0,
          mock: isMock,
        })
        if (i < 2) await new Promise(r => setTimeout(r, 800))
      }

      const avgLat = samples.reduce((s, p) => s + p.lat, 0) / samples.length
      const avgLng = samples.reduce((s, p) => s + p.lng, 0) / samples.length
      const avgAcc = samples.reduce((s, p) => s + p.accuracy, 0) / samples.length
      const anyMock = samples.some(s => s.mock)

      // Jitter = max pairwise distance antar sample.
      // Real GPS selalu ada drift kecil (1-10m); fake GPS biasanya return koordinat identik (jitter=0).
      let maxJitter = 0
      for (let i = 0; i < samples.length; i++) {
        for (let j = i + 1; j < samples.length; j++) {
          const d = getDistance(samples[i].lat, samples[i].lng, samples[j].lat, samples[j].lng)
          if (d > maxJitter) maxJitter = d
        }
      }

      setUserLocation({ lat: avgLat, lng: avgLng })
      setGpsAccuracy(Math.round(avgAcc))
      setGpsSamples(samples.map(({ lat, lng, accuracy }) => ({ lat, lng, accuracy })))
      setGpsJitter(Math.round(maxJitter * 10) / 10)
      setGpsMockDetected(anyMock)

      let insideAny = false
      let nearest: { name: string; distance: number } | null = null

      for (const loc of locations) {
        const dist = getDistance(avgLat, avgLng, loc.latitude, loc.longitude)
        // Strict check: only count as inside if (distance - accuracy) <= radius.
        // If GPS error circle is bigger than remaining slack, can't trust the "inside" reading.
        const slack = Math.max(0, dist - avgAcc)
        if (slack <= loc.radius_meters) insideAny = true
        if (!nearest || dist < nearest.distance) {
          nearest = { name: loc.name, distance: Math.round(dist) }
        }
      }

      setNearestOffice(nearest)
      setLocationStatus(insideAny ? 'inside' : 'outside')
    } catch {
      setLocationStatus('denied')
    }
  }

  const refreshLocation = async () => {
    if (officeLocations.length > 0) await checkLocation(officeLocations)
  }

  const searchOrg = async (codeOverride?: string) => {
    const code = (codeOverride ?? orgCode).trim()
    if (!code) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/public-org?org_code=${encodeURIComponent(code)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal')
      setOrgCode(code)
      setOrg({ id: data.org.id, name: data.org.name, address: data.org.address })
      setFaceRegCount(data.face_registration_count ?? 0)
      try { localStorage.setItem('absenku_org_code', code) } catch {}

      const locations: OfficeLocation[] = data.locations ?? []
      setOfficeLocations(locations)

      // Pindah step dulu, baru cek GPS di background — biar user nggak nunggu
      // sinyal GPS cuma buat lihat daftar karyawan.
      setStep('scan')

      if (locations.length > 0) {
        // Fire and forget — checkLocation set state sendiri saat selesai.
        void checkLocation(locations)
      } else {
        setLocationStatus('no_geofence')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal')
    } finally {
      setLoading(false)
    }
  }

  // --- Camera ---
  const startCamera = useCallback(async () => {
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
      setError('Gagal mengakses kamera. Pastikan izin kamera diaktifkan.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }, [])

  // --- Scanning loop ---
  const startScanning = useCallback(() => {
    if (isScanningRef.current) return
    isScanningRef.current = true
    setScanning(true)
    setScanStatus('Mendeteksi wajah...')
    consecutiveFailuresRef.current = 0
    prevDescriptorRef.current = null
    liveFramesRef.current = 0
    blinkDetectedRef.current = false
    prevEarRef.current = null

    const scanLoop = async () => {
      if (!isScanningRef.current || !videoRef.current || !canvasRef.current || !modelsReady) {
        return
      }

      const video = videoRef.current
      const canvas = canvasRef.current

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0)

      try {
        const { detectSingleDescriptor } = await import('@/lib/face-detect')
        const faceResult = await detectSingleDescriptor(canvas)

        if (faceResult) {
          setFaceBox(faceResult.box)

          if (prevEarRef.current !== null) {
            const earDrop = prevEarRef.current - faceResult.ear
            if (earDrop > 0.05) blinkDetectedRef.current = true
          }
          prevEarRef.current = faceResult.ear

          if (prevDescriptorRef.current) {
            const { checkLiveness } = await import('@/lib/face-compare')
            const liveness = checkLiveness(prevDescriptorRef.current, faceResult.descriptor)
            if (liveness.isLive) liveFramesRef.current++
            if (!liveness.isLive && liveFramesRef.current > 0) liveFramesRef.current = 0
          }
          prevDescriptorRef.current = faceResult.descriptor

          if (liveFramesRef.current < 1) {
            setScanStatus('Mendeteksi wajah... (verifikasi keaslian)')
            if (isScanningRef.current) requestAnimationFrame(scanLoop)
            return
          }

          const now = Date.now()
          if (now - lastScanTimeRef.current >= 1500) {
            lastScanTimeRef.current = now
            setScanStatus('Mengidentifikasi wajah...')

            const res = await fetch('/api/identify-face', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                org_code: orgCode.trim(),
                captured_descriptor: faceResult.descriptor,
              }),
            })
            const data = await res.json()

            if (data.identified) {
              handleIdentification(data)
              return
            } else {
              setScanStatus('Wajah tidak dikenali. Coba posisikan wajah lebih jelas.')
              consecutiveFailuresRef.current = 0
            }
          }
        } else {
          setFaceBox(null)
          setScanStatus('Mendeteksi wajah...')
          consecutiveFailuresRef.current = 0
        }
      } catch {
        consecutiveFailuresRef.current++
        if (consecutiveFailuresRef.current >= 3) {
          setScanStatus('Koneksi bermasalah. Memeriksa kembali...')
          consecutiveFailuresRef.current = 0
        }
      }

      if (isScanningRef.current) requestAnimationFrame(scanLoop)
    }

    scanLoop()
  }, [modelsReady, orgCode])

  const stopScanning = useCallback(() => {
    isScanningRef.current = false
    setScanning(false)
    setFaceBox(null)
  }, [])

  // --- Handle identification → auto-submit ---
  const handleIdentification = async (data: {
    user_id: string; full_name: string; employee_id: string | null
    position: string | null; similarity: number
  }) => {
    stopScanning()
    stopCamera()

    const canvas = canvasRef.current!
    const MAX_DIM = 512
    let exportCanvas: HTMLCanvasElement = canvas
    if (canvas.width > MAX_DIM || canvas.height > MAX_DIM) {
      const scale = Math.min(MAX_DIM / canvas.width, MAX_DIM / canvas.height)
      exportCanvas = document.createElement('canvas')
      exportCanvas.width = Math.round(canvas.width * scale)
      exportCanvas.height = Math.round(canvas.height * scale)
      exportCanvas.getContext('2d')!.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height)
    }
    const photoDataUrl = exportCanvas.toDataURL('image/jpeg', 0.6)
    const base64 = photoDataUrl.split(',')[1]

    setScanStatus(`Wajah dikenali: ${data.full_name}. Menyimpan...`)

    try {
      const res = await fetch('/api/public-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: data.user_id,
          org_code: orgCode.trim(),
          photo_base64: base64,
          face_verified: true,
          face_confidence: data.similarity,
          latitude: userLocation?.lat ?? null,
          longitude: userLocation?.lng ?? null,
          accuracy: gpsAccuracy,
          gps_samples: gpsSamples,
          gps_jitter: gpsJitter,
          gps_mock: gpsMockDetected,
          device_fingerprint: getDeviceFingerprint(),
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal')

      setIdentifiedEmployee({
        user_id: data.user_id,
        full_name: data.full_name,
        employee_id: data.employee_id,
        position: data.position,
        similarity: data.similarity,
        photoUrl: null,
      })
      setResult({ type: result.type, time: result.time })
      setStep('result')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan absensi')
      // Return to scan on error
      setStep('scan')
    }
  }

  const reset = () => {
    stopCamera()
    stopScanning()
    setIdentifiedEmployee(null)
    setCapturedPhoto(null)
    setResult(null)
    setTodayStatus(null)
    setError('')
    setScanStatus('')
    setFaceBox(null)
    setStep(org ? 'scan' : 'org')
  }

  // Step indicator
  const steps = [
    { key: 'org', label: 'Perusahaan', num: 1, icon: Building2 },
    { key: 'scan', label: 'Pindai Wajah', num: 2, icon: ScanFace },
  ] as const

  const currentIndex = steps.findIndex(s => s.key === step || (step === 'confirm' && s.key === 'scan') || (step === 'result' && s.key === 'scan'))

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-teal-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">{appName[0]?.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-white font-bold text-base">{appName}</span>
              {org && (
                <span className="text-white/50 text-xs block leading-tight">{org.name}</span>
              )}
            </div>
          </div>
          {org && (
            <span className="text-teal-400/80 text-xs font-medium bg-teal-400/10 px-2.5 py-1 rounded-full">
              Face ID
            </span>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-4 py-6">
        <div className="w-full max-w-md space-y-4">

          {/* Step Indicator */}
          {org && step !== 'result' && (
            <div className="flex items-center justify-center gap-1 py-3">
              {steps.map((s, i) => {
                const StepIcon = s.icon
                const completed = i < currentIndex
                const active = i === currentIndex
                return (
                  <div key={s.key} className="flex items-center">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all ${
                      completed ? 'text-teal-400' :
                      active ? 'text-teal-300 bg-teal-400/10' :
                      'text-white/25'
                    }`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        completed ? 'bg-teal-500 text-white' :
                        active ? 'bg-teal-400/20 text-teal-300 ring-2 ring-teal-400/50' :
                        'bg-white/10 text-white/25'
                      }`}>
                        {completed ? <Check className="w-4 h-4" /> : <StepIcon className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-xs font-medium hidden sm:inline">{s.label}</span>
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`w-6 h-0.5 rounded-full transition-colors ${i < currentIndex ? 'bg-teal-500' : 'bg-white/10'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Step: Org */}
          {step === 'org' && (
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
              <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <ScanFace className="w-8 h-8 text-teal-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Absensi Face ID</h1>
              <p className="text-sm text-gray-500 mb-2">Arahkan wajah ke kamera untuk absen otomatis</p>
              <p className="text-xs text-gray-400 mb-8">Masukkan kode perusahaan untuk memulai</p>
              <div className="space-y-4">
                <input
                  value={orgCode}
                  onChange={e => setOrgCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && searchOrg()}
                  placeholder="Masukkan kode perusahaan"
                  className="w-full px-5 py-3.5 border border-gray-200 rounded-xl text-sm font-mono tracking-widest text-center text-lg focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                />
                <button
                  onClick={() => searchOrg()}
                  disabled={loading || !orgCode.trim()}
                  className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors"
                >
                  {loading ? 'Mencari...' : 'Masuk'}
                </button>
              </div>
            </div>
          )}

          {/* Step: Scan */}
          {step === 'scan' && (
            <>
              {/* No-geofence warning — admin hasn't configured any office location */}
              {locationStatus === 'no_geofence' && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3">
                  <span className="text-xl shrink-0">⚠️</span>
                  <div className="flex-1">
                    <p className="font-bold text-amber-900 text-sm">Geofence Belum Dikonfigurasi</p>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      Perusahaan ini belum mengatur lokasi kantor. Siapa pun dari lokasi mana pun bisa absen.
                      Minta admin membuka <strong>/dashboard/locations</strong> untuk menambahkan minimal satu lokasi kantor.
                    </p>
                  </div>
                </div>
              )}

              {/* Camera card — only shown when inside geofence */}
              {canScan && (
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="p-5 space-y-4">
                    <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-[4/3]">
                      <video
                        ref={videoRef}
                        className={`w-full h-full object-cover ${!cameraReady ? 'hidden' : ''}`}
                        playsInline
                        muted
                      />

                      {!cameraReady && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center text-white/40">
                            <Camera className="w-10 h-10 mx-auto mb-2" />
                            <p className="text-xs">Membuka kamera...</p>
                          </div>
                        </div>
                      )}

                      {cameraReady && !faceBox && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-44 h-56 border-2 border-white/30 rounded-full border-dashed" />
                        </div>
                      )}

                      {cameraReady && faceBox && (
                        <div
                          className="absolute border-2 border-teal-400 rounded-lg transition-all duration-150 pointer-events-none"
                          style={{
                            left: `${(faceBox.x / (videoRef.current?.videoWidth || 640)) * 100}%`,
                            top: `${(faceBox.y / (videoRef.current?.videoHeight || 480)) * 100}%`,
                            width: `${(faceBox.width / (videoRef.current?.videoWidth || 640)) * 100}%`,
                            height: `${(faceBox.height / (videoRef.current?.videoHeight || 480)) * 100}%`,
                            boxShadow: '0 0 12px rgba(20, 184, 166, 0.5)',
                          }}
                        >
                          <div className="absolute -top-6 left-0 right-0 text-center">
                            <span className="bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                              WAJAH TERDETEKSI
                            </span>
                          </div>
                        </div>
                      )}

                      {scanning && (
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute top-3 left-3 flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 bg-teal-400 rounded-full animate-pulse" />
                            <span className="text-teal-300 text-[10px] font-bold tracking-wide">SCANNING</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <canvas ref={canvasRef} className="hidden" />

                    {faceRegCount === 0 && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm text-center">
                        <p className="font-medium">Belum ada data wajah terdaftar</p>
                        <p className="text-xs mt-1 text-amber-600">
                          Belum ada karyawan yang mendaftarkan data wajah di perusahaan ini.
                          Silakan hubungi admin perusahaan.
                        </p>
                      </div>
                    )}

                    {locationStatus === 'inside' && officeLocations.length > 0 && (
                      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>Lokasi terverifikasi — Anda berada di area kantor</span>
                      </div>
                    )}

                    {/* GPS imprecision warning — high error margin reduces confidence */}
                    {locationStatus === 'inside' && gpsAccuracy !== null && nearestOffice && (
                      gpsAccuracy > nearestOffice.distance * 0.5 && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
                          <span className="shrink-0">⚠️</span>
                          <span>
                            Akurasi GPS ±{gpsAccuracy}m. Jarak ke kantor terdekat {nearestOffice.distance}m.
                            {gpsAccuracy > nearestOffice.distance && ' Pembacaan GPS terlalu meleset — disarankan refresh atau pindah ke lokasi terbuka.'}
                          </span>
                        </div>
                      )
                    )}

                    {modelsLoading && (
                      <div className="text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                        Memuat model verifikasi wajah...
                      </div>
                    )}

                    {scanning && scanStatus && (
                      <div className="text-center text-sm text-gray-600 flex items-center justify-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                        {scanStatus}
                      </div>
                    )}

                    {cameraReady && !modelsReady && !modelsLoading && faceRegCount > 0 && (
                      <div className="text-center text-sm text-gray-400">Menyiapkan pemindai...</div>
                    )}
                  </div>
                </div>
              )}

              {/* Checking/unknown — neutral state while GPS is being verified */}
              {!canScan && (locationStatus === 'checking' || locationStatus === 'unknown') && (
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Memeriksa Lokasi</h2>
                    <p className="text-sm text-gray-500">
                      Sistem sedang memverifikasi posisi Anda...
                    </p>
                  </div>
                </div>
              )}

              {/* Outside geofence card — camera disabled */}
              {!canScan && locationStatus !== 'checking' && locationStatus !== 'unknown' && (
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                      <MapPinOff className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Di Luar Area Absensi</h2>
                    {locationStatus === 'denied' ? (
                      <p className="text-sm text-gray-500">
                        Izin lokasi ditolak. Aktifkan izin lokasi di browser Anda agar sistem dapat memverifikasi kehadiran Anda.
                      </p>
                    ) : nearestOffice ? (
                      <p className="text-sm text-gray-500">
                        Anda berada <span className="font-bold text-red-600">{nearestOffice.distance}m</span> dari{' '}
                        <span className="font-semibold">{nearestOffice.name}</span>.
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Lokasi Anda tidak terdeteksi di area kantor.
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-3 mb-4">
                      Kamera absensi hanya aktif saat Anda berada di area kantor.
                    </p>
                    <button
                      onClick={refreshLocation}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2"
                    >
                      🔄 Cek Ulang Lokasi
                    </button>
                  </div>
                </div>
              )}

              {/* GPS debug info — always visible when geofence is configured */}
              {officeLocations.length > 0 && (
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5" />
                      Info Lokasi
                      <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        locationStatus === 'inside' ? 'bg-green-100 text-green-700' :
                        locationStatus === 'outside' ? 'bg-red-100 text-red-700' :
                        locationStatus === 'denied' ? 'bg-amber-100 text-amber-700' :
                        locationStatus === 'checking' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {locationStatus.toUpperCase().replace('_', ' ')}
                      </span>
                    </h3>
                  </div>
                  <div className="px-5 py-3 text-xs space-y-1.5 font-mono">
                    {userLocation ? (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-500">Koordinat Anda:</span>
                        <span className="text-gray-800 text-right">
                          {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                          {gpsAccuracy !== null && (
                            <span className="text-gray-400"> (±{gpsAccuracy}m)</span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <p className="text-gray-400 italic">Belum ada pembacaan GPS</p>
                    )}
                    {officeLocations.map((loc, i) => {
                      const dist = userLocation ? Math.round(getDistance(userLocation.lat, userLocation.lng, loc.latitude, loc.longitude)) : null
                      return (
                        <div key={i} className="flex justify-between gap-2">
                          <span className="text-gray-500">{loc.name}:</span>
                          <span className={`text-right ${dist !== null && dist <= loc.radius_meters ? 'text-green-700 font-semibold' : 'text-gray-800'}`}>
                            {dist !== null ? `${dist}m` : '—'}{' '}
                            <span className="text-gray-400">(radius {loc.radius_meters}m)</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Geofence not configured — show explicit card */}
              {officeLocations.length === 0 && (
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5" />
                      Info Lokasi
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700">
                        NO GEOFENCE
                      </span>
                    </h3>
                  </div>
                  <div className="px-5 py-3 text-xs text-gray-600">
                    Belum ada lokasi kantor terdaftar untuk perusahaan ini. Geofence tidak aktif — siapa pun dari mana pun bisa absen sampai admin menambahkan lokasi di <strong>/dashboard/locations</strong>.
                  </div>
                </div>
              )}

              {/* Recent Attendance Card — always shown */}
              {org && (
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      Absen Terbaru Hari Ini
                      {recentAttendance.length > 0 && (
                        <span className="text-xs font-normal text-gray-400">({recentAttendance.length} karyawan)</span>
                      )}
                    </h3>
                  </div>
                  {recentAttendance.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <p className="text-sm text-gray-400">Belum ada absensi hari ini</p>
                      <p className="text-xs text-gray-300 mt-1">Jadilah yang pertama absen!</p>
                    </div>
                  ) : (
                  <div className="divide-y divide-gray-50 max-h-[360px] overflow-y-auto">
                    {recentAttendance.map((rec, i) => {
                      const checkinTime = rec.check_in_time
                        ? new Date(rec.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
                        : null
                      const checkoutTime = rec.check_out_time
                        ? new Date(rec.check_out_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
                        : null
                      return (
                        <div key={i} className="px-5 py-3 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-600 shrink-0">
                            {rec.full_name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{rec.full_name}</p>
                            <p className="text-xs text-gray-400">
                              {rec.employee_id && <span className="mr-2">{rec.employee_id}</span>}
                              {rec.position && <span>{rec.position}</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {checkinTime && (
                              <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-lg">
                                <span className="text-[10px] text-green-600 font-medium">Masuk</span>
                                <span className="text-xs font-mono text-gray-700">{checkinTime}</span>
                              </div>
                            )}
                            {checkoutTime && (
                              <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
                                <span className="text-[10px] text-blue-600 font-medium">Pulang</span>
                                <span className="text-xs font-mono text-gray-700">{checkoutTime}</span>
                              </div>
                            )}
                            {rec.face_verified && <span className="text-[10px]" title="Face verified">🛡️</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  )}
                </div>
              )}

              {/* Back button */}
              <button
                onClick={() => { stopCamera(); stopScanning(); setOrg(null); setStep('org') }}
                className="w-full py-2 text-white/40 text-sm hover:text-white/60 transition-colors flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Ganti perusahaan
              </button>
            </>
          )}

          {/* Step: Result */}
          {step === 'result' && result && (
            <AutoRedirectResult
              type={result.type}
              time={result.time}
              employeeName={identifiedEmployee?.full_name}
              onRedirect={() => {
                stopCamera()
                setIdentifiedEmployee(null)
                setCapturedPhoto(null)
                setTodayStatus(null)
                setFaceBox(null)
                setScanning(false)
                setScanStatus('Mendeteksi wajah...')
                setStep('scan')
              }}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 px-4 py-3">
        <div className="max-w-md mx-auto text-center">
          {org?.address && (
            <p className="text-white/30 text-xs mb-1">{org.address}</p>
          )}
          <p className="text-white/20 text-xs">
            Powered by <span className="text-teal-400/60 font-semibold">{appName}</span> · Face ID
          </p>
        </div>
      </footer>
    </div>
  )
}
