'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Check, Camera, ArrowLeft, Building2, ScanFace, User, ShieldCheck, MapPin } from 'lucide-react'

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

export default function AbsenClient() {
  const [orgCode, setOrgCode] = useState('')
  const [org, setOrg] = useState<Org | null>(null)
  const [step, setStep] = useState<Step>('org')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Face registration info
  const [faceRegCount, setFaceRegCount] = useState(0)

  // Device fingerprint — simple hash of browser features
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
      // Simple hash
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
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([])
  const [locationStatus, setLocationStatus] = useState<'unknown' | 'checking' | 'inside' | 'outside' | 'denied'>('unknown')
  const [nearestOffice, setNearestOffice] = useState<{ name: string; distance: number } | null>(null)

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
  const liveFramesRef = useRef(0) // count of frames with different descriptors
  const blinkDetectedRef = useRef(false)
  const prevEarRef = useRef<number | null>(null)

  // Identified employee & confirmation
  const [identifiedEmployee, setIdentifiedEmployee] = useState<IdentifiedEmployee | null>(null)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [todayStatus, setTodayStatus] = useState<{ has_checked_in: boolean; has_checked_out: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

  // Camera lifecycle
  useEffect(() => {
    if (step === 'scan') {
      startCamera()
    } else {
      stopCamera()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Load face models when entering scan step
  useEffect(() => {
    if (step === 'scan' && faceRegCount > 0 && !modelsReady && !modelsLoading) {
      setModelsLoading(true)
      import('@/lib/face-detect').then(({ loadModels }) =>
        loadModels()
          .then(() => setModelsReady(true))
          .catch(() => setError('Gagal memuat model verifikasi wajah'))
          .finally(() => setModelsLoading(false))
      )
    }
  }, [step, faceRegCount, modelsReady, modelsLoading])

  // Start scanning when models are ready and camera is on
  useEffect(() => {
    if (step === 'scan' && modelsReady && cameraReady) {
      // Small delay to let camera stabilize
      const timer = setTimeout(() => startScanning(), 500)
      return () => clearTimeout(timer)
    } else {
      stopScanning()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, modelsReady, cameraReady])

  // --- Org lookup ---
  // Haversine distance between two GPS points (meters)
  const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000 // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const searchOrg = async () => {
    if (!orgCode.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/public-employees?org_code=${encodeURIComponent(orgCode.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal')
      setOrg({ id: data.org.id, name: data.org.name, address: data.org.address })
      setFaceRegCount(data.face_registration_count ?? 0)
      try { localStorage.setItem('absenku_org_code', orgCode.trim()) } catch {}

      // Fetch office locations for geofencing
      const locRes = await fetch(`/api/public-locations?org_code=${encodeURIComponent(orgCode.trim())}`)
      const locData = await locRes.json()
      const locations: OfficeLocation[] = locData.locations ?? []
      setOfficeLocations(locations)

      // If locations exist, check GPS
      if (locations.length > 0) {
        setLocationStatus('checking')
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 30000,
            })
          })
          const { latitude: lat, longitude: lng } = pos.coords
          setUserLocation({ lat, lng })

          // Check if inside any office geofence
          let insideAny = false
          let nearest: { name: string; distance: number } | null = null

          for (const loc of locations) {
            const dist = getDistance(lat, lng, loc.latitude, loc.longitude)
            if (dist <= loc.radius_meters) {
              insideAny = true
            }
            if (!nearest || dist < nearest.distance) {
              nearest = { name: loc.name, distance: Math.round(dist) }
            }
          }

          setNearestOffice(nearest)
          setLocationStatus(insideAny ? 'inside' : 'outside')
        } catch {
          setLocationStatus('denied')
        }
      } else {
        // No office locations configured — skip geofencing
        setLocationStatus('inside')
      }

      setStep('scan')

      // Fetch recent attendance
      try {
        const recentRes = await fetch(`/api/public-recent-attendance?org_code=${encodeURIComponent(orgCode.trim())}`)
        const recentData = await recentRes.json()
        setRecentAttendance(recentData.records ?? [])
      } catch { /* non-critical */ }
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

      // Draw current frame to canvas
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0)

      try {
        const { detectSingleDescriptor } = await import('@/lib/face-detect')
        const faceResult = await detectSingleDescriptor(canvas)

        if (faceResult) {
          setFaceBox(faceResult.box)

          // Blink detection: track EAR changes
          // A real person blinks every 2-5 seconds
          // A video/photo has constant EAR
          if (prevEarRef.current !== null) {
            const earDrop = prevEarRef.current - faceResult.ear
            // EAR drop > 0.05 = blink detected
            if (earDrop > 0.05) {
              blinkDetectedRef.current = true
            }
          }
          prevEarRef.current = faceResult.ear

          // Liveness check: compare with previous descriptor
          // Real faces have micro-movements → descriptors vary slightly
          // A held photo → descriptors are nearly identical
          if (prevDescriptorRef.current) {
            const { checkLiveness } = await import('@/lib/face-compare')
            const liveness = checkLiveness(prevDescriptorRef.current, faceResult.descriptor)
            if (liveness.isLive) {
              liveFramesRef.current++
            }
            // Reset if too similar (possible photo)
            if (!liveness.isLive && liveFramesRef.current > 0) {
              liveFramesRef.current = 0
            }
          }
          prevDescriptorRef.current = faceResult.descriptor

          // Require at least 1 live frame (micro-movement detected)
          // Blink is checked but not blocking — logged for audit
          if (liveFramesRef.current < 1) {
            setScanStatus('Mendeteksi wajah... (verifikasi keaslian)')
            // Continue scanning without API call
            if (isScanningRef.current) {
              requestAnimationFrame(scanLoop)
            }
            return
          }

          const now = Date.now()
          // Throttle API calls: min 1.5s between calls
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
              // Match found!
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

      // Schedule next frame
      if (isScanningRef.current) {
        requestAnimationFrame(scanLoop)
      }
    }

    scanLoop()
  }, [modelsReady, orgCode])

  const stopScanning = useCallback(() => {
    isScanningRef.current = false
    setScanning(false)
    setFaceBox(null)
  }, [])

  // --- Handle successful identification ---
  const handleIdentification = async (data: {
    user_id: string; full_name: string; employee_id: string | null
    position: string | null; similarity: number
  }) => {
    stopScanning()
    stopCamera()

    // Capture current frame as attendance photo
    const canvas = canvasRef.current!
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setCapturedPhoto(photoDataUrl)

    // Fetch registered face photo for confirmation
    let photoUrl: string | null = null
    try {
      const photoRes = await fetch(
        `/api/public-face-photo?user_id=${data.user_id}&org_code=${encodeURIComponent(orgCode.trim())}`
      )
      const photoData = await photoRes.json()
      if (photoData.url) photoUrl = photoData.url
    } catch { /* non-critical */ }

    // Fetch today's attendance status
    let status = null
    try {
      const sRes = await fetch(`/api/public-attendance?user_id=${data.user_id}`)
      status = await sRes.json()
    } catch { /* non-critical */ }

    setIdentifiedEmployee({
      user_id: data.user_id,
      full_name: data.full_name,
      employee_id: data.employee_id,
      position: data.position,
      similarity: data.similarity,
      photoUrl,
    })
    setTodayStatus(status)
    setStep('confirm')
  }

  // --- Submit attendance ---
  const confirmAndSubmit = async () => {
    if (!identifiedEmployee || !capturedPhoto || !orgCode) return
    setSubmitting(true)
    setError('')
    try {
      const base64 = capturedPhoto.split(',')[1]
      const res = await fetch('/api/public-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: identifiedEmployee.user_id,
          org_code: orgCode.trim(),
          photo_base64: base64,
          face_verified: true,
          face_confidence: identifiedEmployee.similarity,
          latitude: userLocation?.lat ?? null,
          longitude: userLocation?.lng ?? null,
          device_fingerprint: getDeviceFingerprint(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal')
      setResult({ type: data.type, time: data.time })
      setStep('result')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Decline and rescan ---
  const declineAndRescan = () => {
    setIdentifiedEmployee(null)
    setCapturedPhoto(null)
    setTodayStatus(null)
    setScanStatus('')
    setScanStatus('')
    setError('')
    setStep('scan')
  }

  // --- Reset ---
  const reset = () => {
    stopCamera()
    stopScanning()
    setIdentifiedEmployee(null)
    setCapturedPhoto(null)
    setResult(null)
    setTodayStatus(null)
    setError('')
    setScanStatus('')
    setSubmitting(false)
    setFaceBox(null)
    setStep(org ? 'scan' : 'org')
  }

  // Step indicator data
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
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <div>
              <span className="text-white font-bold text-base">AbsenKu</span>
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
                  onClick={searchOrg}
                  disabled={loading || !orgCode.trim()}
                  className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors"
                >
                  {loading ? 'Mencari...' : 'Masuk'}
                </button>
              </div>
            </div>
          )}

          {/* Step: Scan (real-time face scanning) */}
          {step === 'scan' && (
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-5 space-y-4">
                {/* Camera area */}
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

                  {/* Face guide oval + real-time face box */}
                  {cameraReady && !faceBox && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-44 h-56 border-2 border-white/30 rounded-full border-dashed" />
                    </div>
                  )}

                  {/* Real-time face bounding box */}
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

                  {/* Scanning pulse overlay */}
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

                {/* No face registrations warning */}
                {faceRegCount === 0 && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm text-center">
                    <p className="font-medium">Belum ada data wajah terdaftar</p>
                    <p className="text-xs mt-1 text-amber-600">
                      Belum ada karyawan yang mendaftarkan data wajah di perusahaan ini.
                      Silakan hubungi admin perusahaan.
                    </p>
                  </div>
                )}

                {/* Geofencing status */}
                {locationStatus === 'checking' && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm text-center flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    Memeriksa lokasi Anda...
                  </div>
                )}

                {locationStatus === 'denied' && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <p className="font-medium">Izin lokasi ditolak</p>
                    </div>
                    <p className="text-xs text-amber-600">
                      Aktifkan izin lokasi di browser untuk verifikasi kehadiran. Absensi tetap bisa dilakukan tanpa lokasi.
                    </p>
                  </div>
                )}

                {locationStatus === 'outside' && nearestOffice && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <p className="font-medium">📍 Di luar area absensi</p>
                    </div>
                    <p className="text-xs text-red-600">
                      Anda berada <span className="font-bold">{nearestOffice.distance}m</span> dari <span className="font-semibold">{nearestOffice.name}</span>.
                      Absensi hanya bisa dilakukan di area kantor.
                    </p>
                  </div>
                )}

                {locationStatus === 'inside' && officeLocations.length > 0 && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>Lokasi terverifikasi — Anda berada di area kantor</span>
                  </div>
                )}

                {/* Model loading */}
                {modelsLoading && (
                  <div className="text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                    Memuat model verifikasi wajah...
                  </div>
                )}

                {/* Scan status */}
                {scanning && scanStatus && (
                  <div className="text-center text-sm text-gray-600 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                    {scanStatus}
                  </div>
                )}

                {/* Waiting for models */}
                {cameraReady && !modelsReady && !modelsLoading && faceRegCount > 0 && (
                  <div className="text-center text-sm text-gray-400">Menyiapkan pemindai...</div>
                )}

                <button
                  onClick={() => { stopCamera(); stopScanning(); setOrg(null); setStep('org') }}
                  className="w-full py-2 text-gray-500 text-sm hover:text-gray-700 transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Ganti perusahaan
                </button>
              </div>
            </div>
          )}

          {/* Recent Attendance Card */}
          {step === 'scan' && org && (
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
                  <p className="text-xs text-gray-300 mt-1">Jadilah yang pertama absen! 🎉</p>
                </div>
              ) : (
              <div className="divide-y divide-gray-50 max-h-[360px] overflow-y-auto">
                {recentAttendance.map((rec, i) => {
                  const time = rec.check_in_time
                    ? new Date(rec.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
                    : '--:--'
                  const checkoutTime = rec.check_out_time
                    ? new Date(rec.check_out_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
                    : null
                  return (
                    <div key={i} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-600 shrink-0">
                        {rec.full_name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{rec.full_name}</p>
                        <p className="text-xs text-gray-400">
                          {rec.employee_id && <span className="mr-2">{rec.employee_id}</span>}
                          {rec.position && <span>{rec.position}</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-gray-600">{time}</span>
                          {rec.face_verified && <span className="text-[10px]" title="Face verified">🛡️</span>}
                        </div>
                        {checkoutTime && (
                          <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">
                            check-out {checkoutTime}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              )}
            </div>
          )}

          {/* Step: Confirm */}
          {step === 'confirm' && identifiedEmployee && (
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Captured photo */}
              {capturedPhoto && (
                <div className="relative bg-slate-900 aspect-[4/3]">
                  <img src={capturedPhoto} alt="Foto" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30">
                      <ShieldCheck className="w-7 h-7 text-white" />
                    </div>
                  </div>
                </div>
              )}

              <div className="p-5 space-y-4">
                {/* Employee info card */}
                <div className="bg-teal-50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    {/* Registered face photo */}
                    {identifiedEmployee.photoUrl ? (
                      <img
                        src={identifiedEmployee.photoUrl}
                        alt="Foto terdaftar"
                        className="w-14 h-14 rounded-full object-cover border-2 border-teal-200"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                        {identifiedEmployee.full_name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-teal-900 truncate">{identifiedEmployee.full_name}</p>
                      <p className="text-xs text-teal-700/70">
                        {identifiedEmployee.employee_id && (
                          <span className="font-mono">{identifiedEmployee.employee_id}</span>
                        )}
                        {identifiedEmployee.employee_id && identifiedEmployee.position && ' · '}
                        {identifiedEmployee.position}
                      </p>
                    </div>
                  </div>

                  {/* Similarity score */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-teal-700/60">Kecocokan wajah</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-teal-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            identifiedEmployee.similarity >= 0.5 ? 'bg-teal-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.round(identifiedEmployee.similarity * 100)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold ${
                        identifiedEmployee.similarity >= 0.5 ? 'text-teal-600' : 'text-amber-600'
                      }`}>
                        {Math.round(identifiedEmployee.similarity * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Weak match warning */}
                  {identifiedEmployee.similarity < 0.5 && (
                    <div className="mt-2 bg-amber-100 text-amber-700 text-xs px-3 py-2 rounded-lg">
                      Kecocokan rendah. Pastikan ini benar-benar Anda.
                    </div>
                  )}
                </div>

                {/* Attendance status */}
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                  <p className="text-sm text-gray-600">
                    {todayStatus?.has_checked_out
                      ? '✅ Sudah check-in & check-out hari ini'
                      : todayStatus?.has_checked_in
                        ? '📍 Sudah check-in — akan melakukan check-out'
                        : '📍 Belum check-in hari ini'
                    }
                  </p>
                </div>

                {/* Confirmation prompt */}
                <p className="text-center text-gray-700 font-medium text-sm">
                  Apakah ini Anda?
                </p>

                {/* Location required warning */}
                {officeLocations.length > 0 && locationStatus !== 'inside' && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm text-center">
                    <p className="font-medium">📍 Verifikasi lokasi diperlukan</p>
                    <p className="text-xs mt-1 text-red-600">
                      {locationStatus === 'denied'
                        ? 'Aktifkan izin lokasi di browser Anda untuk melakukan absensi.'
                        : locationStatus === 'outside'
                          ? 'Anda berada di luar area kantor. Absensi hanya bisa dilakukan di lokasi kantor.'
                          : 'Memverifikasi lokasi Anda...'
                      }
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={declineAndRescan}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-sm"
                  >
                    Bukan saya
                  </button>
                  <button
                    onClick={confirmAndSubmit}
                    disabled={submitting || (officeLocations.length > 0 && locationStatus !== 'inside')}
                    className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors text-sm"
                  >
                    {submitting
                      ? 'Menyimpan...'
                      : todayStatus?.has_checked_in
                        ? 'Ya, Check-out'
                        : 'Ya, Check-in'
                    }
                  </button>
                </div>

                <button
                  onClick={reset}
                  className="w-full py-2 text-gray-500 text-sm hover:text-gray-700 transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Batal
                </button>
              </div>
            </div>
          )}

          {/* Step: Result */}
          {step === 'result' && result && (
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {result.type === 'checkin' ? 'Check-in Berhasil!' : 'Check-out Berhasil!'}
              </h2>
              <p className="text-sm text-gray-500 mb-5">{identifiedEmployee?.full_name}</p>
              <div className="bg-teal-50 rounded-xl px-6 py-4 mb-6">
                <p className="text-3xl font-bold text-teal-600">{result.time} WIB</p>
              </div>
              {result.type === 'checkin' && (
                <p className="text-xs text-gray-400 mb-4">Jangan lupa check-out sebelum pulang</p>
              )}
              <button onClick={reset} className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors">
                Selesai
              </button>
            </div>
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
            Powered by <span className="text-teal-400/60 font-semibold">AbsenKu</span> · Face ID
          </p>
        </div>
      </footer>
    </div>
  )
}
