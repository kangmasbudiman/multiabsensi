'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LogoutDialog from './LogoutDialog'

type NavItem = { href: string; label: string; icon: string }
type NavGroup = { title: string; icon: string; items: NavItem[] }

// Menu khusus Super Admin (pengelola platform)
const superAdminGroups: NavGroup[] = [
  {
    title: 'Platform',
    icon: '🌐',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: '📊' },
      { href: '/dashboard/companies', label: 'Manajemen Perusahaan', icon: '🏭' },
      { href: '/dashboard/super-attendance', label: 'Manajemen Absensi', icon: '📋' },
      { href: '/dashboard/custom-attendance', label: 'Link Absensi Custom', icon: '🔗' },
      { href: '/dashboard/qr-attendance', label: 'QR Check-in', icon: '📱' },
      { href: '/dashboard/super-settings', label: 'Pengaturan Platform', icon: '🛡️' },
    ],
  },
  {
    title: 'Akun',
    icon: '⚙️',
    items: [
      { href: '/dashboard/settings', label: 'Akun Saya', icon: '⚙️' },
    ],
  },
]

// Menu khusus Admin Perusahaan (HR management)
const adminGroups: NavGroup[] = [
  {
    title: 'Utama',
    icon: '🏠',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    ],
  },
  {
    title: 'Karyawan',
    icon: '👥',
    items: [
      { href: '/dashboard/employees', label: 'Karyawan', icon: '👥' },
      { href: '/dashboard/shifts', label: 'Shift', icon: '🕐' },
      { href: '/dashboard/departments', label: 'Departemen', icon: '🏗️' },
      { href: '/dashboard/positions', label: 'Posisi Jabatan', icon: '🏅' },
    ],
  },
  {
    title: 'Kehadiran',
    icon: '📋',
    items: [
      { href: '/dashboard/locations', label: 'Lokasi Kantor', icon: '📍' },
      { href: '/dashboard/network', label: 'IP Jaringan', icon: '🌐' },
      { href: '/dashboard/schedule', label: 'Jadwal Shift', icon: '📅' },
      { href: '/dashboard/roster', label: 'Roster Bulanan', icon: '🗓️' },
      { href: '/dashboard/attendance', label: 'Rekap Kehadiran', icon: '🗂️' },
    ],
  },
  {
    title: 'Penggajian',
    icon: '💰',
    items: [
      { href: '/dashboard/payroll', label: 'Penggajian', icon: '💰' },
      { href: '/dashboard/reports', label: 'Laporan', icon: '📈' },
    ],
  },
  {
    title: 'Persetujuan',
    icon: '✅',
    items: [
      { href: '/dashboard/leave-approvals', label: 'Persetujuan Cuti', icon: '📋' },
    ],
  },
]

const adminSettingsGroup: NavGroup = {
  title: 'Pengaturan',
  icon: '⚙️',
  items: [
    { href: '/dashboard/company-settings', label: 'Pengaturan Perusahaan', icon: '🏢' },
    { href: '/dashboard/approval-config', label: 'Alur Persetujuan', icon: '🔀' },
    { href: '/dashboard/settings', label: 'Akun Saya', icon: '⚙️' },
  ],
}

// Menu khusus Kepala Ruangan — hanya jadwal dinas
const kepalaRuanganGroups: NavGroup[] = [
  {
    title: 'Jadwal Dinas',
    icon: '🗓️',
    items: [
      { href: '/dashboard/roster', label: 'Roster Bulanan', icon: '🗓️' },
    ],
  },
]

const kepalaRuanganSettingsGroup: NavGroup = {
  title: 'Pengaturan',
  icon: '⚙️',
  items: [
    { href: '/dashboard/settings', label: 'Akun Saya', icon: '⚙️' },
  ],
}

