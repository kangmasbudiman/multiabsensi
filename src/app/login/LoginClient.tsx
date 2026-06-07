'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginClient({ appName = 'AbsenKu' }: { appName?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (searchParams.get('err') === 'role') {
      setError('Akun Anda tidak memiliki akses ke panel admin. Hubungi administrator.')
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const input = usernameOrEmail.trim()
      const isEmail = input.includes('@')

      let loginEmail = input

      if (!isEmail) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', input)
          .maybeSingle()

        if (profileErr || !profile) {
          setError('Username tidak ditemukan')
          setIsLoading(false)
          return
        }

        const { data: rpcData, error: rpcErr } = await supabase
          .rpc('get_email_by_profile_id', { p_profile_id: profile.id })

        if (rpcErr || !rpcData) {
          setError('Akun tidak ditemukan')
          setIsLoading(false)
          return
        }

        loginEmail = rpcData
      }

      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
      if (error) throw error
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Invalid login credentials')) {
        setError('Username/email atau password salah')
      } else {
        setError('Terjadi kesalahan. Coba lagi.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">{appName[0]?.toUpperCase()}</span>
          </div>
          <span className="font-bold text-xl text-teal-600">{appName} Admin</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Masuk</h1>
        <p className="text-gray-500 text-sm mb-6">Panel Admin HR & Absensi</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username / Email</label>
            <input
              type="text"
              required
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              placeholder="Username atau email@perusahaan.com"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold text-base transition-colors"
          >
            {isLoading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          Belum punya akun?{' '}
          <Link href="/register" className="text-teal-600 hover:underline font-medium">
            Daftar perusahaan
          </Link>
        </p>
      </div>
    </div>
  )
}
