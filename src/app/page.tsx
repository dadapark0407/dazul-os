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
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[340px]">
        {/* 브랜드 */}
        <div className="mb-16 text-center">
          <h1 className="font-heading text-[2.5rem] font-light tracking-[0.5em] text-dz-primary">
            DAZUL
          </h1>
          <p className="mt-3 text-[9px] font-medium uppercase tracking-[0.35em] text-dz-muted">
            Holistic Wellness Care
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleLogin} className="space-y-8">
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.2em] text-dz-muted">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border-b border-dz-border bg-transparent px-0 py-3 text-sm text-dz-primary outline-none transition-all duration-400 placeholder:text-dz-border focus:border-dz-primary"
                placeholder="admin@dazul.kr"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.2em] text-dz-muted">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full border-b border-dz-border bg-transparent px-0 py-3 text-sm text-dz-primary outline-none transition-all duration-400 placeholder:text-dz-border focus:border-dz-primary"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600/80">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-dz-primary py-4 text-[11px] font-medium uppercase tracking-[0.3em] text-white transition-all duration-400 hover:bg-dz-primary/85 disabled:opacity-40"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* 푸터 */}
        <p className="mt-20 text-center text-[9px] tracking-[0.25em] text-dz-border">
          Est. 2024 · Seoul
        </p>
      </div>
    </main>
  )
}
