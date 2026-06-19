'use client'

// =============================================================
// 이번 달 루틴 예약 생성 / 취소 버튼 (+ 토스트)
// =============================================================

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'
const RECURRING_MARKER = '루틴 예약 자동 생성'

/** KST 기준 그 달의 1일 / 다음 달 1일 */
function monthRangeKst(year: number, month: number): { start: string; end: string } {
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${year}-${pad(month)}-01T00:00:00+09:00`,
    end: `${ny}-${pad(nm)}-01T00:00:00+09:00`,
  }
}

type Props = {
  year: number
  month: number
  /** 생성/취소 성공 후 캘린더 새로고침 트리거 */
  onGenerated?: () => void
}

export default function RecurringGenerateButton({ year, month, onGenerated }: Props) {
  const [loading, setLoading] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [routineCount, setRoutineCount] = useState(0)
  const [toast, setToast] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // 이달 루틴 예약 건수 조회 (취소 버튼 활성화 / 확인 다이얼로그용)
  const refreshCount = useCallback(async () => {
    const { start, end } = monthRangeKst(year, month)
    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', BRANCH_ID)
      .eq('raw_input', RECURRING_MARKER)
      .is('deleted_at', null)
      .gte('start_at', start)
      .lt('start_at', end)
    setRoutineCount(count ?? 0)
  }, [year, month])

  useEffect(() => {
    refreshCount()
  }, [refreshCount])

  async function handleGenerate() {
    if (loading || canceling) return
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
      } else {
        const created = data?.created ?? 0
        const skipped = data?.skipped ?? 0
        setToast({
          type: 'ok',
          text: skipped > 0
            ? `${created}건 생성 완료, ${skipped}건 건너뜀`
            : `${created}건 생성 완료`,
        })
        onGenerated?.()
        refreshCount()
      }
    } catch {
      setToast({ type: 'err', text: '생성에 실패했습니다.' })
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (loading || canceling || routineCount === 0) return
    const ok = window.confirm(
      `이달 루틴 예약 ${routineCount}건을 전체 취소하시겠습니까?\n수동으로 수정한 예약도 함께 삭제됩니다.`
    )
    if (!ok) return

    setCanceling(true)
    setToast(null)
    try {
      const res = await fetch('/api/recurring/cancel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast({ type: 'err', text: data?.error ?? '취소에 실패했습니다.' })
      } else {
        setToast({ type: 'ok', text: `${data?.deleted ?? 0}건 취소 완료` })
        onGenerated?.()
        refreshCount()
      }
    } catch {
      setToast({ type: 'err', text: '취소에 실패했습니다.' })
    } finally {
      setCanceling(false)
    }
  }

  const toastColor =
    toast?.type === 'ok' ? '#1D6A4E' : toast?.type === 'warn' ? '#92560A' : '#B23A3A'

  const busy = loading || canceling
  const cancelDisabled = busy || routineCount === 0

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={busy}
        style={{
          fontSize: 12,
          letterSpacing: '0.05em',
          padding: '8px 14px',
          background: busy ? '#FFFFFF' : '#C9A96E',
          color: busy ? '#8A8A7A' : '#FFFFFF',
          border: '1px solid #C9A96E',
          cursor: busy ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          borderRadius: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? '생성 중…' : '이달 루틴 예약 생성'}
      </button>

      <button
        type="button"
        onClick={handleCancel}
        disabled={cancelDisabled}
        style={{
          fontSize: 12,
          letterSpacing: '0.05em',
          padding: '8px 14px',
          background: '#FFFFFF',
          color: cancelDisabled ? '#BBB' : '#B23A3A',
          border: `1px solid ${cancelDisabled ? '#E8E5E0' : '#B23A3A'}`,
          cursor: cancelDisabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          borderRadius: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {canceling ? '취소 중…' : '이달 루틴 취소'}
      </button>

      {toast && (
        <span style={{ fontSize: 12, color: toastColor, whiteSpace: 'nowrap' }}>
          {toast.text}
        </span>
      )}
    </div>
  )
}
