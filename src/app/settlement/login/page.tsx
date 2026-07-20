'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Mode = 'login' | 'reset' | 'reset_sent'

export default function GroomerLoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }

    // 첫 로그인 시 freelance_groomers.user_id 연결 (이미 연결된 경우 no-op)
    await supabase.rpc('claim_groomer_user_id')

    // /settlement 에서 미용사 등록 여부 최종 확인
    router.push('/settlement')
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/settlement/auth/callback` }
    )

    if (resetError) {
      setError('재설정 이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      setLoading(false)
      return
    }

    setMode('reset_sent')
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    fontSize: 14,
    border: '1px solid #E8E5E0',
    borderRadius: 0,
    background: '#FAFAF8',
    color: '#1A1A1A',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const primaryBtn = (disabled: boolean): React.CSSProperties => ({
    width: '100%',
    marginTop: 16,
    padding: '13px',
    fontSize: 14,
    fontWeight: 600,
    background: disabled ? '#E8E5E0' : '#C9A96E',
    color: disabled ? '#AAA' : '#FFFFFF',
    border: 'none',
    borderRadius: 0,
    cursor: disabled ? 'default' : 'pointer',
    letterSpacing: '0.04em',
  })

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#FAFAF8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          fontSize: 18,
          letterSpacing: '0.35em',
          fontWeight: 600,
          color: '#1A1A1A',
          marginBottom: 48,
        }}
      >
        DAZUL
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#FFFFFF',
          border: '1px solid #E8E5E0',
          padding: '32px 24px',
        }}
      >
        {/* ── 로그인 ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>
              미용사 로그인
            </p>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 24, lineHeight: 1.5 }}>
              매장에서 등록한 이메일과 비밀번호를 입력하세요
            </p>

            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소"
              required
              autoComplete="email"
              autoFocus
              style={{ ...inputStyle, marginBottom: 12 }}
            />

            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              required
              autoComplete="current-password"
              style={inputStyle}
            />

            {error && (
              <p style={{ fontSize: 12, color: '#CC3333', marginTop: 8 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              style={primaryBtn(loading || !email.trim() || !password)}
            >
              {loading ? '로그인 중…' : '로그인'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('reset'); setError('') }}
              style={{
                display: 'block',
                marginTop: 16,
                fontSize: 12,
                color: '#888',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              비밀번호를 잊으셨나요?
            </button>
          </form>
        )}

        {/* ── 비밀번호 재설정 요청 ── */}
        {mode === 'reset' && (
          <form onSubmit={handleReset}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>
              비밀번호 재설정
            </p>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 24, lineHeight: 1.5 }}>
              등록된 이메일로 재설정 링크를 발송합니다
            </p>

            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소"
              required
              autoComplete="email"
              autoFocus
              style={inputStyle}
            />

            {error && (
              <p style={{ fontSize: 12, color: '#CC3333', marginTop: 8 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              style={primaryBtn(loading || !email.trim())}
            >
              {loading ? '발송 중…' : '재설정 링크 발송'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('login'); setError('') }}
              style={{
                display: 'block',
                marginTop: 16,
                fontSize: 12,
                color: '#888',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              로그인으로 돌아가기
            </button>
          </form>
        )}

        {/* ── 재설정 링크 발송 완료 ── */}
        {mode === 'reset_sent' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>
              이메일을 확인해 주세요
            </p>
            <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>
              <strong style={{ color: '#1A1A1A' }}>{email}</strong>으로
              <br />
              재설정 링크를 발송했습니다.
            </p>
            <button
              onClick={() => { setMode('login'); setError('') }}
              style={{
                marginTop: 24,
                fontSize: 12,
                color: '#888',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              로그인으로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
