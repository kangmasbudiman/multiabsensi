import { getPlatformName } from '@/lib/platform'
import RegisterClient from './RegisterClient'

export default async function RegisterPage() {
  const appName = await getPlatformName()

  return <RegisterClient appName={appName} />
}
