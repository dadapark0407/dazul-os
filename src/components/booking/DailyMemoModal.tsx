'use client'

// =============================================================
// 일일 메모 입력 모달 — StaffOffManager 패턴 재사용
// =============================================================

import { useEffect, useState, useTransition } from 'react'
import {
  createDailyMemo,
  deleteDailyMemo,
} from '@/lib/booking/actions'

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

function formatKoDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}/${d}(${WEEKDAYS_KO[dow]})`
}

function iterateDateRange(startStr: string, endStr: string): string[] {
  const parseDate = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
  }
  const start = parseDate(startStr)
  const end = parseDate(endStr)
  if (start.getTime() > end.getTime()) return []
  const result: string[] = []
  const cur = new Date(start)
  while (cur.getTime() <= end.getTime()) {
    const y = cur.getUTCFullYear()
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0')
    const d = String(cur.getUTCDate()).padStart(2, '0')
    result.push(`${y}-${m}-${d}`)
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return result
}

// ─── 스타일 ───

const sectionStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E8E5E0',
  borderRadius: 0,
  padding: 20,
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  fontWeight: 600,
  color: '#8B7355',
  marginBottom: 8,
}

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: '8px 10px',
  background: '#FFFFFF',
  color: '#1A1A1A',
  border: '1px solid #E8E5E0',
  borderRadius: 0,
  outline: 'none',
  fontFamily: 'inherit',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 84,
  resize: 'vertical',
  lineHeight: 1.5,
}

const primaryBtnStyle: React.CSSProperties = {
  fontSize: 13,
  letterSpacing: '0.05em',
  padding: '10px 20px',
  background: '#1A1A1A',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 600,
}

const cancelBtnStyle: React.CSSProperties = {
  fontSize: 13,
  letterSpacing: '0.05em',
  padding: '10px 20px',
  background: '#FFFFFF',
  color: '#1A1A1A',
  border: '1px solid #E8E5E0',
  borderRadius: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

// =============================================================

type Props = {
  open: boolean
  initialDate: string
  existingMemos: { id: string; content: string }[]
  onClose: () => void
  onChanged: () => void
}

export default function DailyMemoModal({
  open,
  initialDate,
  existingMemos,
  onClose,
  onChanged,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [content, setContent] = useState('')
  const [rangeMode, setRangeMode] = useState(false)
  const [dateStart, setDateStart] = useState(initialDate)
  const [dateEnd, setDateEnd] = useState(initialDate)
  const [msg, setMsg] = useState<string | null>(null)

  // 열릴 때 상태 초기화
  useEffect(() => {
    if (open) {
      setContent('')
      setRangeMode(false)
      setDateStart(initialDate)
      setDateEnd(initialDate)
      setMsg(null)
    }
  }, [open, initialDate])

  // ESC 닫기
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit() {
    setMsg(null)
    const trimmed = content.trim()
    if (!trimmed) {
      setMsg('내용을 입력해 주세요')
      return
    }
    const dates = rangeMode ? iterateDateRange(dateStart, dateEnd) : [dateStart]
    if (dates.length === 0) {
      setMsg('날짜 범위가 유효하지 않습니다')
      return
    }
    startTransition(async () => {
      const r = await createDailyMemo(dates, trimmed)
      if (!r.ok) {
        setMsg(r.error ?? '등록 실패')
        return
      }
      onChanged()
      onClose()
    })
  }

  async function handleDeleteExisting(id: string) {
    if (!window.confirm('이 메모를 삭제할까요?')) return
    startTransition(async () => {
      const r = await deleteDailyMemo(id)
      if (!r.ok) {
        setMsg(r.error ?? '삭제 실패')
        return
      }
      onChanged()
    })
  }

  const canSubmit = !isPending && content.trim().length > 0

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '10vh 16px 16px',
        overflowY: 'auto',
      }}
    >
      <section
        onClick={(e) => e.stopPropagation()}
        style={{
          ...sectionStyle,
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: '#1A1A1A',
            }}
          >
            메모 추가
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 24,
              height: 24,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              color: '#888',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 내용 */}
        <div className="flex flex-col">
          <span style={sectionLabelStyle}>내용</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="전체 회식"
            style={textareaStyle}
            autoFocus
          />
        </div>

        {/* 날짜 */}
        <div className="flex flex-col gap-2">
          <span style={sectionLabelStyle}>날짜</span>
          <div
            className="flex items-center gap-3"
            style={{ fontSize: 12, color: '#666' }}
          >
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                checked={!rangeMode}
                onChange={() => setRangeMode(false)}
              />
              <span>단일 날짜</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                checked={rangeMode}
                onChange={() => setRangeMode(true)}
              />
              <span>범위 (시작일~종료일)</span>
            </label>
          </div>
          {rangeMode ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                style={inputStyle}
              />
              <span style={{ color: '#888' }}>~</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                style={inputStyle}
              />
            </div>
          ) : (
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              style={{ ...inputStyle, maxWidth: 200 }}
            />
          )}
        </div>

        {/* 기존 메모 */}
        {existingMemos.length > 0 && (
          <div className="flex flex-col">
            <span style={sectionLabelStyle}>
              {formatKoDate(initialDate)} 기존 메모 ({existingMemos.length})
            </span>
            <div className="flex flex-col">
              {existingMemos.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between"
                  style={{
                    padding: '10px 0',
                    borderTop: '1px solid #E8E5E0',
                    fontSize: 13,
                    color: '#1A1A1A',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      lineHeight: 1.5,
                    }}
                  >
                    {m.content}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteExisting(m.id)}
                    disabled={isPending}
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.04em',
                      padding: '6px 10px',
                      background: '#FFFFFF',
                      color: '#B23A3A',
                      border: '1px solid #E8E5E0',
                      borderRadius: 0,
                      cursor: isPending ? 'not-allowed' : 'pointer',
                      opacity: isPending ? 0.5 : 1,
                      fontFamily: 'inherit',
                      flexShrink: 0,
                    }}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {msg && (
          <div style={{ fontSize: 12, color: '#B23A3A' }}>{msg}</div>
        )}

        {/* 액션 버튼 */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
              ...cancelBtnStyle,
              opacity: isPending ? 0.5 : 1,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              ...primaryBtnStyle,
              opacity: canSubmit ? 1 : 0.5,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {isPending ? '저장 중…' : '확인'}
          </button>
        </div>
      </section>
    </div>
  )
}
