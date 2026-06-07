'use client'

import { useState, useEffect, useRef } from 'react'
import { Check, Copy, QrCode, RefreshCw, Search, Clock, User, Building2, AlertCircle, ChevronRight } from 'lucide-react'

type Company = {
  id: string
  name: string
  company_code: string
  app_name: string | null
}

type Employee = {
  id: string
  full_name: string
  employee_id: string | null
  position: string | null
  avatar_url: string | null
}

type RecentToken = {
  id: string
  token: string
  status: 'active' | 'used' | 'expired'
  type: 'checkin' | 'checkout'
  expires_at: string
  used_at: string | null
  created_at: string
  ip_address: string | null
  user: { full_name: string; employee_id: string | null }[] | null
  generator: { full_name: string }[] | null
}

export default function QrAttendanceClient({
  companies,
}: {
  companies: Company[]
}) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [recentTokens, setRecentTokens] = useState<RecentToken[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Employee search
  const [search, setSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [qrType, setQrType] = useState<'checkin' | 'checkout'>('checkin')
  const [expiryMinutes, setExpiryMinutes] = useState(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [qrData, setQrData] = useState<{
    token: string
    qr_data_url: string
    qr_url: string
    expires_at: string
    employee_name: string
    type: string
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState<string>('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load employees + tokens when company selected
  useEffect(() => {
    if (!selectedCompany) {
      setEmployees([])
      setRecentTokens([])
      return
    }
    setLoadingData(true)
    Promise.all([
      fetch(`/api/qr-attendance/employees?org_id=${selectedCompany.id}`).then(r => r.json()),
      fetch(`/api/qr-attendance/tokens?org_id=${selectedCompany.id}`).then(r => r.json()),
    ])
      .then(([empData, tokenData]) => {
        setEmployees(empData.employees ?? [])
        setRecentTokens(tokenData.tokens ?? [])
      })
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [selectedCompany])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Countdown timer for QR expiry
  useEffect(() => {
    if (!qrData) return
    const interval = setInterval(() => {
      const diff = new Date(qrData.expires_at).getTime() - Date.now()
      if (diff <= 0) {
        setCountdown('Kadaluarsa')
        clearInterval(interval)
        return
      }
      const mins = Math.floor(diff / 60_000)
      const secs = Math.floor((diff % 60_000) / 1000)
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [qrData])

  // Filter employees by search
  const filtered = employees.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
    e.position?.toLowerCase().includes(search.toLowerCase())
  )

  const handleGenerate = async () => {
    if (!selectedEmployee || !selectedCompany) return
    setLoading(true)
    setError('')
    setQrData(null)
    try {
      const res = await fetch('/api/qr-attendance/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedEmployee.id,
          org_id: selectedCompany.id,
          type: qrType,
          expiry_minutes: expiryMinutes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal membuat QR')
      setQrData(data)
      // Refresh tokens
      const tokenRes = await fetch(`/api/qr-attendance/tokens?org_id=${selectedCompany.id}`)
      const tokenData = await tokenRes.json()
      setRecentTokens(tokenData.tokens ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!qrData?.qr_url) return
    try {
      await navigator.clipboard.writeText(qrData.qr_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = qrData.qr_url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const fmtTime = (t: string | null) =>
    t ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '-'

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Aktif</span>
      case 'used':
        return <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">Digunakan</span>
      case 'expired':
        return <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">Kadaluarsa</span>
      default:
        return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{status}</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <QrCode className="w-6 h-6 text-teal-600" />
          QR Admin Check-in
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate QR code untuk mencatat kehadiran karyawan tanpa verifikasi wajah & lokasi
        </p>
      </div>

      {/* Step 1: Pilih Perusahaan */}
      {!selectedCompany ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-600" />
              Pilih Perusahaan
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Pilih perusahaan untuk melihat daftar karyawan</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            {companies.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">Belum ada perusahaan terdaftar</div>
            ) : companies.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedCompany(c); setSelectedEmployee(null); setQrData(null) }}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-teal-50/50 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-sm font-bold text-teal-600 shrink-0">
                  {(c.app_name || c.name)?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{c.app_name || c.name}</p>
                  <p className="text-xs text-gray-400">{c.company_code}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-teal-500 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Company header + back button */}
          <div className="flex items-center gap-3 bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-3">
            <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center text-sm font-bold text-teal-600">
              {(selectedCompany.app_name || selectedCompany.name)?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{selectedCompany.app_name || selectedCompany.name}</p>
              <p className="text-xs text-gray-400">{selectedCompany.company_code}</p>
            </div>
            <button
              onClick={() => { setSelectedCompany(null); setSelectedEmployee(null); setQrData(null); setSearch('') }}
              className="text-xs text-gray-500 hover:text-teal-600 font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:border-teal-300 transition-colors"
            >
              Ganti Perusahaan
            </button>
          </div>

          {loadingData ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Memuat data karyawan...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Generate Form */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <User className="w-4 h-4 text-teal-600" />
                    Pilih Karyawan
                  </h2>

                  {/* Searchable Dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={selectedEmployee ? `${selectedEmployee.full_name} (${selectedEmployee.employee_id || '-'})` : search}
                        onChange={e => {
                          setSearch(e.target.value)
                          setSelectedEmployee(null)
                          setDropdownOpen(true)
                        }}
                        onFocus={() => setDropdownOpen(true)}
                        placeholder="Cari nama karyawan..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                      />
                      {selectedEmployee && (
                        <button
                          onClick={() => { setSelectedEmployee(null); setSearch(''); setQrData(null) }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {dropdownOpen && !selectedEmployee && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                        {filtered.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-400 text-center">Tidak ditemukan</div>
                        ) : (
                          filtered.map(emp => (
                            <button
                              key={emp.id}
                              onClick={() => {
                                setSelectedEmployee(emp)
                                setSearch('')
                                setDropdownOpen(false)
                                setQrData(null)
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-teal-50 transition-colors text-left"
                            >
                              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-600 shrink-0">
                                {emp.full_name[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{emp.full_name}</p>
                                <p className="text-xs text-gray-400">
                                  {emp.employee_id && <span className="mr-2">{emp.employee_id}</span>}
                                  {emp.position}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Type Selection */}
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => setQrType('checkin')}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
                        qrType === 'checkin'
                          ? 'bg-teal-50 border-teal-300 text-teal-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      📥 Check-in
                    </button>
                    <button
                      onClick={() => setQrType('checkout')}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
                        qrType === 'checkout'
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      📤 Check-out
                    </button>
                  </div>

                  {/* Expiry */}
                  <div className="mt-4 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                    <label className="text-sm text-gray-600">Berlaku</label>
                    <select
                      value={expiryMinutes}
                      onChange={e => setExpiryMinutes(Number(e.target.value))}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    >
                      <option value={5}>5 menit</option>
                      <option value={15}>15 menit</option>
                      <option value={30}>30 menit</option>
                      <option value={60}>1 jam</option>
                      <option value={120}>2 jam</option>
                    </select>
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerate}
                    disabled={!selectedEmployee || loading}
                    className="mt-5 w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Membuat QR...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4" />
                        Generate QR Code
                      </>
                    )}
                  </button>

                  {error && (
                    <div className="mt-3 bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: QR Display */}
              <div className="space-y-4">
                {qrData ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
                    <h2 className="text-sm font-bold text-gray-800 mb-4">QR Code Siap</h2>

                    <div className="bg-teal-50 rounded-xl px-4 py-3 mb-4 inline-flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-teal-200 flex items-center justify-center text-sm font-bold text-teal-700">
                        {qrData.employee_name[0]?.toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-teal-800">{qrData.employee_name}</p>
                        <p className="text-xs text-teal-600">
                          {qrData.type === 'checkin' ? '📥 Check-in' : '📤 Check-out'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-4 mb-4 inline-block">
                      <img src={qrData.qr_data_url} alt="QR Code" className="w-56 h-56" />
                    </div>

                    <div className="mb-4">
                      <p className="text-xs text-gray-400 mb-1">Berlaku dalam</p>
                      <p className={`text-lg font-mono font-bold ${countdown === 'Kadaluarsa' ? 'text-red-500' : 'text-teal-600'}`}>
                        {countdown}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleCopyLink}
                        className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 text-green-500" />
                            Tersalin!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Salin Link
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => { setQrData(null); setError('') }}
                        className="flex-1 py-2.5 border border-teal-200 text-teal-700 rounded-xl text-sm font-medium hover:bg-teal-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Buat Baru
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <QrCode className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-400">Belum ada QR Code</h3>
                    <p className="text-xs text-gray-300 mt-1">Pilih karyawan lalu klik Generate</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Tokens Table */}
          {recentTokens.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  📋 QR Token Hari Ini
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Karyawan</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipe</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Waktu Buat</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Waktu Pakai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentTokens.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-[10px] font-bold text-teal-600 shrink-0">
                              {t.user?.[0]?.full_name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{t.user?.[0]?.full_name || '-'}</p>
                              <p className="text-xs text-gray-400">{t.user?.[0]?.employee_id || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${t.type === 'checkin' ? 'text-teal-600' : 'text-blue-600'}`}>
                            {t.type === 'checkin' ? '📥 Check-in' : '📤 Check-out'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{fmtTime(t.created_at)}</td>
                        <td className="px-4 py-3">{statusBadge(t.status)}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          {t.used_at ? fmtTime(t.used_at) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
