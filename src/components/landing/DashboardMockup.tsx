'use client'

import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Wallet,
  BarChart3,
  Search,
  Bell,
  Settings,
  MapPin,
  TrendingUp,
  TrendingDown,
  CircleDot,
} from 'lucide-react'

interface Props {
  appName: string
}

export function DashboardMockup({ appName }: Props) {
  return (
    <div className="rounded-2xl bg-white shadow-2xl shadow-emerald-950/40 overflow-hidden border border-white/20">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-slate-200 text-[10px] text-slate-500 font-mono">
            <CircleDot className="w-2.5 h-2.5 text-emerald-500" />
            app.{appName.toLowerCase()}.id/dashboard
          </div>
        </div>
      </div>

      {/* App body */}
      <div className="flex h-[380px] sm:h-[440px] bg-white text-slate-900 text-[11px]">
        {/* Sidebar */}
        <aside className="hidden sm:flex w-44 flex-col border-r border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-100">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-[10px] font-bold">
              {appName[0]?.toUpperCase()}
            </div>
            <span className="font-bold text-xs">{appName}</span>
          </div>
          <nav className="flex-1 px-2 py-3 space-y-0.5">
            {[
              { icon: LayoutDashboard, label: 'Dashboard', active: true },
              { icon: Users, label: 'Karyawan' },
              { icon: CalendarCheck, label: 'Absensi' },
              { icon: Wallet, label: 'Payroll' },
              { icon: BarChart3, label: 'Laporan' },
              { icon: Settings, label: 'Pengaturan' },
            ].map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${
                  active
                    ? 'bg-teal-100 text-teal-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{label}</span>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col">
          {/* Topbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div>
              <div className="text-[10px] text-slate-400">Selamat pagi, Admin</div>
              <div className="font-bold text-xs">Dashboard Absensi</div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-500">
                <Search className="w-2.5 h-2.5" />
                <span className="text-[9px]">cari…</span>
              </div>
              <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                <Bell className="w-2.5 h-2.5 text-slate-500" />
              </div>
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500" />
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 p-3 sm:p-4 overflow-hidden">
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Hadir Hari Ini', value: '94%', trend: 'up' as const, icon: CalendarCheck, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
                { label: 'Terlambat', value: '3', trend: 'down' as const, icon: ClockIcon, iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
                { label: 'Tidak Hadir', value: '5', trend: 'up' as const, icon: Users, iconBg: 'bg-rose-100', iconColor: 'text-rose-600' },
              ].map((stat) => (
                <div key={stat.label} className="p-2 rounded-lg border border-slate-100 bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <div className={`w-5 h-5 rounded ${stat.iconBg} flex items-center justify-center`}>
                      <stat.icon className={`w-2.5 h-2.5 ${stat.iconColor}`} />
                    </div>
                    {stat.trend === 'up' ? (
                      <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
                    ) : (
                      <TrendingDown className="w-2.5 h-2.5 text-rose-500" />
                    )}
                  </div>
                  <div className="font-bold text-sm text-slate-900">{stat.value}</div>
                  <div className="text-[8px] text-slate-400">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Chart + Activity */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {/* Chart */}
              <div className="sm:col-span-3 p-2.5 rounded-lg border border-slate-100 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[9px] font-semibold text-slate-700">Tren Kehadiran Mingguan</div>
                  <div className="text-[8px] text-slate-400">7 hari</div>
                </div>
                <div className="flex items-end gap-1 h-16">
                  {[60, 80, 75, 95, 88, 70, 92].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className="w-full rounded-sm bg-gradient-to-t from-teal-500 to-emerald-400"
                        style={{ height: `${h}%` }}
                      />
                      <div className="text-[7px] text-slate-400">{['S', 'M', 'S', 'R', 'K', 'J', 'S'][i]}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity feed */}
              <div className="sm:col-span-2 p-2.5 rounded-lg border border-slate-100 bg-white">
                <div className="text-[9px] font-semibold text-slate-700 mb-2">Aktivitas Live</div>
                <div className="space-y-1.5">
                  {[
                    { name: 'Budi S.', action: 'check-in', time: '08:02', loc: 'HQ', dot: 'bg-emerald-500' },
                    { name: 'Siti R.', action: 'check-in', time: '08:15', loc: 'HQ', dot: 'bg-emerald-500' },
                    { name: 'Ahmad H.', action: 'telat', time: '09:01', loc: 'Cabang', dot: 'bg-amber-500' },
                    { name: 'Dewi A.', action: 'check-in', time: '08:30', loc: 'HQ', dot: 'bg-emerald-500' },
                  ].map((act, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${act.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[8px] truncate text-slate-700">
                          <span className="font-semibold">{act.name}</span> · {act.action}
                        </div>
                        <div className="flex items-center gap-0.5 text-[7px] text-slate-400">
                          <MapPin className="w-1.5 h-1.5" />
                          {act.loc} · {act.time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

// Inline mini icon to avoid importing Clock (which would clash with our ClockIcon name)
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
