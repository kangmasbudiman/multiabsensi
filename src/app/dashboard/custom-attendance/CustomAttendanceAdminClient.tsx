'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  createCustomLink,
  deactivateLink,
  removeLinkUser,
  addLinkUsers,
  listOrgEmployees,
  searchOrgEmployees,
} from '@/app/actions/custom-attendance'

interface Org { id: string; name: string }

interface Link {
  id: string
  token: string
  label: string | null
  org_id: string
  is_active: boolean
  expires_at: string | null
  created_at: string
  organizations: { name: string } | null
  custom_attendance_link_users: Array<{ user_id: string }>
}

interface User {
  id: string
  full_name: string
  employee_id: string | null
}

interface Props {
  orgs: Org[]
  links: Link[]
  userMap: Record<string, User>
  submissionCountMap: Record<string, number>
}

export default function CustomAttendanceAdminClient({ orgs, links, userMap, submissionCountMap }: Props) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [managingLink, setManagingLink] = useState<Link | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500)
      return () => clearTimeout(t)
    }
  }, [toast])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Link Absensi Custom</h1>
          <p className="text-sm text-gray-500 mt-1">
            Magic link dengan tanggal & jam custom. Cuma user yang di-whitelist yang bisa submit.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
        >
          <span>+</span> Buat Link Baru
        </button>
      </div>

      {links.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔗</span>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Belum ada link</h3>
          <p className="text-sm text-gray-500">Klik "Buat Link Baru" untuk membuat link absensi custom pertama Anda.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {links.map(link => {
            const orgName = link.organizations?.name ?? '—'
            const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/absen-custom?token=${link.token}`
            const submissionCount = submissionCountMap[link.id] ?? 0
            const assignedNames = link.custom_attendance_link_users
              .map(u => userMap[u.user_id]?.full_name)
              .filter(Boolean) as string[]
            const visibleNames = assignedNames.slice(0, 3)
            const extraCount = assignedNames.length - visibleNames.length
            return (
              <div key={link.id} className={`bg-white rounded-xl shadow-sm border p-5 ${link.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${link.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {link.is_active ? '● Aktif' : '○ Nonaktif'}
                      </span>
                      {link.label && (
                        <span className="text-sm font-semibold text-gray-900">{link.label}</span>
                      )}
                      {link.expires_at && (
                        <span className="text-[10px] text-amber-600 font-medium">
                          Expired: {new Date(link.expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{orgName} · Dibuat {new Date(link.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 mb-2">
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] text-gray-700 flex-1 truncate font-mono">{url}</code>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(url)
                            setToast({ type: 'success', msg: 'URL disalin ke clipboard' })
                          }}
                          className="px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-100 text-[11px] font-semibold text-gray-700 rounded"
                        >
                          Copy URL
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap mb-2">
                      <span>
                        👥 {link.custom_attendance_link_users.length} karyawan whitelist
                      </span>
                      <span>·</span>
                      <span>📊 {submissionCount} submit</span>
                      <button
                        onClick={() => setManagingLink(link)}
                        className="ml-auto text-teal-600 hover:text-teal-700 font-semibold"
                      >
                        Kelola Whitelist
                      </button>
                    </div>
                    {assignedNames.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        <span className="text-gray-500 font-medium">Di-assign ke:</span>
                        {visibleNames.map((name, i) => (
                          <span key={i} className="px-2 py-0.5 bg-teal-50 border border-teal-100 text-teal-700 rounded-full font-medium">
                            {name}
                          </span>
                        ))}
                        {extraCount > 0 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
                            +{extraCount} lainnya
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {link.is_active && (
                    <button
                      onClick={async () => {
                        if (!confirm('Nonaktifkan link ini? User nggak akan bisa akses lagi.')) return
                        const r = await deactivateLink(link.id)
                        if (r.error) setToast({ type: 'error', msg: r.error })
                        else setToast({ type: 'success', msg: 'Link dinonaktifkan' })
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateLinkModal
          orgs={orgs}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(token) => {
            setShowCreateModal(false)
            setToast({ type: 'success', msg: 'Link berhasil dibuat' })
            // Refresh page to show new link
            window.location.reload()
          }}
          onError={(msg) => setToast({ type: 'error', msg })}
        />
      )}

      {managingLink && (
        <ManageWhitelistModal
          link={managingLink}
          userMap={userMap}
          onClose={() => setManagingLink(null)}
          onChange={() => {
            // Refresh to reflect changes
            window.location.reload()
          }}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-teal-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function CreateLinkModal({
  orgs,
  onClose,
  onSuccess,
  onError,
}: {
  orgs: Org[]
  onClose: () => void
  onSuccess: (token: string) => void
  onError: (msg: string) => void
}) {
  const [orgId, setOrgId] = useState('')
  const [label, setLabel] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<User[]>([])

  // Load employees when org changes
  useEffect(() => {
    if (!orgId) {
      setEmployees([])
      return
    }
    let cancelled = false
    const fetchAll = async () => {
      const r = await listOrgEmployees(orgId)
      if (cancelled) return
      if (r.error) {
        setEmployees([])
        return
      }
      setEmployees(r.data ?? [])
    }
    fetchAll()
    return () => { cancelled = true }
  }, [orgId])

  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return employees
    return employees.filter(e =>
      e.full_name.toLowerCase().includes(q) ||
      (e.employee_id ?? '').toLowerCase().includes(q)
    )
  }, [employees, search])

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!orgId) {
      onError('Pilih perusahaan dulu')
      return
    }
    if (selectedIds.size === 0) {
      onError('Pilih minimal 1 karyawan')
      return
    }
    setLoading(true)
    const r = await createCustomLink({
      orgId,
      label: label.trim() || undefined,
      expiresAt: expiresAt || null,
      userIds: Array.from(selectedIds),
    })
    setLoading(false)
    if (r.error) {
      onError(r.error)
    } else if (r.token) {
      onSuccess(r.token)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Buat Link Absensi Custom</h2>
          <p className="text-xs text-gray-500 mt-0.5">User yang di-whitelist bisa input tanggal & jam custom sendiri.</p>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Perusahaan <span className="text-red-500">*</span></label>
            <select
              value={orgId}
              onChange={e => { setOrgId(e.target.value); setSelectedIds(new Set()) }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              <option value="">— Pilih perusahaan —</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Label (opsional)</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="mis: Koreksi Agustus"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kadaluarsa (opsional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          </div>

          <div className="mb-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Karyawan yang boleh akses <span className="text-red-500">*</span>
              {selectedIds.size > 0 && (
                <span className="ml-2 text-teal-600">{selectedIds.size} dipilih</span>
              )}
            </label>
            {orgId ? (
              <>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama atau ID..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 mb-2"
                />
                <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                  {filteredEmployees.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">Tidak ada karyawan</div>
                  ) : filteredEmployees.map(emp => (
                    <label
                      key={emp.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.id)}
                        onChange={() => handleToggle(emp.id)}
                        className="w-4 h-4 rounded accent-teal-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{emp.full_name}</div>
                        {emp.employee_id && <div className="text-[10px] text-gray-500">{emp.employee_id}</div>}
                      </div>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-6 text-center text-xs text-gray-400">
                Pilih perusahaan dulu untuk menampilkan daftar karyawan
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !orgId || selectedIds.size === 0}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg"
          >
            {loading ? 'Generating...' : 'Generate Link'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ManageWhitelistModal({
  link,
  userMap,
  onClose,
  onChange,
}: {
  link: Link
  userMap: Record<string, User>
  onClose: () => void
  onChange: () => void
}) {
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const whitelistedUsers = link.custom_attendance_link_users.map(u => userMap[u.user_id]).filter(Boolean)

  const doSearch = async () => {
    const q = search.trim()
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    const r = await searchOrgEmployees(link.org_id, q)
    if (r.error) {
      setToast(r.error)
      setSearchResults([])
      return
    }
    setSearchResults(r.data ?? [])
  }

  const handleRemove = async (userId: string) => {
    if (!confirm('Hapus karyawan dari whitelist?')) return
    setLoading(true)
    const r = await removeLinkUser({ linkId: link.id, userId })
    setLoading(false)
    if (r.error) setToast(r.error)
    else onChange()
  }

  const handleAdd = async () => {
    if (selectedToAdd.size === 0) return
    setLoading(true)
    const r = await addLinkUsers({ linkId: link.id, userIds: Array.from(selectedToAdd) })
    setLoading(false)
    if (r.error) setToast(r.error)
    else {
      setSelectedToAdd(new Set())
      onChange()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Kelola Whitelist</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {link.organizations?.name} · {link.label || 'Tanpa label'}
          </p>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Karyawan Saat Ini ({whitelistedUsers.length})
          </h3>
          {whitelistedUsers.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Belum ada karyawan</p>
          ) : (
            <div className="space-y-1.5 mb-6">
              {whitelistedUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{u.full_name}</div>
                    {u.employee_id && <div className="text-[10px] text-gray-500">{u.employee_id}</div>}
                  </div>
                  <button
                    onClick={() => handleRemove(u.id)}
                    disabled={loading}
                    className="text-xs font-semibold text-red-600 hover:bg-red-100 px-2 py-1 rounded disabled:opacity-50"
                  >
                    Hapus
                  </button>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Tambah Karyawan</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Cari nama / ID karyawan..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <button
              onClick={doSearch}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg"
            >
              Cari
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto mb-3">
              {searchResults.map(u => {
                const alreadyIn = whitelistedUsers.some(w => w?.id === u.id)
                return (
                  <label
                    key={u.id}
                    className={`flex items-center gap-3 px-3 py-2 border-b border-gray-50 last:border-0 ${alreadyIn ? 'opacity-50' : 'hover:bg-gray-50 cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      disabled={alreadyIn}
                      checked={selectedToAdd.has(u.id)}
                      onChange={() => {
                        setSelectedToAdd(prev => {
                          const next = new Set(prev)
                          if (next.has(u.id)) next.delete(u.id)
                          else next.add(u.id)
                          return next
                        })
                      }}
                      className="w-4 h-4 rounded accent-teal-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{u.full_name}</div>
                      {u.employee_id && <div className="text-[10px] text-gray-500">{u.employee_id}</div>}
                    </div>
                    {alreadyIn && <span className="text-[10px] text-gray-400 font-semibold">sudah ada</span>}
                  </label>
                )
              })}
            </div>
          )}

          {selectedToAdd.size > 0 && (
            <button
              onClick={handleAdd}
              disabled={loading}
              className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              Tambah {selectedToAdd.size} Karyawan
            </button>
          )}

          {toast && (
            <div className="mt-3 px-3 py-2 bg-red-50 text-red-700 text-xs rounded-lg">{toast}</div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