// Menu khusus Approver (non-kepala_ruangan)
const approverGroups: NavGroup[] = [
  {
    title: 'Utama',
    icon: '🏠',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    ],
  },
  {
    title: 'Kehadiran',
    icon: '📋',
    items: [
      { href: '/dashboard/schedule', label: 'Jadwal Shift', icon: '📅' },
      { href: '/dashboard/roster', label: 'Roster Bulanan', icon: '🗓️' },
    ],
  },
  {
    title: 'Persetujuan',
    icon: '✅',
    items: [
      { href: '/dashboard/leave-approvals', label: 'Persetujuan Cuti', icon: '📋' },
    ],
  },
]

const approverSettingsGroup: NavGroup = {
  title: 'Pengaturan',
  icon: '⚙️',
  items: [
    { href: '/dashboard/settings', label: 'Akun Saya', icon: '⚙️' },
  ],
}

interface SidebarProps {
  profile: {
    full_name: string
    role: string
    position?: string | null
    organizations?: { name: string; company_code: string; app_name: string; logo_url?: string } | null
    org_id?: string | null
  }
  collapsed?: boolean
  isInspecting?: boolean
}

export default function Sidebar({ profile, collapsed = false, isInspecting = false }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [showLogout, setShowLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed-groups')
      if (saved) setCollapsedGroups(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('sidebar-collapsed-groups', JSON.stringify(collapsedGroups))
    } catch {}
  }, [collapsedGroups])

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => ({ ...prev, [title]: !prev[title] }))
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isSuperAdmin = profile.role === 'super_admin'
  const isDeptHead = profile.role === 'dept_head'
  const isKepalaRuangan = profile.position === 'kepala_ruangan'

  const APPROVER_POSITIONS = ['direktur', 'sekertaris', 'kabid', 'kabag', 'kepala_ruangan', 'kasie_keperawatan', 'kasie_penunjang']
  const isApprover = APPROVER_POSITIONS.includes(profile.position ?? '')

  const orgName = isSuperAdmin
    ? (profile.organizations?.app_name ?? 'AbsenKu')
    : (profile.organizations?.name ?? 'AbsenKu Platform')
  const appName = profile.organizations?.app_name ?? 'AbsenKu'
  const companyCode = profile.organizations?.company_code ?? 'SUPER'

  const groups: NavGroup[] = (isSuperAdmin && !isInspecting)
    ? superAdminGroups
    : profile.position === 'kepala_ruangan'
      ? [...kepalaRuanganGroups, kepalaRuanganSettingsGroup]
      : (isDeptHead || isApprover)
        ? [...approverGroups, approverSettingsGroup]
        : [...adminGroups, adminSettingsGroup]

  const NavLink = ({ href, label, icon }: { href: string; label: string; icon: string }) => {
    const isActive = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
    return (
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all ${
          collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5'
        } ${
          isActive
            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
        }`}
      >
        <span className="text-base shrink-0">{icon}</span>
        {!collapsed && <span className="whitespace-nowrap">{label}</span>}
      </Link>
    )
  }

  const NavGroupSection = ({ group }: { group: NavGroup }) => {
    // Check if any item in the group is active
    const hasActive = group.items.some(item =>
      item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)
    )
    const isCollapsedGroup = collapsedGroups[group.title] ?? false
    // Auto-expand if has active item
    const effectiveCollapsed = hasActive ? false : isCollapsedGroup

    // When sidebar is collapsed, show items without grouping
    if (collapsed) {
      return (
        <>
          {group.items.map(item => (
            <NavLink key={item.href} {...item} />
          ))}
          <div className="border-t border-white/5 my-1" />
        </>
      )
    }

    // Single-item groups don't need collapse header
    if (group.items.length === 1) {
      return (
        <div>
          <NavLink {...group.items[0]} />
        </div>
      )
    }

    return (
      <div>
        <button
          onClick={() => toggleGroup(group.title)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 uppercase tracking-widest font-semibold hover:text-gray-300 transition-colors"
        >
          <span className="text-sm">{group.icon}</span>
          <span className="flex-1 text-left">{group.title}</span>
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${effectiveCollapsed ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div className={`overflow-hidden transition-all duration-200 ${effectiveCollapsed ? 'max-h-0' : 'max-h-[500px]'}`}>
          {group.items.map(item => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <aside
      className="flex flex-col h-full overflow-hidden transition-all duration-300 relative"
      style={{
        backgroundImage: 'url(/sidebar-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80 pointer-events-none z-0" />

      {/* Logo */}
      <div className={`relative z-10 border-b border-white/10 shrink-0 transition-all duration-300 ${collapsed ? 'p-3' : 'p-5'}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''} mb-3`}>
          {profile.organizations?.logo_url ? (
            <img src={profile.organizations.logo_url} alt="Logo" className="w-9 h-9 rounded-lg object-cover shrink-0 shadow-lg" />
          ) : (
            <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center shrink-0 shadow-lg">
              <span className="text-white text-sm font-bold">{appName[0]?.toUpperCase()}</span>
            </div>
          )}
          {!collapsed && (
            <span className="font-bold text-lg text-white tracking-wide whitespace-nowrap">{appName}</span>
          )}
        </div>

        {!collapsed && (
          <div className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${isSuperAdmin ? 'bg-purple-500' : isKepalaRuangan ? 'bg-amber-500' : isApprover ? 'bg-blue-500' : 'bg-teal-400'}`}>
              {profile.full_name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{profile.full_name}</p>
              <p className={`text-xs capitalize ${isSuperAdmin ? 'text-purple-300' : isKepalaRuangan ? 'text-amber-300' : isApprover ? 'text-blue-300' : 'text-teal-300'}`}>
                {isSuperAdmin ? 'Super Admin' : isKepalaRuangan ? 'Kepala Ruangan' : isApprover ? 'Approver' : profile.role.replace('_', ' ')}
              </p>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="flex justify-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${isSuperAdmin ? 'bg-purple-500' : isKepalaRuangan ? 'bg-amber-500' : isApprover ? 'bg-blue-500' : 'bg-teal-400'}`}>
              {profile.full_name[0]?.toUpperCase()}
            </div>
          </div>
        )}
      </div>

      {/* Badge perusahaan / platform */}
      {!collapsed && (
        <div className="relative z-10 px-4 pt-3 pb-1 shrink-0">
          <div className={`rounded-lg px-3 py-2 border ${isSuperAdmin ? 'bg-purple-500/10 border-purple-500/20' : isKepalaRuangan ? 'bg-amber-500/10 border-amber-500/20' : isApprover ? 'bg-blue-500/10 border-blue-500/20' : 'bg-white/5 border-white/10'}`}>
            <p className="text-xs text-gray-400 truncate">{orgName}</p>
            <p className={`text-sm font-bold tracking-widest ${isSuperAdmin ? 'text-purple-400' : isKepalaRuangan ? 'text-amber-400' : isApprover ? 'text-blue-400' : 'text-teal-400'}`}>
              {isSuperAdmin ? appName.toUpperCase() : companyCode}
            </p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className={`relative z-10 flex-1 py-3 overflow-y-auto space-y-0.5 ${collapsed ? 'px-2' : 'px-3'}`}>
        {groups.map(group => (
          <NavGroupSection key={group.title} group={group} />
        ))}
      </nav>

      {/* Logout */}
      <div className={`relative z-10 border-t border-white/10 shrink-0 ${collapsed ? 'p-2' : 'p-4'}`}>
        <button
          onClick={() => setShowLogout(true)}
          title={collapsed ? 'Keluar' : undefined}
          className={`w-full flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors ${
            collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2'
          }`}
        >
          <span>🚪</span>
          {!collapsed && 'Keluar'}
        </button>
      </div>

      <LogoutDialog
        open={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
        isLoading={loggingOut}
      />
    </aside>
  )
}
