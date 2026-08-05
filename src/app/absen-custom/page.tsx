import { createAdminClient } from '@/lib/supabase/admin'
import { getPlatformName } from '@/lib/platform'
import CustomAttendanceClient from './CustomAttendanceClient'
import { ShieldAlert } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AbsenCustomPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const appName = await getPlatformName()
  const params = await searchParams
  const token = params.token?.trim()

  if (!token) {
    return <RejectionScreen title="Token tidak ditemukan" message="Link tidak valid. Pastikan Anda membuka link lengkap yang diberikan super admin." appName={appName} />
  }

  const admin = createAdminClient()
  const { data: link } = await admin
    .from('custom_attendance_links')
    .select('id, is_active, expires_at, org_id, organizations(name, company_code)')
    .eq('token', token)
    .maybeSingle()

  if (!link || !link.is_active) {
    return <RejectionScreen title="Link tidak tersedia" message="Link sudah dinonaktifkan atau tidak ditemukan. Hubungi super admin." appName={appName} />
  }

  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    return <RejectionScreen title="Link kadaluarsa" message="Link ini sudah melewati batas waktu penggunaan. Minta super admin buat link baru." appName={appName} />
  }

  const org = Array.isArray(link.organizations) ? link.organizations[0] : link.organizations
  if (!org?.company_code) {
    return <RejectionScreen title="Organisasi tidak ditemukan" message="Data organisasi tidak valid." appName={appName} />
  }

  // Fetch whitelisted user names
  const { data: wlRows } = await admin
    .from('custom_attendance_link_users')
    .select('user_id, profiles(full_name)')
    .eq('link_id', link.id)
  const assignedNames = (wlRows ?? [])
    .map((r: any) => r.profiles?.full_name)
    .filter(Boolean) as string[]

  return (
    <CustomAttendanceClient
      appName={appName}
      token={token}
      orgCode={org.company_code}
      orgName={org.name}
      assignedNames={assignedNames}
    />
  )
}

function RejectionScreen({ title, message, appName }: { title: string; message: string; appName: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-red-950 to-slate-900 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-teal-500 rounded-lg flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold">{appName[0]?.toUpperCase()}</span>
          </div>
          <h1 className="text-lg font-bold text-white">{appName}</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
          <p className="text-xs text-gray-400 mt-6">Powered by {appName}</p>
        </div>
      </div>
    </div>
  )
}
