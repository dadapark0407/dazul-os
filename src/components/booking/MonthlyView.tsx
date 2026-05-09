'use client'

// =============================================================
// 월간 캘린더 뷰 — 날짜 셀마다 예약 목록 텍스트로 표시
// =============================================================

import { useState, useEffect } from 'react'
import { DetailModal } from './AppointmentBlock'
import type { Appointment, Staff } from '@/lib/booking/actions'
import { updateAppointment } from '@/lib/booking/actions'

type Props = {
  year: number
  month: number
  staff: Staff[]
  appointments: Appointment[]
  onDateSelect: (date: string) => void   // 날짜 클릭 → 일간 뷰 전환
  onChanged: () => void                   // 예약 수정/삭제 후 새로고침
  onDateChange: (date: string) => void    // 예약 날짜 변경 후 일간 뷰 전환
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

export default function MonthlyView({
  year,
  month,
  staff,
  appointments,
  onDateSelect,
  onChanged,
  onDateChange,
}: Props) {
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [localAppts, setLocalAppts] = useState<Appointment[]>(appointments)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)

  useEffect(() => { setLocalAppts(appointments) }, [appointments])

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

    const result = await updateAppointment(appointmentId, { start_at: newStartAt })

    if (!result.ok) {
      setLocalAppts(prev)
    } else {
      onChanged()
    }
  }

  const today = todayKst()
  const calDays = buildCalendarDays(year, month)

  // 날짜별 예약 그룹화
  const apptsByDate = new Map<string, Appointment[]>()
  for (const a of localAppts) {
    const d = isoToKstDate(a.start_at)
    if (!apptsByDate.has(d)) apptsByDate.set(d, [])
    apptsByDate.get(d)!.push(a)
  }

  return (
    <>
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E5E0',
          overflowX: 'auto',
        }}
      >
        <div style={{ minWidth: 560 }}>

          {/* ── 요일 헤더 ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
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

          {/* ── 날짜 셀 그리드 ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {calDays.map((calDay) => {
              const dayAppts = apptsByDate.get(calDay.date) ?? []
              const isToday = calDay.date === today

              return (
                <div
                  key={calDay.date}
                  onClick={() => onDateSelect(calDay.date)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverDate(calDay.date) }}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={(e) => handleMonthlyDrop(e, calDay.date)}
                  className={dragOverDate === calDay.date ? 'bg-[#C9A96E]/10 ring-1 ring-[#C9A96E]/30' : ''}
                  style={{
                    minHeight: 120,
                    borderRight: '1px solid #E8E5E0',
                    borderBottom: '1px solid #E8E5E0',
                    padding: '6px 6px 10px',
                    opacity: calDay.currentMonth ? 1 : 0.35,
                    cursor: 'pointer',
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

                  {/* 예약 목록 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {dayAppts.map((a) => {
                      const time = isoToKstHHMM(a.start_at)
                      const staffMember = staff.find((s) => s.id === a.staff_id)
                      const staffName = staffMember?.name
                      const sigColor = staffMember?.signature_color

                      // 포맷: {시간} {품종} {이름} {서비스} {미용사}
                      const parts: string[] = [time]
                      if (a.pet_breed) parts.push(a.pet_breed)
                      if (a.pet_name) parts.push(a.pet_name)
                      if (a.service) parts.push(a.service)
                      if (staffName) parts.push(staffName)

                      return (
                        <button
                          key={a.id}
                          draggable
                          onClick={(e) => { e.stopPropagation(); setSelectedAppt(a) }}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('appointmentId', a.id)
                            e.dataTransfer.setData('sourceDate', calDay.date)
                            e.dataTransfer.effectAllowed = 'move'
                            setDraggingId(a.id)
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          className={draggingId === a.id ? 'opacity-50 cursor-grabbing' : 'cursor-grab'}
                          style={{
                            textAlign: 'left',
                            fontSize: 11,
                            lineHeight: 1.45,
                            letterSpacing: '0.01em',
                            color: sigColor ? '#1A1A1A' : '#999',
                            background: sigColor ? hexToRgba(sigColor, 0.12) : 'transparent',
                            border: 'none',
                            borderLeft: sigColor
                              ? `5px solid ${sigColor}`
                              : '5px solid #D0D0D0',
                            padding: '0 0 0 8px',
                            wordBreak: 'break-word',
                          }}
                        >
                          {parts.join(' ')}
                          {a.note && (
                            <span style={{ color: '#AAA' }}> ({a.note})</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

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
