import { getPlatformName } from '@/lib/platform'
import AbsenClient from './AbsenClient'

export async function generateMetadata() {
  const appName = await getPlatformName()
  return { title: `Absensi Web - ${appName}` }
}

export default async function AbsenPage() {
  const appName = await getPlatformName()

  return <AbsenClient appName={appName} />
}
