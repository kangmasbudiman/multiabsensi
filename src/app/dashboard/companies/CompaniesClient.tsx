'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Company {
  id: string
  name: string
  company_code: string
  owner_name: string
  owner_email: string
  owner_phone?: string
  owner_position?: string
  industry?: string
  address?: string
  employee_count_range?: string
  status: string
  is_active: boolean
  registered_at: string
  approved_at?: string
  rejected_reason?: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'Semua Status' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
]

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

export default function CompaniesClient({ companies }: { companies: Company[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [industryFilter, setIndustryFilter] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Company | null>(null)
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null)
  const [resetting, setResetting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const PER_PAGE = 10

  const handleResetPassword = async (email: string) => {
    setResetting(true)
    setResetResult(null)
    const { data } = await supabase.functions.invoke('reset-user-password', {
      body: { email },
    })
    if (data?.new_password) {
      setResetResult({ email, password: data.new_password })
    }
    setResetting(false)
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    // Delete related profiles first
    await supabase.from('profiles').delete().eq('org_id', id)
    // Delete related data
    await supabase.from('shift_schedules').delete().eq('org_id', id)
    await supabase.from('shifts').delete().eq('org_id', id)
    await supabase.from('holidays').delete().eq('org_id', id)
    await supabase.from('office_locations').delete().eq('org_id', id)
    await supabase.from('departments').delete().eq('org_id', id)
    // Delete the organization
    const { error } = await supabase.from('organizations').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
    } else {
      setDetail(null)
      setDeleteId(null)
      router.refresh()
    }
    setDeleting(false)
  }

  const industries = useMemo(() =>
    [...new Set(companies.map(c => c.industry).filter(Boolean))] as string[],
    [companies]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return companies.filter(c => {
      const matchSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        c.company_code.toLowerCase().includes(q) ||
        c.owner_name.toLowerCase().includes(q) ||
        c.owner_email.toLowerCase().includes(q)
      const matchStatus = !statusFilter || c.status === statusFilter
      const matchIndustry = !industryFilter || c.industry === industryFilter
      return matchSearch && matchStatus && matchIndustry
    })
  }, [companies, search, statusFilter, industryFilter])

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const stats = useMemo(() => ({
    total: companies.length,
    approved: companies.filter(c => c.status === 'approved').length,
    pending: companies.filter(c => c.status === 'pending').length,
    rejected: companies.filter(c => c.status === 'rejected').length,
  }), [companies])

  const exportCSV = () => {
    const headers = ['Nama Perusahaan', 'Kode', 'Pemilik', 'Email', 'Telepon', 'Jabatan', 'Industri', 'Jumlah Karyawan', 'Alamat', 'Status', 'Tanggal Daftar']
    const rows = filtered.map(c => [
      c.name,
      c.company_code,
      c.owner_name,
      c.owner_email,
      c.owner_phone ?? '',
      c.owner_position ?? '',
      c.industry ?? '',
      c.employee_count_range ?? '',
      c.address ?? '',
      STATUS_LABEL[c.status] ?? c.status,
      new Date(c.registered_at).toLocaleDateString('id-ID'),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `perusahaan-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manajemen Perusahaan</h1>
          <p className="text-sm text-gray-400 mt-0.5">Kelola semua perusahaan yang terdaftar di AbsenKu</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <span>⬇️</span> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'from-teal-500 to-teal-600' },
          { label: 'Disetujui', value: stats.approved, color: 'from-green-500 to-green-600' },
          { label: 'Menunggu', value: stats.pending, color: 'from-yellow-400 to-orange-500' },
          { label: 'Ditolak', value: stats.rejected, color: 'from-red-400 to-red-600' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-5 text-white`}>
            <p className="text-white/80 text-sm">{s.label}</p>
            <p className="text-4xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter & Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-48 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Cari nama, kode, email, pemilik..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={industryFilter}
            onChange={e => { setIndustryFilter(e.target.value); setPage(1) }}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50"
          >
            <option value="">Semua Industri</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          {(search || statusFilter || industryFilter) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setIndustryFilter(''); setPage(1) }}
              className="px-4 py-2.5 border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 rounded-xl text-sm transition-colors"
            >
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">Menampilkan {filtered.length} dari {companies.length} perusahaan</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Perusahaan</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PIC / Kontak</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Industri</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Karyawan</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal Daftar</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-gray-400 text-sm">
                    Tidak ada data yang cocok
                  </td>
                </tr>
              ) : (
                paginated.map(company => (
                  <tr key={company.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600 font-bold text-sm shrink-0">
                          {company.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{company.name}</p>
                          <p className="text-xs font-bold text-teal-600 tracking-widest">{company.company_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-gray-700">{company.owner_name}</p>
                      <p className="text-xs text-gray-400">{company.owner_email}</p>
                      {company.owner_phone && <p className="text-xs text-gray-400">{company.owner_phone}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">{company.industry ?? '-'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">{company.employee_count_range ?? '-'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">
                        {new Date(company.registered_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLE[company.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[company.status] ?? company.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setDetail(company)}
                          className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 hover:border-teal-300 hover:text-teal-600 rounded-lg transition-colors font-medium"
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => setDeleteId(company.id)}
                          className="text-xs px-2 py-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus perusahaan"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Halaman {page} dari {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | string)[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) => (
                  typeof p === 'string' ? (
                    <span key={i} className="px-2 py-1.5 text-sm text-gray-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                        page === p ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  )
                ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600 font-bold">
                  {detail.name[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{detail.name}</h3>
                  <p className="text-xs font-bold text-teal-600 tracking-widest">{detail.company_code}</p>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Status</p>
                <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${STATUS_STYLE[detail.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[detail.status] ?? detail.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'PIC / Pemilik', value: detail.owner_name },
                  { label: 'Jabatan', value: detail.owner_position ?? '-' },
                  { label: 'Email', value: detail.owner_email },
                  { label: 'Telepon', value: detail.owner_phone ?? '-' },
                  { label: 'Industri', value: detail.industry ?? '-' },
                  { label: 'Jumlah Karyawan', value: detail.employee_count_range ?? '-' },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-xs text-gray-400 mb-0.5">{f.label}</p>
                    <p className="text-sm font-medium text-gray-800">{f.value}</p>
                  </div>
                ))}
              </div>

              {detail.address && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Alamat</p>
                  <p className="text-sm font-medium text-gray-800">{detail.address}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Tanggal Daftar</p>
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(detail.registered_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {detail.approved_at && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Tanggal Disetujui</p>
                    <p className="text-sm font-medium text-gray-800">
                      {new Date(detail.approved_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>

              {detail.rejected_reason && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-red-600 mb-1">Alasan Penolakan</p>
                  <p className="text-sm text-red-700">{detail.rejected_reason}</p>
                </div>
              )}

              {/* Reset Password - hanya untuk perusahaan approved */}
              {detail.status === 'approved' && (
                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reset Password Admin</p>
                  {resetResult?.email === detail.owner_email ? (
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                      <p className="text-xs text-teal-600 font-semibold mb-2">Password baru berhasil dibuat:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white border border-teal-200 rounded-lg px-3 py-2 text-sm font-bold text-teal-700 tracking-wider">
                          {resetResult.password}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(resetResult.password)}
                          className="px-3 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-xs text-teal-500 mt-2">Berikan password ini ke admin perusahaan via WA</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleResetPassword(detail.owner_email)}
                      disabled={resetting}
                      className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                      {resetting ? 'Mereset...' : '🔑 Reset Password'}
                    </button>
                  )}
                </div>
              )}

              {/* Delete company */}
              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={() => setDeleteId(detail.id)}
                  className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  🗑️ Hapus Perusahaan
                </button>
                <p className="text-[10px] text-red-400 text-center mt-1">Menghapus semua data: karyawan, shift, absensi, lokasi</p>
              </div>

              <button
                onClick={() => { setDetail(null); setResetResult(null) }}
                className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-1">Hapus Perusahaan?</h3>
              <p className="text-sm text-gray-500 mb-4">
                Semua data terkait (karyawan, shift, absensi, lokasi) akan dihapus permanen. Aksi ini tidak bisa dibatalkan.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  disabled={deleting}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleDelete(deleteId)}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
