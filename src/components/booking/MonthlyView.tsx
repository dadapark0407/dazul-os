'use client'

// =============================================================
// 월간 캘린더 뷰 — 날짜 셀마다 예약 목록 텍스트로 표시
// =============================================================

import { useState, useEffect } from 'react'
import { DetailModal } from './AppointmentBlock'
import MonthlySearch from './MonthlySearch'
import type { Appointment, Staff } from '@/lib/booking/actions'
import { updateAppointment } from '@/lib/booking/actions'
import { getSessionActor } from '@/lib/booking/actor-client'
import { isClosedDow } from '@/lib/booking/constants'

type Props = {
  year: number
  month: number
  staff: Staff[]
  appointments: Appointment[]
  onDateSelect: (date: string) => void   // 날짜 클릭 → 일간 뷰 전환
  onChanged: () => void                   // 예약 수정/삭제 후 새로고침
  onDateChange: (date: string) => void    // 예약 날짜 변경 후 일간 뷰 전환
  filterGroomerId?: string | null
}

type CalendarDay = {
  date: string       // YYYY-MM-DD
  day: number
  currentMonth: boolean
}

// ─── 컬러 헬퍼 ───

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ─── KST 헬퍼 ───

function isoToKstDate(iso: string): string {
  const d = new Date(iso)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function isoToKstHHMM(iso: string): string {
  const d = new Date(iso)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const h = String(kst.getUTCHours()).padStart(2, '0')
  const m = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function todayKst(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

// ─── 달력 셀 생성 ───

function buildCalendarDays(year: number, month: number): CalendarDay[] {
  // 해당 월 1일의 요일 (0=일, 1=월 … 6=토) → 월요일 기준 변환
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const startDow = (firstDow + 6) % 7   // 월=0, 화=1, …, 일=6

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const daysInPrevMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate()

  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1

  const days: CalendarDay[] = []

  // 이전 달 채우기
  for (let i = startDow - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    days.push({
      date: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      day: d,
      currentMonth: false,
    })
  }

  // 현재 달
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      day: d,
      currentMonth: true,
    })
  }

  // 다음 달 채우기 (마지막 행 완성)
  const totalCells = Math.ceil(days.length / 7) * 7
  let nd = 1
  while (days.length < totalCells) {
    days.push({
      date: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nd).padStart(2, '0')}`,
      day: nd,
      currentMonth: false,
    })
    nd++
  }

  return days
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const

// 월~일 컬럼 너비 비율 — 휴무일(수/일)은 좁게.
const GRID_COLUMNS = '1.4fr 1.4fr 0.5fr 1.4fr 1.4fr 1.4fr 0.5fr'

// 일=0 ~ 토=6 (UTCDay 기준)
const KO_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 한국 성씨 1자 가정 — "강수진" → "수진" */
function givenName(fullName: string | null | undefined): string | null {
  if (!fullName) return null
  return fullName.length >= 2 ? fullName.slice(1) : fullName
}

/** "5/13(화)" 형태로 포맷 */
function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}/${d}(${KO_WEEKDAYS[dow]})`
}

function nextYM(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

export default function MonthlyView({
  year,
  month,
  staff,
  appointments,
  onDateSelect,
  onChanged,
  onDateChange,
  filterGroomerId,
}: Props) {
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [localAppts, setLocalAppts] = useState<Appointment[]>(appointments)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [copiedDate, setCopiedDate] = useState<string | null>(null)

  useEffect(() => { setLocalAppts(appointments) }, [appointments])

  /** 해당 날짜의 예약을 시간순 텍스트로 클립보드에 복사 */
  async function handleCopyDay(
    e: React.MouseEvent,
    dateStr: string,
    dayAppts: Appointment[],
  ) {
    e.stopPropagation()
    const sorted = [...dayAppts].sort((a, b) => a.start_at.localeCompare(b.start_at))

    const lines: string[] = [formatDateHeader(dateStr)]
    for (const a of sorted) {
      const time = isoToKstHHMM(a.start_at)
      const staffMember = staff.find((s) => s.id === a.staff_id)
      const staffShort = givenName(staffMember?.name ?? null)

      const parts: string[] = [time]
      if (a.pet_name) parts.push(a.pet_name)
      if (a.pet_breed) parts.push(a.pet_breed)
      if (a.service) parts.push(a.service)
      let line = parts.join(' ')
      if (staffShort) line += ` - ${staffShort}`
      if (a.assign_type === 'random') line += ' (자동)'
      const noteTrim = a.note?.trim()
      if (noteTrim) line += ` (${noteTrim})`
      lines.push(line)
    }
    const text = lines.join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopiedDate(dateStr)
      setTimeout(() => {
        setCopiedDate((cur) => (cur === dateStr ? null : cur))
      }, 1500)
    } catch {
      // 클립보드 권한 없으면 무시
    }
  }

  async function handleMonthlyDrop(e: React.DragEvent, targetDate: string) {
    e.preventDefault()
    setDragOverDate(null)
    setDraggingId(null)

    const appointmentId = e.dataTransfer.getData('appointmentId')
    const sourceDate = e.dataTransfer.getData('sourceDate')
    if (!appointmentId || sourceDate === targetDate) return

    const target = localAppts.find((a) => a.id === appointmentId)
    if (!target) return

    const hhmm = isoToKstHHMM(target.start_at)
    const newStartAt = new Date(`${targetDate}T${hhmm}:00+09:00`).toISOString()

    const prev = [...localAppts]
    setLocalAppts((cur) =>
      cur.map((a) => (a.id === appointmentId ? { ...a, start_at: newStartAt } : a)),
    )

    const result = await updateAppointment(
      appointmentId,
      { start_at: newStartAt },
      getSessionActor(),
    )

    if (!result.ok) {
      setLocalAppts(prev)
    } else {
      onChanged()
    }
  }

  const today = todayKst()

  // UI 레이어 필터 — 표시만 거름 (드래그/수정 등은 localAppts 전체 기준 그대로)
  //   - 취소/노쇼는 캘린더에서 완전히 숨김
  //   - 미용사 필터가 있으면 그 미용사 예약만
  const visibleAppts = localAppts.filter((a) => {
    if (a.status === 'cancelled' || a.status === 'noshow') return false
    if (filterGroomerId && a.staff_id !== filterGroomerId) return false
    return true
  })

  // 날짜별 예약 그룹화 (두 달치 모두 한 맵에)
  const apptsByDate = new Map<string, Appointment[]>()
  for (const a of visibleAppts) {
    const d = isoToKstDate(a.start_at)
    if (!apptsByDate.has(d)) apptsByDate.set(d, [])
    apptsByDate.get(d)!.push(a)
  }

  const filteredStaffName = filterGroomerId
    ? staff.find((s) => s.id === filterGroomerId)?.name ?? null
    : null

  const next = nextYM(year, month)

  /** 한 달치 섹션 렌더링 (월 헤더 + 요일 헤더 + 날짜 셀 그리드). */
  function renderMonthSection(y: number, m: number, isFirst: boolean) {
    const calDays = buildCalendarDays(y, m)
    return (
      <div style={{ borderTop: isFirst ? 'none' : '1px solid #E8E5E0' }}>
        {/* 월 헤더 */}
        <div
          style={{
            padding: '12px 14px',
            background: '#FAFAF8',
            borderBottom: '1px solid #E8E5E0',
            fontSize: 13,
            letterSpacing: '0.05em',
            fontWeight: 600,
            color: '#1A1A1A',
          }}
        >
          {y}년 {m}월
          {filteredStaffName && (
            <span style={{ marginLeft: 8, color: '#C9A96E' }}>— {filteredStaffName}</span>
          )}
        </div>

        {/* 요일 헤더 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_COLUMNS,
            borderBottom: '1px solid #E8E5E0',
          }}
        >
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              style={{
                padding: '10px 0',
                textAlign: 'center',
                fontSize: 12,
                letterSpacing: '0.08em',
                fontWeight: 600,
                color: '#888',
                borderRight: '1px solid #E8E5E0',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 셀 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: GRID_COLUMNS }}>
          {calDays.map((calDay) => renderDayCell(calDay))}
        </div>
      </div>
    )
  }

  /** 단일 셀 렌더링 — 두 달치 그리드에서 공통 사용.
   *  off-month 칸(이전/다음 달 그리드 패딩)은 예약/복사 버튼 미표시 — 다른 섹션에서 표시되므로 중복 방지. */
  function renderDayCell(calDay: CalendarDay) {
              const dayAppts = calDay.currentMonth ? (apptsByDate.get(calDay.date) ?? []) : []
              const isToday = calDay.date === today
              const [yy, mm, dd] = calDay.date.split('-').map(Number)
              const dow = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()
              const isClosed = isClosedDow(dow)

              return (
                <div
                  key={calDay.date}
                  onClick={() => onDateSelect(calDay.date)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverDate(calDay.date) }}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={(e) => handleMonthlyDrop(e, calDay.date)}
                  className={dragOverDate === calDay.date ? 'bg-[#C9A96E]/10 ring-1 ring-[#C9A96E]/30' : ''}
                  style={{
                    position: 'relative',
                    minHeight: 120,
                    borderRight: '1px solid #E8E5E0',
                    borderBottom: '1px solid #E8E5E0',
                    padding: '6px 6px 10px',
                    opacity: calDay.currentMonth ? 1 : 0.35,
                    cursor: 'pointer',
                    background: isClosed ? '#F5F5F3' : undefined,
                  }}
                >
                  {/* 날짜 숫자 버튼 → 일간 뷰로 이동 (버블링 방지: 셀이 이미 처리) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDateSelect(calDay.date) }}
                    style={{
                      display: 'inline-block',
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      color: isToday ? '#C9A96E' : '#1A1A1A',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0 2px 4px',
                      lineHeight: 1,
                    }}
                  >
                    {calDay.day}
                  </button>
                  {isClosed && (
                    <span
                      style={{
                        fontSize: 10,
                        color: '#888',
                        marginLeft: 4,
                        letterSpacing: '0.02em',
                      }}
                    >
                      휴무
                    </span>
                  )}

                  {/* 복사 버튼 — 예약 있을 때만, 우측 상단 */}
                  {dayAppts.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => handleCopyDay(e, calDay.date, dayAppts)}
                      aria-label="이 날짜의 예약 복사"
                      title="이 날짜의 예약 복사"
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 18,
                        height: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#C9A96E',
                        fontSize: 12,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      {copiedDate === calDay.date ? (
                        <span style={{ fontWeight: 700 }}>✓</span>
                      ) : (
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  )}

                  {/* 예약 목록 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {dayAppts.map((a) => {
                      const time = isoToKstHHMM(a.start_at)
                      const staffMember = staff.find((s) => s.id === a.staff_id)
                      const staffName = staffMember?.name
                      const sigColor = staffMember?.signature_color
                      const isRandom = a.assign_type === 'random'
                      const cancelled =
                        a.status === 'cancelled' || a.status === 'noshow'
                      const isNoshow = a.status === 'noshow'

                      // 포맷: {시간} {품종} {이름} {서비스} {미용사}
                      const parts: string[] = [time]
                      if (a.pet_breed) parts.push(a.pet_breed)
                      if (a.pet_name) parts.push(a.pet_name)
                      if (a.service) parts.push(a.service)
                      if (staffName) parts.push(staffName)

                      return (
                        <button
                          key={a.id}
                          draggable={!cancelled}
                          onClick={(e) => { e.stopPropagation(); setSelectedAppt(a) }}
                          onDragStart={(e) => {
                            if (cancelled) {
                              e.preventDefault()
                              return
                            }
                            e.dataTransfer.setData('appointmentId', a.id)
                            e.dataTransfer.setData('sourceDate', calDay.date)
                            e.dataTransfer.effectAllowed = 'move'
                            setDraggingId(a.id)
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          className={
                            cancelled
                              ? 'cursor-pointer'
                              : draggingId === a.id
                              ? 'opacity-50 cursor-grabbing'
                              : 'cursor-grab'
                          }
                          style={{
                            textAlign: 'left',
                            fontSize: 11,
                            lineHeight: 1.45,
                            letterSpacing: '0.01em',
                            color: sigColor ? '#1A1A1A' : '#999',
                            background: sigColor ? hexToRgba(sigColor, 0.12) : 'transparent',
                            border: isRandom
                              ? `1px dashed ${sigColor ?? '#888'}`
                              : 'none',
                            borderLeft: sigColor
                              ? `5px ${isRandom ? 'dashed' : 'solid'} ${sigColor}`
                              : `5px ${isRandom ? 'dashed' : 'solid'} #D0D0D0`,
                            padding: '0 0 0 8px',
                            wordBreak: 'break-word',
                            // 취소된 예약은 흐리게 + 취소선
                            opacity: cancelled ? 0.4 : isRandom ? 0.7 : 1,
                            textDecoration: cancelled ? 'line-through' : 'none',
                          }}
                        >
                          {parts.join(' ')}
                          {isRandom && (
                            <span style={{ color: '#B23A3A', fontWeight: 700, marginLeft: 4 }}>
                              자동
                            </span>
                          )}
                          {cancelled && (
                            <span
                              style={{
                                color: '#FFFFFF',
                                background: '#B23A3A',
                                fontWeight: 700,
                                marginLeft: 4,
                                padding: '0 4px',
                                textDecoration: 'none',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {isNoshow ? '노쇼' : '취소'}
                            </span>
                          )}
                          {a.note && (
                            <span style={{ color: '#AAA' }}> ({a.note})</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
  }

  return (
    <>
      {/* ── 검색 (월간 뷰 상단) ── */}
      <div style={{ marginBottom: 12 }}>
        <MonthlySearch onPick={(d) => onDateSelect(d)} />
      </div>

      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E5E0',
          overflowX: 'auto',
          overflowY: 'auto',
        }}
      >
        <div style={{ minWidth: 560 }}>
          {renderMonthSection(year, month, true)}
          {renderMonthSection(next.year, next.month, false)}
        </div>
      </div>

      {/* ── 상세 모달 (AppointmentBlock 재사용) ── */}
      {selectedAppt && (
        <DetailModal
          appointment={selectedAppt}
          staff={staff}
          onClose={() => setSelectedAppt(null)}
          onChanged={() => {
            setSelectedAppt(null)
            onChanged()
          }}
          onDateChange={(newDate) => {
            setSelectedAppt(null)
            onDateChange(newDate)
          }}
        />
      )}
    </>
  )
}
