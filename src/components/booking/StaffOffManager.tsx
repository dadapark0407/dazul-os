'use client'

// =============================================================
// DAZUL OS — 미용사 휴무 관리 UI
// =============================================================
// - 전일 휴무 (단일 날짜 또는 시작일~종료일 범위)
// - 반차 (단일 날짜 + 종료 시간)
// - 등록된 미래 휴무 목록 (미용사별 필터 + 삭제)
// =============================================================

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createStaffOffs,
  deleteStaffOff,
  type Staff,
  type StaffOffWithStaff,
} from '@/lib/booking/actions'
import { isClosedDow } from '@/lib/booking/constants'

type Props = {
  staff: Staff[]
  initialOffs: StaffOffWithStaff[]
}

// ─── 시간 프리셋: 11:00 ~ 20:00, 30분 단위 ───
const TIME_PRESETS = (() => {
  const arr: string[] = []
  for (let h = 11; h <= 20; h++) {
    arr.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 20) arr.push(`${String(h).padStart(2, '0')}:30`)
  }
  return arr
})()

// ─── 날짜 헬퍼 ───
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

function todayKstStr(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

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

// ─── 공용 스타일 ───
const sectionStyle: React.CSSProperties = {
  background: '#FAFAF8',
  border: '1px solid #E8E5E0',
  borderRadius: 0,
  padding: 20,
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  fontWeight: 600,
  color: '#1A1A1A',
  marginBottom: 16,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
  letterSpacing: '0.04em',
  marginBottom: 4,
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

const primaryBtnStyle: React.CSSProperties = {
  fontSize: 13,
  letterSpacing: '0.05em',
  padding: '10px 18px',
  background: '#C9A96E',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 600,
}

const ghostBtnStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.04em',
  padding: '6px 10px',
  background: '#FFFFFF',
  color: '#B23A3A',
  border: '1px solid #E8E5E0',
  borderRadius: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 12,
  letterSpacing: '0.04em',
  padding: '6px 12px',
  background: active ? '#1A1A1A' : '#FFFFFF',
  color: active ? '#FFFFFF' : '#1A1A1A',
  border: '1px solid #E8E5E0',
  borderRadius: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
})

// =============================================================

