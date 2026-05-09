'use client'

// =============================================================
// 직원 관리 — 이름/컬러/순서/활성 편집
// =============================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateStaff,
  swapStaffOrder,
  type Staff,
} from '@/lib/booking/actions'

// ─── 컬러 팔레트 (8색 — 보석 무드) ───
const PALETTE = [
  { hex: '#7B6B8E', name: '아메시스트' },
  { hex: '#5D8C7B', name: '에메랄드' },
  { hex: '#6886A0', name: '사파이어' },
  { hex: '#6B8A8E', name: '아쿠아' },
  { hex: '#B0706F', name: '가넷' },
  { hex: '#8E7B6B', name: '앰버' },
  { hex: '#7A7B8E', name: '탄자나이트' },
  { hex: '#8C7E72', name: '워밍그레이' },
] as const

type Props = {
  initialStaff: Staff[]
}

export default function StaffManager({ initialStaff }: Props) {
  const router = useRouter()
  const [staff, setStaff] = useState<Staff[]>(initialStaff)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  /** 다른 직원이 사용 중인 색상 맵 (해당 직원 제외) */
  function usedColors(excludeId: string): Map<string, string> {
    const m = new Map<string, string>()
    for (const s of staff) {
      if (s.id !== excludeId) m.set(s.signature_color, s.name)
    }
    return m
  }

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function handleSaveName(id: string) {
    const trimmed = draftName.trim()
    if (!trimmed) {
      setError('이름을 입력해 주세요')
      return
    }
    setBusyId(id)
    setError(null)
    const r = await updateStaff(id, { name: trimmed })
    setBusyId(null)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setStaff((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)),
    )
    setEditingId(null)
    refresh()
  }

  async function handleColorChange(id: string, color: string) {
    setBusyId(id)
    setError(null)
    const r = await updateStaff(id, { signature_color: color })
    setBusyId(null)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setStaff((prev) =>
      prev.map((s) => (s.id === id ? { ...s, signature_color: color } : s)),
    )
    refresh()
  }

  async function handleToggleActive(id: string, current: boolean) {
    setBusyId(id)
    setError(null)
    const r = await updateStaff(id, { is_active: !current })
    setBusyId(null)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setStaff((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: !current } : s)),
    )
    refresh()
  }

  async function handleMove(id: string, direction: -1 | 1) {
    const idx = staff.findIndex((s) => s.id === id)
    const targetIdx = idx + direction
    if (idx < 0 || targetIdx < 0 || targetIdx >= staff.length) return

    const a = staff[idx]
    const b = staff[targetIdx]

    setBusyId(id)
    setError(null)
    const r = await swapStaffOrder(a.id, b.id)
    setBusyId(null)
    if (!r.ok) {
      setError(r.error)
      return
    }
    // 로컬에서도 swap
    setStaff((prev) => {
      const next = [...prev]
      const tmp = next[idx]
      next[idx] = {
        ...next[targetIdx],
        display_order: tmp.display_order,
      }
      next[targetIdx] = { ...tmp, display_order: prev[targetIdx].display_order }
      // display_order로 재정렬
      next.sort((x, y) => x.display_order - y.display_order)
      return next
    })
    refresh()
  }

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E5E0',
      }}
    >
      {/* 에러 배너 */}
      {error && (
        <div
          style={{
            padding: '10px 16px',
            fontSize: 13,
            color: '#B23A3A',
            background: '#FFF5F5',
            borderBottom: '1px solid #E8E5E0',
          }}
        >
          {error}
        </div>
      )}

      {/* 빈 상태 */}
      {staff.length === 0 && (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            fontSize: 13,
            color: '#888',
          }}
        >
          등록된 직원이 없습니다.
        </div>
      )}

      {/* 직원 목록 */}
      {staff.map((s, idx) => {
        const isFirst = idx === 0
        const isLast = idx === staff.length - 1
        const used = usedColors(s.id)
        const editing = editingId === s.id
        const busy = busyId === s.id

        return (
          <div
            key={s.id}
            style={{
              padding: '20px 16px',
              borderBottom:
                idx === staff.length - 1 ? 'none' : '1px solid #E8E5E0',
              opacity: s.is_active ? 1 : 0.55,
            }}
          >
            {/* 윗줄: 순서 + 컬러 도트 + 이름 + 액션 */}
            <div className="flex items-center gap-3">
              {/* 순서 표시 */}
              <span
                style={{
                  fontSize: 11,
                  color: '#888',
                  width: 22,
                  letterSpacing: '0.05em',
                }}
              >
                {String(s.display_order).padStart(2, '0')}
              </span>

              {/* 시그니처 컬러 도트 */}
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: s.signature_color,
                  flexShrink: 0,
                }}
              />

              {/* 이름 (편집 가능) */}
              <div style={{ flex: 1 }}>
                {!editing ? (
                  <button
                    onClick={() => {
                      setEditingId(s.id)
                      setDraftName(s.name)
                      setError(null)
                    }}
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#1A1A1A',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {s.name}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          e.preventDefault()
                          handleSaveName(s.id)
                        } else if (e.key === 'Escape') {
                          setEditingId(null)
                        }
                      }}
                      disabled={busy}
                      style={inputStyle}
                    />
                    <button
                      onClick={() => handleSaveName(s.id)}
                      disabled={busy}
                      style={btnPrimary}
                    >
                      {busy ? '…' : '저장'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={busy}
                      style={btnSecondary}
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>

              {/* 우측 액션: 위/아래 + 활성 */}
              {!editing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMove(s.id, -1)}
                    disabled={isFirst || busy}
                    title="위로"
                    style={{
                      ...btnIcon,
                      opacity: isFirst ? 0.3 : 1,
                      cursor: isFirst ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMove(s.id, 1)}
                    disabled={isLast || busy}
                    title="아래로"
                    style={{
                      ...btnIcon,
                      opacity: isLast ? 0.3 : 1,
                      cursor: isLast ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleToggleActive(s.id, s.is_active)}
                    disabled={busy}
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.05em',
                      padding: '6px 10px',
                      background: s.is_active ? '#1A1A1A' : '#FFFFFF',
                      color: s.is_active ? '#FFFFFF' : '#666',
                      border: '1px solid #1A1A1A',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.is_active ? '활성' : '비활성'}
                  </button>
                </div>
              )}
            </div>

            {/* 아래줄: 컬러 팔레트 */}
            <div
              className="mt-3 flex flex-wrap gap-2"
              style={{ paddingLeft: 38 }}
            >
              {PALETTE.map((p) => {
                const selected = s.signature_color === p.hex
                const usedBy = used.get(p.hex)
                return (
                  <button
                    key={p.hex}
                    onClick={() => handleColorChange(s.id, p.hex)}
                    disabled={busy || selected}
                    title={
                      usedBy
                        ? `${p.name} (사용 중: ${usedBy})`
                        : p.name
                    }
                    style={{
                      position: 'relative',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: p.hex,
                      border: selected
                        ? '2px solid #1A1A1A'
                        : '1px solid #E8E5E0',
                      boxShadow: selected
                        ? '0 0 0 2px #FFFFFF inset'
                        : 'none',
                      cursor: selected ? 'default' : 'pointer',
                      padding: 0,
                    }}
                    aria-label={p.name}
                    aria-pressed={selected}
                  >
                    {/* 선택됨 — 체크 */}
                    {selected && (
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF',
                          fontSize: 12,
                          fontWeight: 700,
                          lineHeight: 1,
                        }}
                      >
                        ✓
                      </span>
                    )}
                    {/* 다른 사람 사용 중 — 작은 점 */}
                    {!selected && usedBy && (
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute',
                          right: -2,
                          bottom: -2,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#888',
                          border: '1.5px solid #FFFFFF',
                        }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}


// ─── 스타일 ───

const inputStyle: React.CSSProperties = {
  fontSize: 14,
  padding: '8px 10px',
  background: '#FFFFFF',
  color: '#1A1A1A',
  border: '1px solid #E8E5E0',
  outline: 'none',
  flex: 1,
}

const btnPrimary: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.05em',
  padding: '8px 14px',
  background: '#1A1A1A',
  color: '#FFFFFF',
  border: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const btnSecondary: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.05em',
  padding: '8px 14px',
  background: '#FFFFFF',
  color: '#1A1A1A',
  border: '1px solid #E8E5E0',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const btnIcon: React.CSSProperties = {
  width: 28,
  height: 28,
  fontSize: 14,
  background: '#FFFFFF',
  color: '#1A1A1A',
  border: '1px solid #E8E5E0',
  cursor: 'pointer',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
