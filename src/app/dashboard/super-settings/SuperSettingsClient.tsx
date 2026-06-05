'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import InspectButton from '@/components/admin/InspectButton'

interface Org {
  id: string
  name: string
  company_code: string
  app_name: string
  owner_name: string
  owner_email: string
  owner_phone?: string
  owner_position?: string
  industry?: string
  address?: string
  employee_count_range?: string
  is_active: boolean
  status: string
  registered_at: string
  rejected_reason?: string
}

interface Props {
  orgs: Org[]
  pending: Org[]
  rejected: Org[]
  totalUsers: number
  approverId: string
}

const tabs = [
  { id: 'pending', label: 'Menunggu Verifikasi', icon: '⏳' },
  { id: 'approved', label: 'Perusahaan Aktif', icon: '✅' },
  { id: 'rejected', label: 'Ditolak', icon: '❌' },
  { id: 'branding', label: 'Branding', icon: '🎨' },
]

export default function SuperSettingsClient({ orgs, pending, rejected, totalUsers, approverId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('pending')
  const [platformName, setPlatformName] = useState(() => orgs[0]?.app_name || 'AbsenKu')
  const [savingName, setSavingName] = useState(false)

  const totalOrgs = orgs.length + pending.length + rejected.length

  const handleSavePlatformName = async () => {
    const val = platformName.trim()
    if (!val) return alert('Nama platform tidak boleh kosong')
    setSavingName(true)
    try {
      // Update ALL organizations (not just approved)
      const { error } = await supabase
        .from('organizations')
        .update({ app_name: val })
        .neq('id', '00000000-0000-0000-0000-000000000000') // update all rows
      if (error) {
        alert('Gagal menyimpan: ' + error.message)
        return
      }
      window.location.reload()
    } catch (e) {
      alert('Error: ' + (e instanceof Error ? e.message : 'Gagal menyimpan'))
    }
    setSavingName(false)
  }

  return (
    <div className="p-6 h-full flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pengaturan Platform</h1>
          <p className="text-sm text-gray-400 mt-0.5">Kelola verifikasi dan perusahaan yang terdaftar di {platformName}</p>
        </div>
      </div>

      {/* Platform Name Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-lg shadow-teal-500/20">
            {platformName[0]?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-700">Nama Platform</p>
            <p className="text-xs text-gray-400 mt-0.5">Nama ini tampil di sidebar, login, register, dan halaman absensi</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={platformName}
              onChange={e => setPlatformName(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold w-52 focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Nama platform..."
            />
            <button
              onClick={handleSavePlatformName}
              disabled={savingName || !platformName.trim()}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {savingName ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-5 text-white">
          <p className="text-teal-100 text-sm">Total Perusahaan</p>
          <p className="text-4xl font-bold mt-1">{totalOrgs}</p>
          <p className="text-teal-200 text-xs mt-2">Semua status</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl p-5 text-white">
          <p className="text-yellow-100 text-sm">Menunggu Verifikasi</p>
          <p className="text-4xl font-bold mt-1">{pending.length}</p>
          <p className="text-yellow-200 text-xs mt-2">Perlu ditinjau</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white">
          <p className="text-green-100 text-sm">Perusahaan Aktif</p>
          <p className="text-4xl font-bold mt-1">{orgs.length}</p>
          <p className="text-green-200 text-xs mt-2">Sudah disetujui</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white">
          <p className="text-indigo-100 text-sm">Total Pengguna</p>
          <p className="text-4xl font-bold mt-1">{totalUsers}</p>
          <p className="text-indigo-200 text-xs mt-2">Semua role</p>
        </div>
      </div>

      {/* Tab panel */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-0">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors relative whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-teal-700 bg-teal-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.id === 'pending' && pending.length > 0 && (
                <span className="ml-1 bg-orange-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {pending.length}
                </span>
              )}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1">
          {activeTab === 'pending' && <PendingTab items={pending} approverId={approverId} />}
          {activeTab === 'approved' && <ApprovedTab items={orgs} />}
          {activeTab === 'rejected' && <RejectedTab items={rejected} />}
          {activeTab === 'branding' && <BrandingTab orgs={orgs} />}
        </div>
      </div>
    </div>
  )
}

