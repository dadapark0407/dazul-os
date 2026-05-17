'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { verifyOwnerPin } from '@/lib/owner-pin'

const SESSION_KEY = 'dz_owner_unlock'

export function isOwnerSessionUnlocked(): boolean {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(SESSION_KEY) === '1'
}

export function markOwnerSessionUnlocked() {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(SESSION_KEY, '1')
}

type Props = {
  open: boolean
  onClose: () => void
  redirectTo: string
}

export default function DashboardPinModal({ open, onClose, redirectTo }: Props) {
  const router = useRouter()
  const [digits, setDigits] = useState<string[]>(['', '', '', ''])
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const refs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (open) {
      setDigits(['', '', '', ''])
      setError('')
      setTimeout(() => refs.current[0]?.focus(), 50)
    }
  }, [open])

  function setDigit(idx: number, value: string) {
    const num = value.replace(/\D/g, '').slice(-1)
    setError('')
    setDigits((prev) => {
      const next = [...prev]
      next[idx] = num
      return next
    })
    if (num && idx < 3) {
      refs.current[idx + 1]?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus()
    }
    if (e.key === 'Enter') {
      submit()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pasted.length === 0) return
    e.preventDefault()
    const next = ['', '', '', '']
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setDigits(next)
    setError('')
    const focusIdx = Math.min(pasted.length, 3)
    setTimeout(() => refs.current[focusIdx]?.focus(), 0)
  }

  function submit() {
    const pin = digits.join('')
    if (pin.length !== 4 || pending) return
    startTransition(async () => {
      const res = await verifyOwnerPin(pin)
      if (res.ok) {
        markOwnerSessionUnlocked()
        onClose()
        router.push(redirectTo)
      } else {
        setError(res.error ?? 'PIN이 올바르지 않습니다')
        setDigits(['', '', '', ''])
        setTimeout(() => refs.current[0]?.focus(), 0)
      }
    })
  }

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FAFAF8',
          border: '1px solid #E8E5E0',
          borderRadius: 0,
          width: '100%',
          maxWidth: 340,
          padding: '28px 24px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#8A8A7A',
            textAlign: 'center',
          }}
        >
          OWNER ACCESS
        </p>
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            color: '#1A1A1A',
            textAlign: 'center',
            letterSpacing: '0.02em',
          }}
        >
          대시보드 접근을 위해 PIN을 입력하세요
        </p>

        <div
          style={{
            marginTop: 24,
            display: 'flex',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={1}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={handlePaste}
              style={{
                width: 48,
                height: 56,
                textAlign: 'center',
                fontSize: 22,
                fontWeight: 300,
                background: '#FFFFFF',
                border: '1px solid #E8E5E0',
                borderRadius: 0,
                outline: 'none',
                color: '#1A1A1A',
              }}
            />
          ))}
        </div>

        {error && (
          <p
            style={{
              marginTop: 14,
              fontSize: 12,
              color: '#B85450',
              textAlign: 'center',
              letterSpacing: '0.02em',
            }}
          >
            {error}
          </p>
        )}

        <div style={{ marginTop: 22, display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: 42,
              background: '#FFFFFF',
              border: '1px solid #E8E5E0',
              borderRadius: 0,
              fontSize: 12,
              letterSpacing: '0.08em',
              color: '#8A8A7A',
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || digits.join('').length !== 4}
            style={{
              flex: 1,
              height: 42,
              background: '#C9A96E',
              border: 'none',
              borderRadius: 0,
              fontSize: 12,
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
              color: '#FFFFFF',
              cursor: pending ? 'wait' : 'pointer',
              opacity: digits.join('').length !== 4 ? 0.5 : 1,
            }}
          >
            {pending ? '확인 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}
