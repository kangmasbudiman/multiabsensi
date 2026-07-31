import { getPlatformName } from '@/lib/platform'
import AbsenClient from '@/app/absen/AbsenClient'

export async function generateMetadata() {
  const appName = await getPlatformName()
  return { title: `Absensi WiFi - ${appName}` }
}

export default async function AbsenKantorPage() {
  const appName = await getPlatformName()
  return <AbsenClient appName={appName} mode="wifi" />
}