export default function StaffOffManager({ staff, initialOffs }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const firstStaffId = staff[0]?.id ?? ''
  const today = todayKstStr()

  // ── 전일 휴무 form ──
  const [dayoffStaffId, setDayoffStaffId] = useState(firstStaffId)
  const [dayoffRangeMode, setDayoffRangeMode] = useState(false)
  const [dayoffStart, setDayoffStart] = useState(today)
  const [dayoffEnd, setDayoffEnd] = useState(today)
  const [dayoffMsg, setDayoffMsg] = useState<string | null>(null)

  // ── 반차 form ──
  // halfMode='morning': 특정 시간부터 출근 (start_time=11:00, end_time=출근시간)
  // halfMode='afternoon': 특정 시간까지만 근무 (start_time=퇴근시간, end_time=20:00)
  const [halfStaffId, setHalfStaffId] = useState(firstStaffId)
  const [halfDate, setHalfDate] = useState(today)
  const [halfMode, setHalfMode] = useState<'morning' | 'afternoon'>('afternoon')
  const [halfTime, setHalfTime] = useState('15:00')
  const [halfMsg, setHalfMsg] = useState<string | null>(null)

  // ── 휴무 목록 필터 ──
  const [filterStaffId, setFilterStaffId] = useState<string | null>(null)

  const visibleOffs = useMemo(() => {
    if (!filterStaffId) return initialOffs
    return initialOffs.filter((o) => o.staff_id === filterStaffId)
  }, [initialOffs, filterStaffId])

  async function handleDayoffSubmit() {
    setDayoffMsg(null)
    const dates = dayoffRangeMode
      ? iterateDateRange(dayoffStart, dayoffEnd)
      : [dayoffStart]
    if (dates.length === 0) {
      setDayoffMsg('날짜 범위가 유효하지 않습니다')
      return
    }
    startTransition(async () => {
      const r = await createStaffOffs(dayoffStaffId, dates, 'dayoff')
      if (!r.ok) {
        setDayoffMsg(r.error ?? '등록 실패')
        return
      }
      const skipped = r.skippedCount ?? 0
      setDayoffMsg(
        `${r.insertedCount}건 등록 완료${skipped > 0 ? ` (수/일 ${skipped}건 제외)` : ''}`,
      )
      router.refresh()
    })
  }

  async function handleHalfSubmit() {
    setHalfMsg(null)
    // 오전 반차: 11:00 ~ 출근 시간이 OFF
    // 오후 반차: 퇴근 시간 ~ 20:00이 OFF
    const startTime = halfMode === 'morning' ? '11:00' : halfTime
    const endTime = halfMode === 'morning' ? halfTime : '20:00'
    startTransition(async () => {
      const r = await createStaffOffs(
        halfStaffId,
        [halfDate],
        'half_off',
        startTime,
        endTime,
      )
      if (!r.ok) {
        setHalfMsg(r.error ?? '등록 실패')
        return
      }
      const label =
        halfMode === 'morning'
          ? `오전 반차 등록 완료 (${halfTime} 출근)`
          : `오후 반차 등록 완료 (${halfTime} 퇴근)`
      setHalfMsg(label)
      router.refresh()
    })
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteStaffOff(id)
      if (r.ok) router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── 전일 휴무 입력 ─── */}
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>전일 휴무</div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col">
            <span style={labelStyle}>미용사</span>
            <select
              value={dayoffStaffId}
              onChange={(e) => setDayoffStaffId(e.target.value)}
              style={inputStyle}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2" style={{ fontSize: 12, color: '#666' }}>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                checked={!dayoffRangeMode}
                onChange={() => setDayoffRangeMode(false)}
              />
              <span>단일 날짜</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                checked={dayoffRangeMode}
                onChange={() => setDayoffRangeMode(true)}
              />
              <span>범위 (시작일~종료일)</span>
            </label>
          </div>

          {dayoffRangeMode ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col">
                <span style={labelStyle}>시작일</span>
                <input
                  type="date"
                  value={dayoffStart}
                  onChange={(e) => setDayoffStart(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div className="flex flex-col">
                <span style={labelStyle}>종료일</span>
                <input
                  type="date"
                  value={dayoffEnd}
                  onChange={(e) => setDayoffEnd(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col" style={{ maxWidth: 200 }}>
              <span style={labelStyle}>날짜</span>
              <input
                type="date"
                value={dayoffStart}
                onChange={(e) => setDayoffStart(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={handleDayoffSubmit}
              disabled={isPending || !dayoffStaffId}
              style={{
                ...primaryBtnStyle,
                opacity: isPending || !dayoffStaffId ? 0.5 : 1,
                cursor: isPending || !dayoffStaffId ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? '등록 중…' : '전일 휴무 등록'}
            </button>
            {dayoffMsg && (
              <span style={{ fontSize: 12, color: '#666' }}>{dayoffMsg}</span>
            )}
          </div>
        </div>
      </section>

      {/* ─── 반차 입력 ─── */}
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>반차</div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col">
            <span style={labelStyle}>미용사</span>
            <select
              value={halfStaffId}
              onChange={(e) => setHalfStaffId(e.target.value)}
              style={inputStyle}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* 오전/오후 토글 */}
          <div className="flex items-center gap-2" style={{ fontSize: 12, color: '#666' }}>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                checked={halfMode === 'morning'}
                onChange={() => setHalfMode('morning')}
              />
              <span>오전 반차 (특정 시간부터 출근)</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                checked={halfMode === 'afternoon'}
                onChange={() => setHalfMode('afternoon')}
              />
              <span>오후 반차 (특정 시간까지만 근무)</span>
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col" style={{ maxWidth: 200 }}>
              <span style={labelStyle}>날짜</span>
              <input
                type="date"
                value={halfDate}
                onChange={(e) => setHalfDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div className="flex flex-col" style={{ maxWidth: 200 }}>
              <span style={labelStyle}>
                {halfMode === 'morning' ? '출근 시간' : '퇴근 시간'}
              </span>
              <select
                value={halfTime}
                onChange={(e) => setHalfTime(e.target.value)}
                style={inputStyle}
              >
                {TIME_PRESETS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={handleHalfSubmit}
              disabled={isPending || !halfStaffId}
              style={{
                ...primaryBtnStyle,
                opacity: isPending || !halfStaffId ? 0.5 : 1,
                cursor: isPending || !halfStaffId ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? '등록 중…' : '반차 등록'}
            </button>
            {halfMsg && (
              <span style={{ fontSize: 12, color: '#666' }}>{halfMsg}</span>
            )}
          </div>
        </div>
      </section>

      {/* ─── 등록된 휴무 목록 ─── */}
      <section style={sectionStyle}>
        <div className="flex items-center justify-between mb-3">
          <div style={{ ...sectionHeaderStyle, marginBottom: 0 }}>
            등록된 휴무 ({visibleOffs.length})
          </div>
        </div>

        {/* 미용사 필터 */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => setFilterStaffId(null)}
            style={filterBtnStyle(filterStaffId === null)}
          >
            전체
          </button>
          {staff.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilterStaffId(s.id)}
              style={filterBtnStyle(filterStaffId === s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>

        {visibleOffs.length === 0 ? (
          <div style={{ fontSize: 13, color: '#888', padding: '8px 0' }}>
            등록된 휴무가 없습니다
          </div>
        ) : (
          <div className="flex flex-col">
            {visibleOffs.map((o) => {
              const isClosed = (() => {
                const [y, m, d] = o.off_date.split('-').map(Number)
                const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
                return isClosedDow(dow)
              })()
              const typeLabel = (() => {
                if (o.off_type === 'dayoff') return '전일 휴무'
                if (o.off_type === 'lunch') {
                  return `점심 (${o.start_time ?? '?'})`
                }
                if (o.off_type === 'half_off') {
                  // start_time='11:00' → 오전 반차 (end_time 출근)
                  // end_time='20:00' → 오후 반차 (start_time 퇴근)
                  if (o.start_time === '11:00' && o.end_time) {
                    return `오전 반차 (${o.end_time} 출근)`
                  }
                  if (o.end_time === '20:00' && o.start_time) {
                    return `오후 반차 (${o.start_time} 퇴근)`
                  }
                  return `반차 (${o.start_time ?? '?'}~${o.end_time ?? '?'})`
                }
                return o.off_type
              })()
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between"
                  style={{
                    padding: '10px 0',
                    borderTop: '1px solid #E8E5E0',
                    fontSize: 13,
                    color: '#1A1A1A',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        minWidth: 64,
                        fontWeight: 600,
                        color: isClosed ? '#AAA' : '#1A1A1A',
                      }}
                    >
                      {formatKoDate(o.off_date)}
                    </span>
                    <span style={{ color: '#666' }}>{o.staff_name}</span>
                    <span style={{ color: '#888', fontSize: 12 }}>
                      {typeLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(o.id)}
                    disabled={isPending}
                    style={{
                      ...ghostBtnStyle,
                      opacity: isPending ? 0.5 : 1,
                      cursor: isPending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    삭제
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
