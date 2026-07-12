'use client'

import { useState, useEffect } from 'react'
import { Check, XCircle, Clock, Shield, QrCode } from 'lucide-react'

type PageState = 'confirm' | 'loading' | 'success' | 'error'
type ChosenType = 'checkin' | 'checkout'

export default function QrCheckinClient({
  token,
  isValid,
  employeeName,
  employeeId,
  employeePosition,
  orgName,
  tokenType,
  expiresAt,
}: {
  token: string
  isValid: boolean
  employeeName: string | null
  employeeId: string | null
  employeePosition: string | null
  orgName: string | null
  tokenType: string
  expiresAt: string | null
}) {
  const [state, setState] = useState<PageState>(isValid ? 'confirm' : 'error')
  const [errorMsg, setErrorMsg] = useState(isValid ? '' : 'QR code tidak valid atau sudah kadaluarsa')
  const [result, setResult] = useState<{ type: string; time: string; date?: string; employee_name: string } | null>(null)
  const [countdown, setCountdown] = useState('')

  // Friend-chosen type: default from token, else check-in. Friend can toggle.
  const [chosenType, setChosenType] = useState<ChosenType>(
    tokenType === 'checkout' ? 'checkout' : 'checkin'
  )
  // Friend-chosen datetime (YYYY-MM-DDTHH:MM), default = now in Jakarta.
  // Built from Intl parts to guarantee colon-separated HH:MM regardless of locale.
  const [chosenDatetime, setChosenDatetime] = useState(() => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'Asia/Jakarta',
    }).formatToParts(new Date())
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
  })

  // Countdown for expiry
  useEffect(() => {
    if (!expiresAt || !isValid) return
    const interval = setInterval(() => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) {
        setCountdown('Kadaluarsa')
        setState('error')
        setErrorMsg('QR code sudah kadaluarsa')
        clearInterval(interval)
        return
      }
      const mins = Math.floor(diff / 60_000)
      const secs = Math.floor((diff % 60_000) / 1000)
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, isValid])

  const handleConfirm = async () => {
    setState('loading')
    try {
      const res = await fetch('/api/qr-attendance/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, type: chosenType, datetime: chosenDatetime }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal memproses')
        setState('error')
        return
      }
      setResult(data)
      setState('success')
    } catch {
      setErrorMsg('Koneksi gagal. Coba lagi.')
      setState('error')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-teal-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-base">{orgName || 'AbsenKu'}</span>
              <span className="text-white/50 text-xs block leading-tight">QR Admin Absensi</span>
            </div>
          </div>
          <span className="text-teal-400/80 text-xs font-medium bg-teal-400/10 px-2.5 py-1 rounded-full">
            QR Code
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md space-y-4">

          {/* Error State */}
          {state === 'error' && (
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <div className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Gagal</h2>
              <p className="text-sm text-gray-500">{errorMsg}</p>
              <p className="text-xs text-gray-400 mt-4">
                Hubungi admin jika Anda membutuhkan bantuan
              </p>
            </div>
          )}

          {/* Confirmation State */}
          {state === 'confirm' && (
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
              <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <div className="w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center">
                  <Shield className="w-7 h-7 text-white" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Konfirmasi Absensi</h2>
              <p className="text-sm text-gray-500 mb-6">
                Pilih jenis absensi dan jam, lalu konfirmasi
              </p>

              {/* Employee Info */}
              <div className="bg-gray-50 rounded-xl px-5 py-4 mb-4 text-left space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-sm font-bold text-teal-600">
                    {employeeName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{employeeName}</p>
                    <p className="text-xs text-gray-400">
                      {employeeId && <span className="mr-2">{employeeId}</span>}
                      {employeePosition}
                    </p>
                  </div>
                </div>
              </div>

              {/* Type Selector */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 text-left">
                  Jenis Absensi
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setChosenType('checkin')}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors border ${
                      chosenType === 'checkin'
                        ? 'bg-teal-50 border-teal-300 text-teal-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    📥 Check-in
                  </button>
                  <button
                    onClick={() => setChosenType('checkout')}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors border ${
                      chosenType === 'checkout'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    📤 Check-out
                  </button>
                </div>
              </div>

              {/* DateTime Picker */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 text-left">
                  Tanggal & Jam Absen (WIB)
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="datetime-local"
                    value={chosenDatetime}
                    onChange={e => setChosenDatetime(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-base font-mono font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5 text-left">
                  Bisa pilih tanggal & jam masa lalu. Tidak bisa absen untuk masa depan.
                </p>
              </div>

              {/* Expiry */}
              <div className="flex gap-3 mb-6">
                <div className="flex-1 bg-amber-50 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-amber-600 mb-1">QR Berlaku</p>
                  <p className="text-lg font-mono font-bold text-amber-700">{countdown}</p>
                </div>
              </div>

              {/* Info */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6 text-left">
                <p className="text-xs text-blue-700">
                  📋 Absensi ini dicatat melalui QR Admin — tanpa verifikasi wajah & lokasi. Data akan tercatat di audit log.
                </p>
              </div>

              {/* Confirm Button */}
              <button
                onClick={handleConfirm}
                className={`w-full py-3.5 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                  chosenType === 'checkin' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Check className="w-5 h-5" />
                Konfirmasi {chosenType === 'checkin' ? 'Check-in' : 'Check-out'}
              </button>
            </div>
          )}

          {/* Loading State */}
          {state === 'loading' && (
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
              <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <div className="w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center">
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Memproses...</h2>
              <p className="text-sm text-gray-500">Menyimpan data kehadiran</p>
            </div>
          )}

          {/* Success State */}
          {state === 'success' && result && (
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {result.type === 'checkin' ? 'Check-in Berhasil!' : 'Check-out Berhasil!'}
              </h2>
              <p className="text-sm text-gray-500 mb-5">{result.employee_name}</p>
              <div className="bg-teal-50 rounded-xl px-6 py-4 mb-4">
                <p className="text-3xl font-bold text-teal-600">{result.time} WIB</p>
                {result.date && (
                  <p className="text-sm text-teal-600/70 mt-1">{result.date}</p>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Dicatat via QR Admin
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 px-4 py-3">
        <div className="max-w-md mx-auto text-center">
          <p className="text-white/20 text-xs">
            Powered by <span className="text-teal-400/60 font-semibold">{orgName || 'AbsenKu'}</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
