'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function AdminResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('비밀번호 변경에 실패했습니다. 링크가 만료되었을 수 있습니다.')
      setLoading(false)
      return
    }

    router.push('/admin/settlement')
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

  const disabled = loading || !password || !confirm

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
      <div style={{ fontSize: 18, letterSpacing: '0.35em', fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>
        DAZUL
      </div>
      <div style={{ fontSize: 11, color: '#C9A96E', letterSpacing: '0.15em', marginBottom: 48 }}>
        정산 관리
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
        <form onSubmit={handleSubmit}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>
            새 비밀번호 설정
          </p>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 24, lineHeight: 1.5 }}>
            새 비밀번호를 입력해 주세요 (8자 이상)
          </p>

          <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>
            새 비밀번호
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="새 비밀번호 (8자 이상)"
            required
            autoFocus
            autoComplete="new-password"
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>
            비밀번호 확인
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="비밀번호 다시 입력"
            required
            autoComplete="new-password"
            style={inputStyle}
          />

          {error && (
            <p style={{ fontSize: 12, color: '#CC3333', marginTop: 8 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={disabled}
            style={{
              width: '100%',
              marginTop: 16,
              padding: '13px',
              fontSize: 14,
              fontWeight: 600,
              background: disabled ? '#E8E5E0' : '#1A1A1A',
              color: disabled ? '#AAA' : '#FFFFFF',
              border: 'none',
              borderRadius: 0,
              cursor: disabled ? 'default' : 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            {loading ? '변경 중…' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  )
}
