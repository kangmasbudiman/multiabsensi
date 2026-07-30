'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { OfficeLocation } from '@/types'

const MapPicker = dynamic(() => import('@/components/admin/MapPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 rounded-xl bg-gray-100 flex items-center justify-center text-sm text-gray-400 border border-gray-200">
      Memuat peta...
    </div>
  ),
})

const DEFAULT_LAT = -6.2
const DEFAULT_LNG = 106.816

interface Updater {
  id: string
  full_name: string
  role: string
}

interface LocationRow extends OfficeLocation {
  updated_at: string | null
  last_action: string | null
  updated_by: Updater | null
}

interface AuditEntry {
  id: string
  location_id: string
  location_name: string
  action: 'create' | 'update' | 'delete' | 'toggle' | 'legacy'
  changes: Record<string, Record<string, unknown>>
  changed_by_name: string | null
  changed_by_role: string | null
  created_at: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'baru saja'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatChanges(action: string, changes: Record<string, Record<string, unknown>>): string {
  if (action === 'create') {
    const to = changes.to ?? {}
    const parts: string[] = []
    if (to.latitude != null && to.longitude != null) {
      parts.push(`koord ${(to.latitude as number).toFixed(5)}, ${(to.longitude as number).toFixed(5)}`)
    }
    if (to.radius_meters != null) parts.push(`radius ${to.radius_meters}m`)
    return `Dibuat${parts.length ? ': ' + parts.join(' · ') : ''}`
  }
  if (action === 'delete') {
    const from = changes.from ?? {}
    return `Dihapus (${from.name ?? '-'})`
  }
  if (action === 'toggle') {
    const from = changes.from?.is_active
    const to = changes.to?.is_active
    return `${from ? 'Aktif' : 'Nonaktif'} → ${to ? 'Aktif' : 'Nonaktif'}`
  }
  if (action === 'update') {
    const from = changes.from ?? {}
    const to = changes.to ?? {}
    const diffs: string[] = []
    if (from.name !== to.name) diffs.push(`nama: "${from.name}" → "${to.name}"`)
    if (from.latitude !== to.latitude || from.longitude !== to.longitude) {
      diffs.push(`koord diubah`)
    }
    if (from.radius_meters !== to.radius_meters) {
      diffs.push(`radius: ${from.radius_meters}m → ${to.radius_meters}m`)
    }
    return diffs.length ? diffs.join(' · ') : 'tidak ada perubahan'
  }
  return '-'
}

const ACTION_META: Record<string, { icon: string; color: string }> = {
  create:  { icon: '✨', color: 'text-teal-600' },
  update:  { icon: '✏️', color: 'text-blue-600' },
  toggle:  { icon: '🔄', color: 'text-amber-600' },
  delete:  { icon: '🗑️', color: 'text-red-600' },
  legacy:  { icon: '📋', color: 'text-gray-400' },
}

export default function LocationsClient({ locations }: { locations: OfficeLocation[] }) {
  const router = useRouter()
  const [rows, setRows] = useState<LocationRow[]>(() =>
    locations.map(l => ({
      ...l,
      updated_at: null,
      last_action: null,
      updated_by: null,
    }))
  )
  const [showModal, setShowModal] = useState(false)
  const [editLoc, setEditLoc] = useState<OfficeLocation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [historyModal, setHistoryModal] = useState<{ locationId: string; locationName: string } | null>(null)
  const [audits, setAudits] = useState<AuditEntry[]>([])
  const [auditsLoading, setAuditsLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    latitude: DEFAULT_LAT,
    longitude: DEFAULT_LNG,
    radius_meters: 100,
  })