function PendingTab({ items, approverId }: { items: Org[]; approverId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [result, setResult] = useState<{ id: string; type: 'success' | 'error'; msg: string } | null>(null)

  const handleApprove = async (org: Org) => {
    setLoading(org.id)
    setResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('approve-company', {
        body: { org_id: org.id, action: 'approve', approved_by: approverId },
      })
      if (error) {
        const body = await (error as { context?: Response }).context?.json().catch(() => null)
        throw new Error(body?.error ?? error.message)
      }
      if (data?.error) throw new Error(data.error)
      setResult({
        id: org.id,
        type: 'success',
        msg: `✅ Disetujui! Email: ${data.admin_email} | Password sementara: ${data.temp_password} | Kode: ${data.company_code}`,
      })
      router.refresh()
    } catch (e) {
      setResult({ id: org.id, type: 'error', msg: (e as Error).message })
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return
    setLoading(rejectId)
    try {
      const { data, error } = await supabase.functions.invoke('approve-company', {
        body: { org_id: rejectId, action: 'reject', rejected_reason: rejectReason },
      })
      if (error) {
        const body = await (error as { context?: Response }).context?.json().catch(() => null)
        throw new Error(body?.error ?? error.message)
      }
      if (data?.error) throw new Error(data.error)
      setRejectId(null)
      setRejectReason('')
      router.refresh()
    } catch (e) {
      setResult({ id: rejectId, type: 'error', msg: (e as Error).message })
    } finally {
      setLoading(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-center">
        <div>
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-gray-500 font-medium">Tidak ada pendaftaran yang menunggu</p>
          <p className="text-gray-400 text-sm mt-1">Semua pendaftaran sudah ditinjau</p>
        </div>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-50">
      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="font-bold text-gray-800 mb-1">Tolak Pendaftaran</h3>
            <p className="text-sm text-gray-500 mb-4">Berikan alasan penolakan yang jelas</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Contoh: Data perusahaan tidak lengkap..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setRejectId(null); setRejectReason('') }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || !!loading}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold">
                {loading ? 'Menolak...' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {items.map(org => (
        <div key={org.id} className="p-5 hover:bg-gray-50/50 transition-colors">
          {result?.id === org.id && (
            <div className={`mb-3 px-4 py-3 rounded-xl text-sm ${result.type === 'success' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {result.msg}
            </div>
          )}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold shrink-0">
              {org.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-800">{org.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <span className="text-xs text-gray-500">👤 {org.owner_name} — {org.owner_position}</span>
                    <span className="text-xs text-gray-500">✉️ {org.owner_email}</span>
                    {org.owner_phone && <span className="text-xs text-gray-500">📱 {org.owner_phone}</span>}
                    {org.industry && <span className="text-xs text-gray-500">🏭 {org.industry}</span>}
                    {org.employee_count_range && <span className="text-xs text-gray-500">👥 {org.employee_count_range} karyawan</span>}
                    {org.address && <span className="text-xs text-gray-500">📍 {org.address}</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Daftar: {new Date(org.registered_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setRejectId(org.id); setRejectReason('') }}
                    disabled={!!loading}
                    className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Tolak
                  </button>
                  <button
                    onClick={() => handleApprove(org)}
                    disabled={loading === org.id}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    {loading === org.id ? 'Memproses...' : 'Setujui'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ApprovedTab({ items }: { items: Org[] }) {
  if (items.length === 0) return (
    <div className="flex items-center justify-center py-20 text-sm text-gray-400">Belum ada perusahaan aktif</div>
  )
  return (
    <>
      <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 grid grid-cols-12 gap-4">
        <p className="col-span-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Perusahaan</p>
        <p className="col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">PIC</p>
        <p className="col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kontak</p>
        <p className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Status</p>
      </div>
      <div className="divide-y divide-gray-50">
        {items.map(org => (
          <div key={org.id} className="px-5 py-4 grid grid-cols-12 gap-4 items-center hover:bg-gray-50/50 transition-colors">
            <div className="col-span-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600 font-bold text-sm shrink-0">
                {org.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{org.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold text-teal-600 tracking-widest">{org.company_code}</span>
                  {org.industry && <span className="text-xs text-gray-400 truncate">• {org.industry}</span>}
                </div>
              </div>
            </div>
            <div className="col-span-3">
              <p className="text-sm text-gray-700 font-medium truncate">{org.owner_name}</p>
              <p className="text-xs text-gray-400 capitalize">{org.owner_position ?? 'Owner'}</p>
            </div>
            <div className="col-span-3">
              <p className="text-xs text-gray-500 truncate">{org.owner_email}</p>
              {org.owner_phone && <p className="text-xs text-gray-400">{org.owner_phone}</p>}
            </div>
            <div className="col-span-2 flex justify-end items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700">Aktif</span>
              <InspectButton orgId={org.id} orgName={org.name} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function RejectedTab({ items }: { items: Org[] }) {
  if (items.length === 0) return (
    <div className="flex items-center justify-center py-20 text-sm text-gray-400">Tidak ada pendaftaran yang ditolak</div>
  )
  return (
    <div className="divide-y divide-gray-50">
      {items.map(org => (
        <div key={org.id} className="p-5 hover:bg-gray-50/50 transition-colors">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-500 font-bold shrink-0">
              {org.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{org.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{org.owner_name} — {org.owner_email}</p>
              {org.rejected_reason && (
                <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-600"><strong>Alasan:</strong> {org.rejected_reason}</p>
                </div>
              )}
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-600 shrink-0">Ditolak</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function BrandingTab({ orgs }: { orgs: Org[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const o of orgs) m[o.id] = o.app_name || 'AbsenKu'
    return m
  })

  const handleSave = async (orgId: string) => {
    const val = editValues[orgId]?.trim()
    if (!val) return alert('Nama aplikasi tidak boleh kosong')
    setSaving(orgId)
    const { error } = await supabase
      .from('organizations')
      .update({ app_name: val })
      .eq('id', orgId)
    if (error) {
      alert('Gagal menyimpan: ' + error.message)
    }
    setSaving(null)
    router.refresh()
  }

  if (orgs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        Belum ada perusahaan aktif
      </div>
    )
  }

  return (
    <div>
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">Nama Aplikasi per Perusahaan</p>
        <p className="text-xs text-gray-400 mt-0.5">Ubah nama yang tampil di sidebar, halaman login, dan absensi publik</p>
      </div>
      <div className="divide-y divide-gray-50">
        {orgs.map(org => (
          <div key={org.id} className="px-5 py-4 flex items-center gap-4">
            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600 font-bold text-sm shrink-0">
              {editValues[org.id]?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm truncate">{org.name}</p>
              <p className="text-xs text-gray-400">{org.company_code}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editValues[org.id] ?? ''}
                onChange={e => setEditValues(prev => ({ ...prev, [org.id]: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium w-48 focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="Nama aplikasi..."
              />
              <button
                onClick={() => handleSave(org.id)}
                disabled={saving === org.id || (editValues[org.id] ?? '') === (org.app_name || 'AbsenKu')}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {saving === org.id ? '...' : 'Simpan'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
