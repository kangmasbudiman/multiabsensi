import { Suspense } from 'react'
import { getPlatformName } from '@/lib/platform'
import LoginClient from './LoginClient'

export default async function LoginPage() {
  const appName = await getPlatformName()

  return (
    <Suspense>
      <LoginClient appName={appName} />
    </Suspense>
  )
}
