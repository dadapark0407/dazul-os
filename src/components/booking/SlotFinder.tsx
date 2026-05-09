'use client'

// =============================================================
// 빈 시간 찾기 — 접이식 패널
// 미용사·소요시간·주를 받아 7일치 빈 구간을 보여준다
// =============================================================

import { useMemo, useState, useTransition } from 'react'
import {
  findAvailableSlots,
  type Staff,
  type WeeklyAvailability,
} from '@/lib/booking/actions'

type Props = {
  groomers: Staff[]
  onSelectSlot: (date: string, startTime: string, groomerId: string) => void
}

const DURATION_OPTIONS = [60, 90, 120, 150, 180, 210, 240]

function durationLabel(min: number): string {
  return `${min / 60}시간`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 오늘(KST) 기준 해당 주의 월요일 "YYYY-MM-DD" */
function mondayOfWeek(date: Date): string {
  // KST 기준 날짜로 변환
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const dow = kst.getUTCDay() // 0=Sun…6=Sat
  const offsetToMon = (dow + 6) % 7 // Mon=0, Sun=6
  const mon = new Date(kst.getTime() - offsetToMon * 86400000)
  return `${mon.getUTCFullYear()}-${pad2(mon.getUTCMonth() + 1)}-${pad2(mon.getUTCDate())}`
}

function addDaysStr(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

const WEEK_OPTIONS_LABELS = ['이번 주', '다음 주', '2주 후', '3주 후', '4주 후']

export default function SlotFinder({ groomers, onSelectSlot }: Props) {
  const [open, setOpen] = useState(false)
  const [groomerId, setGroomerId] = useState<string>(groomers[0]?.id ?? '')
  const [duration, setDuration] = useState<number>(120)

  const weekOptions = useMemo(() => {
    const thisMon = mondayOfWeek(new Date())
    return WEEK_OPTIONS_LABELS.map((label, i) => ({
      label,
      value: addDaysStr(thisMon, i * 7),
    }))
  }, [])

  const [weekStart, setWeekStart] = useState<string>(weekOptions[0].value)
  const [days, setDays] = useState<WeeklyAvailability[] | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSearch() {
    if (!groomerId) return
    startTransition(async () => {
      const r = await findAvailableSlots(groomerId, duration, weekStart)
      setDays(r)
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
          {/* ─── 입력 행 ─── */}
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

            <label className="flex flex-1 flex-col gap-1">
              <span style={{ fontSize: 12, color: '#666' }}>주</span>
              <select
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                style={selectStyle}
              >
                {weekOptions.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
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

          {/* ─── 결과 ─── */}
          {days !== null && (
            <div className="flex flex-col" style={{ gap: 6 }}>
              {days.map((day) => (
                <DayRow
                  key={day.date}
                  day={day}
                  onSelect={(start) => onSelectSlot(day.date, start, groomerId)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DayRow({
  day,
  onSelect,
}: {
  day: WeeklyAvailability
  onSelect: (startTime: string) => void
}) {
  // 휴무일
  if (day.isClosed) {
    return (
      <div
        className="flex flex-col gap-1 sm:flex-row sm:items-center"
        style={{
          padding: '10px 12px',
          background: '#E8E5E0',
          color: '#888',
        }}
      >
        <span style={{ ...labelStyle, color: '#888' }}>{day.dayLabel}</span>
        <span style={{ fontSize: 13, color: '#888' }}>휴무</span>
      </div>
    )
  }

  // 영업일이나 가용 없음
  if (day.ranges.length === 0) {
    return (
      <div
        className="flex flex-col gap-1 sm:flex-row sm:items-center"
        style={{
          padding: '10px 12px',
          background: '#FFFFFF',
          border: '1px solid #E8E5E0',
        }}
      >
        <span style={labelStyle}>{day.dayLabel}</span>
        <span style={{ fontSize: 13, color: '#888' }}>예약 마감</span>
      </div>
    )
  }

  // 가용 구간 표시
  return (
    <div
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
      style={{
        padding: '10px 12px',
        background: '#FFFFFF',
        border: '1px solid #E8E5E0',
      }}
    >
      <span style={labelStyle}>{day.dayLabel}</span>
      <div className="flex flex-wrap gap-2">
        {day.ranges.map((r, i) => (
          <RangeTag
            key={`${r.start}-${i}`}
            label={`${r.start}~${r.end}`}
            onClick={() => onSelect(r.start)}
          />
        ))}
      </div>
    </div>
  )
}

function RangeTag({ label, onClick }: { label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        fontSize: 13,
        letterSpacing: '0.03em',
        padding: '6px 12px',
        background: hover ? '#C9A96E' : '#FFFFFF',
        color: hover ? '#FFFFFF' : '#C9A96E',
        border: '1px solid #C9A96E',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: '#1A1A1A',
  minWidth: 64,
  whiteSpace: 'nowrap',
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
