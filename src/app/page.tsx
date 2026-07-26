import { cookies } from 'next/headers'
import { getPlatformName } from '@/lib/platform'
import { LandingClient } from '@/components/landing/LandingClient'
import type { Lang } from '@/lib/i18n/landing-dict'

export const revalidate = 3600 // cache platform name + initial lang for 1h

export default async function LandingPage() {
  const appName = await getPlatformName()
  const jar = await cookies()
  const langRaw = jar.get('lang')?.value
  const initialLang: Lang = langRaw === 'en' ? 'en' : 'id'

  return <LandingClient appName={appName} initialLang={initialLang} />
}