  // Pull fresh data (with audit info) dari API
  const refreshFromApi = useCallback(async () => {
    try {
      const res = await fetch('/api/office-locations')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.locations)) {
        setRows(data.locations)
      }
    } catch {
      // silent — fallback ke prop locations
    }
  }, [])

  useEffect(() => {
    // Pull data with audit info dari API (initial load masih pakai prop SSR)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshFromApi()
  }, [refreshFromApi])

  const openAdd = () => {
    setEditLoc(null)
    setForm({ name: '', latitude: DEFAULT_LAT, longitude: DEFAULT_LNG, radius_meters: 100 })
    setShowModal(true)
  }

  const openEdit = (l: OfficeLocation) => {
    setEditLoc(l)
    setForm({ name: l.name, latitude: l.latitude, longitude: l.longitude, radius_meters: l.radius_meters })
    setShowModal(true)
  }

  const handleMapChange = useCallback((lat: number, lng: number) => {
    setForm(prev => ({ ...prev, latitude: lat, longitude: lng }))
  }, [])

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung geolocation.')
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }))
        setGeoLoading(false)
      },
      () => {
        alert('Gagal mendapatkan lokasi. Pastikan izin lokasi diaktifkan di browser.')
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const apiCall = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/office-locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan')
    return data
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const payload = {
        name: form.name,
        latitude: form.latitude,
        longitude: form.longitude,
        radius_meters: form.radius_meters,
      }
      if (editLoc) {
        await apiCall({ action: 'update', location_id: editLoc.id, payload })
      } else {
        await apiCall({ action: 'create', payload })
      }
      setShowModal(false)
      await refreshFromApi()
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleActive = async (loc: OfficeLocation) => {
    try {
      await apiCall({ action: 'toggle', location_id: loc.id })
      await refreshFromApi()
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengubah status')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus lokasi "${name}"? Tindakan ini dicatat di audit log.`)) return
    try {
      await apiCall({ action: 'delete', location_id: id })
      await refreshFromApi()
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus')
    }
  }

  const openHistory = async (locationId: string, locationName: string) => {
    setHistoryModal({ locationId, locationName })
    setAudits([])
    setAuditsLoading(true)
    try {
      const res = await fetch(`/api/office-locations/audit?location_id=${locationId}&limit=100`)
      const data = await res.json()
      if (res.ok) setAudits(data.audits ?? [])
    } catch {
      // silent
    } finally {
      setAuditsLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Lokasi Kantor</h1>
          <p className="text-sm text-gray-400 mt-0.5">Titik geofencing untuk validasi absensi · semua perubahan tercatat</p>
        </div>
        <button onClick={openAdd}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
          + Tambah Lokasi
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <p className="text-4xl mb-3">📍</p>
          <p className="text-gray-500 font-medium">Belum ada lokasi kantor</p>
          <p className="text-gray-400 text-sm mt-1">Tambahkan koordinat kantor untuk validasi absensi</p>
          <button onClick={openAdd} className="mt-4 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
            + Tambah Lokasi
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map(loc => {
            const updaterName = loc.updated_by?.full_name ?? 'Sistem'
            const updaterRole = loc.updated_by?.role ?? ''
            return (
              <div key={loc.id} className={`bg-white rounded-2xl shadow-sm border p-5 hover:shadow-md transition-shadow ${loc.is_active ? 'border-teal-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${loc.is_active ? 'bg-teal-100' : 'bg-gray-100'}`}>
                      📍
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{loc.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${loc.is_active ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
                        {loc.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={loc.is_active}
                      onClick={() => toggleActive(loc)}
                      title={loc.is_active ? 'Aktif — klik untuk nonaktifkan' : 'Nonaktif — klik untuk aktifkan'}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 ${
                        loc.is_active ? 'bg-teal-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          loc.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <button onClick={() => openEdit(loc)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg text-sm">✏️</button>
                    <button onClick={() => handleDelete(loc.id, loc.name)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg text-sm">🗑️</button>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm text-gray-500 mt-3 pt-3 border-t border-gray-50">
                  <p className="font-mono text-xs bg-gray-50 rounded-lg px-3 py-2">
                    {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                  </p>
                  <p className="text-xs">⭕ Radius geofence: <strong>{loc.radius_meters} meter</strong></p>
                </div>

                {/* Audit info — last change + history button */}
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-gray-500 min-w-0 flex-1">
                    {loc.updated_at ? (
                      <>
                        <span className="text-gray-400">Terakhir diubah:</span>{' '}
                        <span className="font-semibold text-gray-700">{updaterName}</span>
                        {updaterRole && <span className="text-gray-400"> · {updaterRole.replace('_', ' ')}</span>}
                        <span className="text-gray-400"> · {timeAgo(loc.updated_at)}</span>
                      </>
                    ) : (
                      <span className="text-gray-400">Belum ada riwayat perubahan</span>
                    )}
                  </div>
                  <button
                    onClick={() => openHistory(loc.id, loc.name)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors shrink-0"
                    title="Lihat riwayat semua perubahan lokasi ini"
                  >
                    📜 Riwayat
                  </button>
                </div>

                <a href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-teal-600 hover:underline font-medium">
                  Buka di Google Maps →
                </a>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-bold text-gray-800">{editLoc ? 'Edit Lokasi' : 'Tambah Lokasi Kantor'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lokasi *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Kantor Pusat, Cabang Jakarta..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Pilih Titik Lokasi *</label>
                  <button
                    type="button"
                    onClick={handleMyLocation}
                    disabled={geoLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {geoLoading ? (
                      <span className="animate-spin">⟳</span>
                    ) : '📡'}
                    {geoLoading ? 'Mendeteksi...' : 'Lokasi Saya'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-2">Klik pada peta atau drag marker untuk mengatur titik lokasi</p>
                <MapPicker
                  lat={form.latitude}
                  lng={form.longitude}
                  radius={form.radius_meters}
                  onChange={handleMapChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={form.latitude}
                    onChange={e => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="-6.200000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={form.longitude}
                    onChange={e => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="106.816000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Radius Geofence: <span className="text-teal-600 font-bold">{form.radius_meters} meter</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={form.radius_meters}
                  onChange={e => setForm({ ...form, radius_meters: parseInt(e.target.value) })}
                  className="w-full accent-teal-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>10m</span>
                  <span className="text-gray-500">Rekomendasi: 50–150m untuk gedung kantor</span>
                  <span>500m</span>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">
                  Batal
                </button>
                <button type="submit" disabled={isLoading}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold">
                  {isLoading ? 'Menyimpan...' : 'Simpan Lokasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center text-xl">📜</div>
                <div>
                  <h2 className="font-bold text-gray-800">Riwayat Perubahan</h2>
                  <p className="text-xs text-gray-400">{historyModal.locationName}</p>
                </div>
              </div>
              <button onClick={() => setHistoryModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {auditsLoading ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Memuat riwayat...
                </div>
              ) : audits.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-2">🗂️</p>
                  <p className="text-sm">Belum ada riwayat perubahan</p>
                </div>
              ) : (
                <ol className="relative border-l-2 border-gray-100 ml-2 space-y-4">
                  {audits.map((a, idx) => {
                    const meta = ACTION_META[a.action] ?? ACTION_META.legacy
                    return (
                      <li key={a.id} className="ml-6 relative">
                        {/* Timeline dot */}
                        <span className={`absolute -left-[34px] top-0.5 w-6 h-6 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center text-xs`}>
                          {meta.icon}
                        </span>
                        <div className="bg-gray-50 rounded-xl px-4 py-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>
                              {a.action}
                              {idx === 0 && <span className="ml-2 px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-[10px]">TERBARU</span>}
                            </span>
                            <span className="text-[11px] text-gray-400" title={formatDateTime(a.created_at)}>
                              {timeAgo(a.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{formatChanges(a.action, a.changes)}</p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            oleh <span className="font-semibold">{a.changed_by_name ?? 'Sistem'}</span>
                            {a.changed_by_role && <span className="text-gray-400"> · {a.changed_by_role.replace('_', ' ')}</span>}
                            <span className="text-gray-400"> · {formatDateTime(a.created_at)}</span>
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => setHistoryModal(null)}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
