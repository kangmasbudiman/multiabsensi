'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'

interface Org {
  id: string
  name: string
  company_code: string
  address?: string
  industry?: string
  website?: string
  owner_name: string
  owner_email: string
  owner_phone?: string
  logo_url?: string
}

interface Announcement {
  id: string
  content: string
  is_active: boolean
  created_at: string
}

interface Props {
  org: Org | null
  announcements: Announcement[]
  orgId: string
}

const tabs = [
  { id: 'info', label: 'Informasi Perusahaan', icon: '🏢' },
  { id: 'qr', label: 'QR Absen', icon: '📱' },
  { id: 'announcements', label: 'Pengumuman', icon: '📢' },
]

export default function CompanySettingsClient({ org, announcements: initAnnouncements, orgId }: Props) {
  const [activeTab, setActiveTab] = useState('info')
  const [announcements, setAnnouncements] = useState(initAnnouncements)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Pengaturan Perusahaan</h1>
        <p className="text-sm text-gray-400 mt-0.5">Kelola profil dan konfigurasi perusahaan Anda</p>
      </div>

      {/* Company badge */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-500 rounded-2xl p-5 flex items-center gap-4">
        {org?.logo_url ? (
          <img src={org.logo_url} alt="Logo" className="w-14 h-14 rounded-xl object-cover shadow-md shrink-0" />
        ) : (
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl shrink-0">
            🏢
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold text-white">{org?.name ?? '-'}</h2>
          <p className="text-teal-100 text-sm">{org?.industry ?? 'Belum diisi'}</p>
          <span className="inline-block mt-1 bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full tracking-widest">
            {org?.company_code}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-teal-700 bg-teal-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'info' && <CompanyInfoTab org={org} orgId={orgId} />}
          {activeTab === 'qr' && <QrAbsenTab companyCode={org?.company_code ?? ''} orgName={org?.name ?? ''} />}
          {activeTab === 'announcements' && (
            <AnnouncementsTab
              announcements={announcements}
              orgId={orgId}
              onChange={setAnnouncements}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function CompanyInfoTab({ org, orgId }: { org: Org | null; orgId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({
    name: org?.name ?? '',
    address: org?.address ?? '',
    industry: org?.industry ?? '',
    website: org?.website ?? '',
    owner_name: org?.owner_name ?? '',
    owner_email: org?.owner_email ?? '',
    owner_phone: org?.owner_phone ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoUrl, setLogoUrl] = useState(org?.logo_url ?? '')

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'Ukuran file maksimal 2MB' })
      return
    }

    setLogoUploading(true)
    setMsg(null)

    try {
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `${orgId}/logo.${ext}`

      // Delete old logo first
      if (logoUrl) {
        const oldPath = logoUrl.split('/company-logos/')[1]?.split('?')[0]
        if (oldPath) {
          await supabase.storage.from('company-logos').remove([oldPath])
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(path)
      const publicUrl = urlData.publicUrl + '?t=' + Date.now()

      const { error: updateError } = await supabase
        .from('organizations')
        .update({ logo_url: publicUrl })
        .eq('id', orgId)

      if (updateError) throw updateError

      setLogoUrl(publicUrl)
      setMsg({ type: 'success', text: 'Logo berhasil diupload!' })
      router.refresh()
    } catch {
      setMsg({ type: 'error', text: 'Gagal mengupload logo' })
    } finally {
      setLogoUploading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setMsg(null)
    const supabase = createClient()
    const { error } = await supabase.from('organizations').update(form).eq('id', orgId)
    setMsg(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Data perusahaan berhasil disimpan!' })
    if (!error) router.refresh()
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      {/* Logo Upload */}
      <div className="flex items-center gap-5 p-4 bg-gray-50/80 rounded-2xl border border-gray-100">
        <div className="relative group">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-200 shadow-sm" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-gray-300 flex items-center justify-center">
              <span className="text-3xl">🏢</span>
            </div>
          )}
          <label className={`absolute inset-0 rounded-2xl flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${logoUploading ? 'pointer-events-none' : ''}`}>
            {logoUploading ? (
              <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="text-white text-xs font-medium">📷 Ganti</span>
            )}
          </label>
          <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">Logo Perusahaan</p>
          <p className="text-xs text-gray-400 mt-0.5">Klik logo untuk mengubah · PNG, JPG maks. 2MB</p>
          <p className="text-xs text-gray-400">Logo akan tampil di sidebar dan halaman login</p>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-gray-800">Informasi Perusahaan</h2>
        <p className="text-sm text-gray-400 mt-0.5">Perbarui data dan profil perusahaan</p>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm ${msg.type === 'success' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { key: 'name', label: 'Nama Perusahaan', placeholder: 'PT. Contoh Indonesia' },
          { key: 'industry', label: 'Industri', placeholder: 'Teknologi, Manufaktur, dll' },
          { key: 'address', label: 'Alamat', placeholder: 'Jl. Contoh No. 1, Jakarta' },
          { key: 'website', label: 'Website', placeholder: 'https://perusahaan.com' },
          { key: 'owner_name', label: 'Nama Pemilik/PIC', placeholder: 'Nama lengkap' },
          { key: 'owner_email', label: 'Email PIC', placeholder: 'email@perusahaan.com' },
          { key: 'owner_phone', label: 'Telepon PIC', placeholder: '+62 812 xxxx xxxx' },
        ].map(field => (
          <div key={field.key} className={field.key === 'address' ? 'sm:col-span-2' : ''}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}</label>
            <input
              type="text"
              value={form[field.key as keyof typeof form]}
              onChange={e => setForm({ ...form, [field.key]: e.target.value })}
              placeholder={field.placeholder}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-gray-50/50"
            />
          </div>
        ))}
      </div>

      {/* Kode perusahaan (readonly) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Kode Perusahaan</label>
        <div className="flex items-center gap-3 px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-sm">
          <span className="font-bold tracking-widest text-teal-700">{org?.company_code}</span>
          <span className="text-xs text-gray-400">— tidak dapat diubah</span>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </div>
  )
}

function QrAbsenTab({ companyCode, orgName }: { companyCode: string; orgName: string }) {
  const [origin, setOrigin] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState<'qr' | 'poster' | null>(null)

  const absenUrl = origin ? `${origin}/absen?code=${encodeURIComponent(companyCode)}` : ''

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    if (!absenUrl) return
    QRCode.toDataURL(absenUrl, { width: 512, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#0f766e', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => {})
  }, [absenUrl])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(absenUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const triggerDownload = (canvas: HTMLCanvasElement, filename: string) => {
    const link = document.createElement('a')
    link.download = filename
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const handleDownloadQr = async () => {
    if (!qrDataUrl) return
    setDownloading('qr')
    try {
      const img = new Image()
      img.src = qrDataUrl
      await new Promise(r => { img.onload = r })
      const padding = 60
      const headerH = 110
      const footerH = 80
      const W = img.width + padding * 2
      const H = img.height + padding * 2 + headerH + footerH
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)
      // Header
      ctx.fillStyle = '#0f766e'
      ctx.font = 'bold 36px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('ABSENSI', W / 2, padding + 36)
      ctx.fillStyle = '#1f2937'
      ctx.font = '600 28px system-ui, sans-serif'
      ctx.fillText(orgName || 'Perusahaan Anda', W / 2, padding + 76)
      // QR
      ctx.drawImage(img, padding, padding + headerH)
      // Footer
      ctx.fillStyle = '#6b7280'
      ctx.font = '22px system-ui, sans-serif'
      ctx.fillText('Scan dengan kamera HP untuk absensi', W / 2, padding + headerH + img.height + 38)
      ctx.fillStyle = '#9ca3af'
      ctx.font = '18px system-ui, sans-serif'
      ctx.fillText('© ' + new Date().getFullYear() + ' ' + (orgName || ''), W / 2, padding + headerH + img.height + 64)

      triggerDownload(canvas, `qr-absen-${companyCode}.png`)
    } catch {}
    setDownloading(null)
  }

  const handleDownloadPoster = async () => {
    if (!qrDataUrl) return
    setDownloading('poster')
    try {
      const qrImg = new Image()
      qrImg.src = qrDataUrl
      await new Promise(r => { qrImg.onload = r })

      // A4 portrait @ ~110 DPI
      const W = 900
      const H = 1280
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')!

      // Background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)

      // Top accent bar
      ctx.fillStyle = '#0f766e'
      ctx.fillRect(0, 0, W, 16)

      // Header
      ctx.textAlign = 'center'
      ctx.fillStyle = '#0f766e'
      ctx.font = 'bold 64px system-ui, sans-serif'
      ctx.fillText('ABSENSI', W / 2, 110)
      ctx.fillStyle = '#1f2937'
      ctx.font = '600 36px system-ui, sans-serif'
      ctx.fillText(orgName || 'Perusahaan Anda', W / 2, 160)

      // QR card (white box with shadow border)
      const qrSize = 440
      const qrX = (W - qrSize) / 2
      const qrY = 210
      ctx.fillStyle = '#f9fafb'
      ctx.fillRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40)
      ctx.strokeStyle = '#d1d5db'
      ctx.lineWidth = 2
      ctx.strokeRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40)
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

      // Caption under QR
      ctx.fillStyle = '#6b7280'
      ctx.font = '24px system-ui, sans-serif'
      ctx.fillText('📷 Arahkan kamera HP ke QR ini', W / 2, qrY + qrSize + 55)

      // Instructions box
      const boxY = qrY + qrSize + 95
      const boxH = 360
      ctx.fillStyle = '#f0fdfa'
      ctx.fillRect(60, boxY, W - 120, boxH)
      ctx.strokeStyle = '#99f6e4'
      ctx.lineWidth = 2
      ctx.strokeRect(60, boxY, W - 120, boxH)

      // Box header
      ctx.fillStyle = '#0f766e'
      ctx.font = 'bold 30px system-ui, sans-serif'
      ctx.fillText('CARA ABSENSI', W / 2, boxY + 48)

      // Steps
      const steps = [
        { icon: '1️⃣', text: 'Buka kamera HP atau aplikasi scanner QR' },
        { icon: '2️⃣', text: 'Arahkan ke QR code di atas — tunggu notifikasi' },
        { icon: '3️⃣', text: 'Klik link yang muncul di layar HP' },
        { icon: '4️⃣', text: 'Klik "Izinkan" saat diminta akses kamera' },
        { icon: '5️⃣', text: 'Klik "Izinkan" saat diminta akses lokasi' },
        { icon: '6️⃣', text: 'Hadapkan wajah ke layar sampai terdeteksi' },
      ]
      ctx.textAlign = 'left'
      steps.forEach((step, i) => {
        const y = boxY + 100 + i * 40
        ctx.font = '24px system-ui, sans-serif'
        ctx.fillStyle = '#0f766e'
        ctx.fillText(step.icon, 110, y)
        ctx.fillStyle = '#1f2937'
        ctx.font = '22px system-ui, sans-serif'
        ctx.fillText(step.text, 160, y)
      })

      // Footer
      ctx.textAlign = 'center'
      ctx.fillStyle = '#9ca3af'
      ctx.font = '18px system-ui, sans-serif'
      ctx.fillText('© ' + new Date().getFullYear() + ' ' + (orgName || '') + ' · Powered by AbsenKu', W / 2, H - 40)

      triggerDownload(canvas, `poster-absen-${companyCode}.png`)
    } catch {}
    setDownloading(null)
  }

  if (!companyCode) {
    return (
      <div className="text-center py-10 text-gray-500 text-sm">
        Kode perusahaan belum tersedia.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-gray-800">QR Code Absensi</h2>
        <p className="text-sm text-gray-400 mt-0.5">Cetak dan tempel di lokasi absensi. Karyawan scan → langsung scan wajah.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* QR preview */}
        <div className="flex flex-col items-center p-6 bg-gradient-to-br from-teal-50 to-gray-50 rounded-2xl border border-teal-100">
          <p className="text-xs uppercase tracking-widest text-teal-700 font-bold mb-1">ABSENSI</p>
          <p className="text-sm font-semibold text-gray-800 mb-3 text-center">{orgName || 'Perusahaan Anda'}</p>
          <div className="bg-white p-3 rounded-xl shadow-sm">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Absensi" className="w-56 h-56" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-gray-400">Memuat...</div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center max-w-[18rem]">
            Scan dengan kamera HP untuk absensi
          </p>
        </div>

        {/* Info & actions */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Kode Perusahaan</label>
            <div className="px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-base font-bold tracking-widest text-teal-700">
              {companyCode}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Link Absensi</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={absenUrl}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-xs text-gray-600 font-mono"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs hover:bg-gray-50 text-gray-700 font-medium shrink-0"
              >
                {copied ? '✓ Tersalin' : 'Salin'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownloadQr}
              disabled={!qrDataUrl || downloading !== null}
              className="px-4 py-3 bg-white border-2 border-teal-200 hover:border-teal-400 disabled:opacity-60 text-teal-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span>⬇️</span> {downloading === 'qr' ? '...' : 'QR Saja'}
            </button>
            <button
              onClick={handleDownloadPoster}
              disabled={!qrDataUrl || downloading !== null}
              className="px-4 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span>🖼️</span> {downloading === 'poster' ? '...' : 'Poster A4 + Instruksi'}
            </button>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
            <p className="font-semibold">⚠️ Penting</p>
            <p>Fitur kamera & GPS browser hanya jalan di <strong>HTTPS</strong> (atau localhost). Pastikan domain aplikasi sudah pakai SSL sebelum QR ini dipakai.</p>
          </div>

          <div className="text-xs text-gray-500 space-y-1.5 leading-relaxed">
            <p className="font-semibold text-gray-700">Pilihan download:</p>
            <p>• <strong>QR Saja</strong> — gambar QR + header nama perusahaan. Cocok untuk tempel di kartu/marker kecil.</p>
            <p>• <strong>Poster A4 + Instruksi</strong> — 1 halaman A4 berisi QR besar + 6 langkah cara absen. Print, tempel di dinding.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnnouncementsTab({ announcements, orgId, onChange }: {
  announcements: Announcement[]
  orgId: string
  onChange: (data: Announcement[]) => void
}) {
  const [newText, setNewText] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleAdd = async () => {
    if (!newText.trim()) return
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('announcements')
      .insert({ org_id: orgId, content: newText.trim() })
      .select()
      .single()
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      onChange([data, ...announcements])
      setNewText('')
      setMsg({ type: 'success', text: 'Pengumuman ditambahkan!' })
    }
    setLoading(false)
  }

  const handleToggle = async (item: Announcement) => {
    const supabase = createClient()
    await supabase.from('announcements').update({ is_active: !item.is_active }).eq('id', item.id)
    onChange(announcements.map(a => a.id === item.id ? { ...a, is_active: !a.is_active } : a))
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('announcements').delete().eq('id', id)
    onChange(announcements.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-gray-800">Kelola Pengumuman</h2>
        <p className="text-sm text-gray-400 mt-0.5">Teks akan berjalan di dashboard sebagai running text</p>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm ${msg.type === 'success' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Input tambah */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Tulis pengumuman baru..."
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-gray-50/50"
        />
        <button
          onClick={handleAdd}
          disabled={loading || !newText.trim()}
          className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors shrink-0"
        >
          + Tambah
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {announcements.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">Belum ada pengumuman</div>
        )}
        {announcements.map(item => (
          <div key={item.id} className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
            <span className="text-lg shrink-0 mt-0.5">📢</span>
            <p className={`flex-1 text-sm ${item.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
              {item.content}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {/* Toggle aktif */}
              <button
                onClick={() => handleToggle(item)}
                title={item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                className={`w-9 h-5 rounded-full transition-colors relative ${item.is_active ? 'bg-teal-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${item.is_active ? 'left-4' : 'left-0.5'}`} />
              </button>
              {/* Hapus */}
              <button
                onClick={() => handleDelete(item.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-sm"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
