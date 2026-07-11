'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

export default function LocationsClient({ locations, orgId }: { locations: OfficeLocation[]; orgId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [showModal, setShowModal] = useState(false)
  const [editLoc, setEditLoc] = useState<OfficeLocation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    latitude: DEFAULT_LAT,
    longitude: DEFAULT_LNG,
    radius_meters: 100,
  })

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const payload = {
      name: form.name,
      latitude: form.latitude,
      longitude: form.longitude,
      radius_meters: form.radius_meters,
      org_id: orgId,
    }
    if (editLoc) {
      await supabase.from('office_locations').update(payload).eq('id', editLoc.id)
    } else {
      await supabase.from('office_locations').insert(payload)
    }
    setIsLoading(false)
    setShowModal(false)
    router.refresh()
  }

  const toggleActive = async (loc: OfficeLocation) => {
    await supabase.from('office_locations').update({ is_active: !loc.is_active }).eq('id', loc.id)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus lokasi ini?')) return
    await supabase.from('office_locations').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Lokasi Kantor</h1>
          <p className="text-sm text-gray-400 mt-0.5">Titik geofencing untuk validasi absensi</p>
        </div>
        <button onClick={openAdd}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
          + Tambah Lokasi
        </button>
      </div>

      {locations.length === 0 ? (
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
          {locations.map(loc => (
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
                  <button onClick={() => handleDelete(loc.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg text-sm">🗑️</button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-gray-500 mt-3 pt-3 border-t border-gray-50">
                <p className="font-mono text-xs bg-gray-50 rounded-lg px-3 py-2">
                  {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                </p>
                <p className="text-xs">⭕ Radius geofence: <strong>{loc.radius_meters} meter</strong></p>
              </div>
              <a href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
                target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-teal-600 hover:underline font-medium">
                Buka di Google Maps →
              </a>
            </div>
          ))}
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

              {/* Map Section */}
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

              {/* Coordinates — editable manually */}
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
    </div>
  )
}
