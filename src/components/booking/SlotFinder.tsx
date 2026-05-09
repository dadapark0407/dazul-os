'use client'

// =============================================================
// 빈 시간 찾기 — 접이식 패널
// 미용사·소요시간을 받아 30일 이내 가장 빠른 빈 슬롯을 보여준다
// =============================================================

import { useState, useTransition } from 'react'
import {
  findAvailableSlots,
  type AvailableSlot,
  type Staff,
} from '@/lib/booking/actions'

type Props = {
  groomers: Staff[]
  onSelectSlot: (date: string, startTime: string, groomerId: string) => void
}

const DURATION_OPTIONS = [60, 90, 120, 150, 180, 210, 240]

function durationLabel(min: number): string {
  const h = min / 60
  return Number.isInteger(h) ? `${h}시간` : `${h}시간`
}

function formatKoSlot(date: string, start: string, end: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = ['일', '월', '화', '수', '목', '금', '토'][
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ]
  return `${m}/${d}(${dow}) ${start}~${end}`
}

export default function SlotFinder({ groomers, onSelectSlot }: Props) {
  const [open, setOpen] = useState(false)
  const [groomerId, setGroomerId] = useState<string>(groomers[0]?.id ?? '')
  const [duration, setDuration] = useState<number>(120)
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSearch() {
    if (!groomerId) return
    startTransition(async () => {
      const r = await findAvailableSlots(groomerId, duration, 5)
      setSlots(r)
    })
  }

  return (
    <div
      style={{
        background: '#FAFAF8',
        border: '1px solid #E8E5E0',
        borderRadius: 0,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 12,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#C9A96E',
            fontWeight: 600,
          }}
        >
          빈 시간 찾기
        </span>
        <span style={{ fontSize: 14, color: '#C9A96E' }}>
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: '0 16px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1">
              <span style={{ fontSize: 12, color: '#666' }}>미용사</span>
              <select
                value={groomerId}
                onChange={(e) => setGroomerId(e.target.value)}
                style={selectStyle}
              >
                {groomers.length === 0 && <option value="">-</option>}
                {groomers.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-1 flex-col gap-1">
              <span style={{ fontSize: 12, color: '#666' }}>소요시간</span>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                style={selectStyle}
              >
                {DURATION_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {durationLabel(m)}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={handleSearch}
              disabled={isPending || !groomerId}
              style={{
                fontSize: 13,
                letterSpacing: '0.05em',
                padding: '10px 18px',
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: 'none',
                cursor: isPending || !groomerId ? 'not-allowed' : 'pointer',
                opacity: isPending || !groomerId ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {isPending ? '검색 중…' : '검색'}
            </button>
          </div>

          {slots !== null && (
            <div className="flex flex-col gap-2">
              {slots.length === 0 ? (
                <div
                  style={{ fontSize: 13, color: '#666', padding: '12px 0' }}
                >
                  30일 이내에 빈 시간이 없습니다.
                </div>
              ) : (
                slots.map((s, i) => (
                  <div
                    key={`${s.date}-${s.startTime}-${i}`}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      padding: '12px 14px',
                      background: '#FFFFFF',
                      border: '1px solid #E8E5E0',
                    }}
                  >
                    <span style={{ fontSize: 14, color: '#1A1A1A' }}>
                      {formatKoSlot(s.date, s.startTime, s.endTime)}
                    </span>
                    <button
                      onClick={() =>
                        onSelectSlot(s.date, s.startTime, groomerId)
                      }
                      style={{
                        fontSize: 12,
                        letterSpacing: '0.05em',
                        padding: '8px 14px',
                        background: '#C9A96E',
                        color: '#FFFFFF',
                        border: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      예약 →
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  fontSize: 14,
  padding: '10px 12px',
  background: '#FFFFFF',
  color: '#1A1A1A',
  border: '1px solid #E8E5E0',
  outline: 'none',
  fontFamily: 'inherit',
}
