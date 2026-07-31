import { getPlatformName } from '@/lib/platform'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientIp } from '@/lib/rate-limit'
import { headers } from 'next/headers'
import AbsenClient from '@/app/absen/AbsenClient'
import { ShieldAlert, WifiOff } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const appName = await getPlatformName()
  return { title: `Absensi WiFi - ${appName}` }
}

export default async function AbsenKantorPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const appName = await getPlatformName()
  const params = await searchParams
  const code = params.code?.trim()

  // Tanpa ?code= → fallback ke flow biasa (user input org code manual)
  if (!code) {
    return <AbsenClient appName={appName} mode="wifi" />
  }

  // Validasi org
  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('company_code', code)
    .single()

  if (!org) {
    return (
      <RejectionScreen
        icon={<ShieldAlert className="w-12 h-12 text-red-500" />}
        title="Kode perusahaan tidak valid"
        message={`Kode "${code}" tidak dikenali. Periksa kembali atau hubungi HR Anda.`}
        appName={appName}
      />
    )
  }

  // Ambil whitelist IP untuk org ini
  const { data: whitelist } = await admin
    .from('office_ip_whitelist')
    .select('ip_address')
    .eq('org_id', org.id)

  const whitelistedIps = (whitelist ?? []).map(w => w.ip_address)

  if (whitelistedIps.length === 0) {
    return (
      <RejectionScreen
        icon={<WifiOff className="w-12 h-12 text-amber-500" />}
        title="Mode WiFi belum diaktifkan"
        message={`Admin ${org.name} belum mendaftarkan IP jaringan kantor. Hubungi admin untuk mengaktifkan mode WiFi di menu "IP Jaringan".`}
        appName={appName}
      />
    )
  }

  // Cek IP client
  const headersList = await headers()
  const clientIp = getClientIp(headersList)

  if (!whitelistedIps.includes(clientIp)) {
    return (
      <RejectionScreen
        icon={<WifiOff className="w-12 h-12 text-red-500" />}
        title="Anda tidak terhubung dari jaringan kantor"
        message={
          <>
            Mode WiFi hanya bisa dipakai dari jaringan RS/kantor. IP Anda saat ini{' '}
            <span className="font-mono font-bold text-red-700">{clientIp}</span> tidak terdaftar.
            <br /><br />
            <span className="text-gray-600">
              👉 Gunakan WiFi kantor, atau pakai mode absensi reguler dengan GPS:
            </span>
          </>
        }
        appName={appName}
        showGpsLink
        orgCode={code}
      />
    )
  }

  // IP match → lanjut ke AbsenClient mode WiFi
  return <AbsenClient appName={appName} mode="wifi" />
}

function RejectionScreen({
  icon,
  title,
  message,
  appName,
  showGpsLink = false,
  orgCode,
}: {
  icon: React.ReactNode
  title: string
  message: React.ReactNode
  appName: string
  showGpsLink?: boolean
  orgCode?: string
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-red-950 to-slate-900 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-teal-500 rounded-lg flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold">{appName[0]?.toUpperCase()}</span>
          </div>
          <h1 className="text-lg font-bold text-white">{appName}</h1>
        </div>

        {/* Rejection card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
            {icon}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">{message}</p>

          {showGpsLink && orgCode && (
            <Link
              href={`/absen?code=${encodeURIComponent(orgCode)}`}
              className="inline-flex items-center justify-center gap-2 w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors"
            >
              📍 Buka Mode GPS
            </Link>
          )}

          <p className="text-xs text-gray-400 mt-4">
            Powered by {appName}
          </p>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-white/50 mt-4">
          Sudah di jaringan kantor? Coba refresh halaman ini.
        </p>
      </div>
    </div>
  )
}
