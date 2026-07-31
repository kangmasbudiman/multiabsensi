'use client'

import { useState, useEffect } from 'react'

type IpEntry = {
  id: string
  ip_address: string
  label: string | null
  created_at: string
}

export default function NetworkClient({ orgCode }: { orgCode: string }) {
  const [ips, setIps] = useState<IpEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [newIp, setNewIp] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Build absen URL pakai window.location.origin supaya selalu benar tanpa env var.
  const absenUrl = typeof window !== 'undefined' && orgCode
    ? `${window.location.origin}/absen-kantor?code=${orgCode}`
    : ''

  const fetchIps = async () => {
    try {
      const res = await fetch('/api/office-ips')
      const data = await res.json()
      setIps(data.ips ?? [])
    } catch {
      setError('Gagal memuat data IP')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchIps() }, [])

  const detectMyIp = async () => {
    setDetecting(true)
    setError('')
    try {
      const res = await fetch('https://api.ipify.org?format=json')
      const data = await res.json()
      setNewIp(data.ip)
    } catch {
      setError('Gagal mendeteksi IP. Pastikan terhubung internet, atau masukkan manual.')
    } finally {
      setDetecting(false)
    }
  }

  const addIp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newIp.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/office-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ip_address: newIp.trim(), label: newLabel.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menambah IP')
      setNewIp('')
      setNewLabel('')
      await fetchIps()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal')
    } finally {
      setSaving(false)
    }
  }

  const removeIp = async (id: string) => {
    if (!confirm('Hapus IP ini dari whitelist?')) return
    setError('')
    try {
      const res = await fetch('/api/office-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ip_id: id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal hapus')
      }
      await fetchIps()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal')
    }
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(absenUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Jaringan Kantor (IP Whitelist)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Daftarkan IP public kantor untuk mengaktifkan mode absensi WiFi. Karyawan yang absen dari jaringan kantor tidak perlu GPS — verifikasi via IP.
        </p>
      </div>

      {/* Public Link */}
      <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl border border-teal-100 p-5">
        <h2 className="text-sm font-bold text-teal-900 uppercase tracking-wide mb-2">Link Absensi WiFi</h2>
        <p className="text-xs text-teal-800 mb-3 leading-relaxed">
          Bagikan link ini atau cetak sebagai QR code. Hanya bisa dipakai dari jaringan yang IP-nya terdaftar di bawah.
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={absenUrl}
            placeholder={orgCode ? '' : 'Belum tersedia (hubungi super admin)'}
            className="flex-1 px-3 py-2 bg-white border border-teal-200 rounded-lg text-sm font-mono text-gray-700"
          />
          <button
            onClick={copyUrl}
            disabled={!absenUrl}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold whitespace-nowrap"
          >
            {copied ? '✓ Tersalin' : 'Salin'}
          </button>
        </div>
        {absenUrl && (
          <p className="text-xs text-teal-700 mt-3">
            💡 Tip: cetak QR dari link ini (misal di <em>qr-code-generator.com</em>) dan tempel di resepsionis.
          </p>
        )}
      </div>

      {/* Form Tambah IP */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Tambah IP Whitelist</h2>
        <form onSubmit={addIp} className="space-y-3">
          <div className="flex gap-2">
            <input
              value={newIp}
              onChange={e => setNewIp(e.target.value)}
              placeholder="Contoh: 202.43.123.45"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
            />
            <button
              type="button"
              onClick={detectMyIp}
              disabled={detecting}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-lg text-sm font-semibold whitespace-nowrap"
            >
              {detecting ? '⏳ Mendeteksi...' : '📍 Deteksi IP Saya'}
            </button>
          </div>
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Label opsional (contoh: ISP Utama, WiFi Lobi, Cabang A)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving || !newIp.trim()}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
          >
            {saving ? 'Menyimpan...' : '+ Tambah ke Whitelist'}
          </button>
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong>Penting:</strong> klik <em>&quot;Deteksi IP Saya&quot;</em> saat Anda berada di jaringan kantor (WiFi/LAN kantor).
            IP yang terdeteksi adalah IP public yang akan dipakai server untuk verifikasi karyawan.
          </p>
        </form>
      </div>

      {/* Daftar IP */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">IP Terdaftar</h2>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{ips.length} IP</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Memuat...</div>
        ) : ips.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-3xl mb-2">🌐</p>
            <p className="text-sm font-medium text-gray-700 mb-1">Belum ada IP terdaftar</p>
            <p className="text-xs text-gray-500">Tambahkan IP public kantor untuk mengaktifkan mode WiFi</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {ips.map(ip => (
              <div key={ip.id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-gray-900">{ip.ip_address}</p>
                  {ip.label && <p className="text-xs text-gray-600 truncate">{ip.label}</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Ditambahkan {new Date(ip.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => removeIp(ip.id)}
                  className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
