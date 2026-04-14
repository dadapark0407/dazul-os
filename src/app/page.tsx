'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : authError.message
      )
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-4">
      <div className="w-full max-w-sm">
        {/* 브랜드 */}
        <div className="mb-8 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-stone-400">
            DAZUL
          </p>
          <p className="mt-1 text-[10px] tracking-[0.15em] text-stone-300">
            Premium Pet Care
          </p>
          <h1 className="mt-6 text-xl font-bold text-stone-900">운영 시스템 로그인</h1>
        </div>

        {/* 폼 */}
        <form
          onSubmit={handleLogin}
          className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-stone-200/60"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="admin@dazul.kr"
                className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none transition focus:border-stone-500 focus:ring-1 focus:ring-stone-500"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-stone-900 text-sm font-semibold text-white transition-colors hover:bg-stone-700 disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.3em] text-stone-300">
          DAZUL · Premium Pet Care
        </p>
      </div>
    </main>
  )
}
