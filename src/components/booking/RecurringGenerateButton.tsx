'use client'

// =============================================================
// 이번 달 루틴 예약 생성 버튼 (+ 토스트)
// =============================================================

import { useEffect, useState } from 'react'

type Props = {
  year: number
  month: number
  /** 생성 성공 후 캘린더 새로고침 트리거 */
  onGenerated?: () => void
}

export default function RecurringGenerateButton({ year, month, onGenerated }: Props) {
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  async function handleClick() {
    if (loading) return
    setLoading(true)
    setToast(null)
    try {
      const res = await fetch('/api/recurring/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast({ type: 'err', text: data?.error ?? '생성에 실패했습니다.' })
      } else if (data?.alreadyGenerated) {
        setToast({ type: 'warn', text: '이미 생성된 달입니다.' })
      } else {
        setToast({ type: 'ok', text: `${data?.created ?? 0}건 생성 완료` })
        onGenerated?.()
      }
    } catch {
      setToast({ type: 'err', text: '생성에 실패했습니다.' })
    } finally {
      setLoading(false)
    }
  }

  const toastColor =
    toast?.type === 'ok' ? '#1D6A4E' : toast?.type === 'warn' ? '#92560A' : '#B23A3A'

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          fontSize: 12,
          letterSpacing: '0.05em',
          padding: '8px 14px',
          background: loading ? '#FFFFFF' : '#C9A96E',
          color: loading ? '#8A8A7A' : '#FFFFFF',
          border: '1px solid #C9A96E',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          borderRadius: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? '생성 중…' : '이번 달 루틴 예약 생성'}
      </button>
      {toast && (
        <span style={{ fontSize: 12, color: toastColor, whiteSpace: 'nowrap' }}>
          {toast.text}
        </span>
      )}
    </div>
  )
}
