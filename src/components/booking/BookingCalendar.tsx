'use client'

// =============================================================
// 예약 캘린더 — 날짜 네비 + 입력창 + 타임라인 그리드
// =============================================================

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BookingInput from './BookingInput'
import SlotFinder from './SlotFinder'
import TimelineGrid from './TimelineGrid'
import MonthlyView from './MonthlyView'
import {
  getBookingData,
  getMonthlyData,
  type Appointment,
  type Staff,
  type StaffOff,
} from '@/lib/booking/actions'

type Props = {
  initialDate: string
  initialStaff: Staff[]
  initialAppointments: Appointment[]
  initialStaffOff: StaffOff[]
}

function formatKoDate(date: string): string {
  // YYYY-MM-DD → "YYYY년 M월 D일 (요일)"
  const [y, m, d] = date.split('-').map(Number)
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()]
  return `${y}년 ${m}월 ${d}일 (${weekday})`
}

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-')
}

function todayKst(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export default function BookingCalendar({
  initialDate,
  initialStaff,
  initialAppointments,
  initialStaffOff,
}: Props) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate)
  const [staff, setStaff] = useState<Staff[]>(initialStaff)
  const [appointments, setAppointments] =
    useState<Appointment[]>(initialAppointments)
  const [staffOff, setStaffOff] = useState<StaffOff[]>(initialStaffOff)
  const [isPending, startTransition] = useTransition()

  // ── 뷰 상태 ──
  const [view, setView] = useState<'daily' | 'monthly'>('daily')
  const [viewYear, setViewYear] = useState(() => parseInt(initialDate.slice(0, 4)))
  const [viewMonth, setViewMonth] = useState(() => parseInt(initialDate.slice(5, 7)))
  const [monthlyAppts, setMonthlyAppts] = useState<Appointment[]>([])

  // ── BookingInput 외부 prefill (SlotFinder에서 트리거) ──
  const [prefillText, setPrefillText] = useState('')
  const [prefillSignal, setPrefillSignal] = useState(0)

  function handleSelectSlot(
    slotDate: string,
    startTime: string,
    groomerId: string,
  ) {
    const groomer = staff.find((s) => s.id === groomerId)
    if (!groomer) return
    const [, m, d] = slotDate.split('-').map(Number)
    setPrefillText(`${m}/${d} ${startTime} ${groomer.name} `)
    setPrefillSignal((n) => n + 1)
    setDate(slotDate)
    setView('daily')
  }

  // 날짜 변경 시 데이터 재조회
  useEffect(() => {
    if (date === initialDate) return
    refresh(date)
    // URL도 업데이트 (뒤로가기 시 복원)
    router.replace(`/admin/booking?date=${date}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  // 월간 뷰 — 연/월 변경 시 데이터 재조회
  useEffect(() => {
    if (view !== 'monthly') return
    startTransition(async () => {
      const data = await getMonthlyData(viewYear, viewMonth)
      setStaff(data.staff)
      setMonthlyAppts(data.appointments)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, viewYear, viewMonth])

  async function refresh(targetDate?: string) {
    const d = targetDate ?? date
    startTransition(async () => {
      const data = await getBookingData(d)
      setStaff(data.staff)
      setAppointments(data.appointments)
      setStaffOff(data.staffOff)
    })
  }

  function shiftMonth(delta: number) {
    let y = viewYear
    let m = viewMonth + delta
    if (m > 12) { y += 1; m = 1 }
    if (m < 1) { y -= 1; m = 12 }
    setViewYear(y)
    setViewMonth(m)
  }

  function handleSetView(v: 'daily' | 'monthly') {
    if (v === 'monthly') {
      setViewYear(parseInt(date.slice(0, 4)))
      setViewMonth(parseInt(date.slice(5, 7)))
    }
    setView(v)
  }

  function refreshMonthly() {
    startTransition(async () => {
      const data = await getMonthlyData(viewYear, viewMonth)
      setStaff(data.staff)
      setMonthlyAppts(data.appointments)
    })
  }

  const isToday = date === todayKst()
  const todayStr = todayKst()
  const isThisMonth =
    view === 'monthly' &&
    viewYear === parseInt(todayStr.slice(0, 4)) &&
    viewMonth === parseInt(todayStr.slice(5, 7))

  return (
    <div className="flex flex-col gap-4">
      {/* ─── 날짜 네비게이션 ─── */}
      <div
        className="flex flex-wrap items-center gap-2"
        style={{
          padding: '12px 16px',
          background: '#FFFFFF',
          border: '1px solid #E8E5E0',
        }}
      >
        <div className="flex items-center gap-2">
          {/* 뷰 토글 (일간 / 월간) */}
          <div style={{ display: 'inline-flex', border: '1px solid #E8E5E0' }}>
            <button
              onClick={() => handleSetView('daily')}
              style={{
                fontSize: 12,
                letterSpacing: '0.05em',
                padding: '8px 12px',
                background: view === 'daily' ? '#1A1A1A' : '#FFFFFF',
                color: view === 'daily' ? '#FFFFFF' : '#1A1A1A',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              일간
            </button>
            <button
              onClick={() => handleSetView('monthly')}
              style={{
                fontSize: 12,
                letterSpacing: '0.05em',
                padding: '8px 12px',
                background: view === 'monthly' ? '#1A1A1A' : '#FFFFFF',
                color: view === 'monthly' ? '#FFFFFF' : '#1A1A1A',
                border: 'none',
                borderLeft: '1px solid #E8E5E0',
                cursor: 'pointer',
              }}
            >
              월간
            </button>
          </div>

          {/* 날짜/월 네비 */}
          <button
            onClick={() => view === 'daily' ? setDate(shiftDate(date, -1)) : shiftMonth(-1)}
            className="px-3 py-2"
            style={{
              fontSize: 14,
              color: '#1A1A1A',
              background: '#FFFFFF',
              border: '1px solid #E8E5E0',
              cursor: 'pointer',
            }}
            aria-label="이전"
          >
            ←
          </button>
          {view === 'daily' ? (
            <button
              onClick={() => setDate(todayKst())}
              className="px-3 py-2"
              style={{
                fontSize: 13,
                letterSpacing: '0.05em',
                color: isToday ? '#FFFFFF' : '#1A1A1A',
                background: isToday ? '#1A1A1A' : '#FFFFFF',
                border: '1px solid #1A1A1A',
                cursor: 'pointer',
              }}
            >
              오늘
            </button>
          ) : (
            <button
              onClick={() => {
                const t = todayKst()
                setViewYear(parseInt(t.slice(0, 4)))
                setViewMonth(parseInt(t.slice(5, 7)))
              }}
              className="px-3 py-2"
              style={{
                fontSize: 13,
                letterSpacing: '0.05em',
                color: isThisMonth ? '#FFFFFF' : '#1A1A1A',
                background: isThisMonth ? '#1A1A1A' : '#FFFFFF',
                border: '1px solid #1A1A1A',
                cursor: 'pointer',
              }}
            >
              이번 달
            </button>
          )}
          <button
            onClick={() => view === 'daily' ? setDate(shiftDate(date, 1)) : shiftMonth(1)}
            className="px-3 py-2"
            style={{
              fontSize: 14,
              color: '#1A1A1A',
              background: '#FFFFFF',
              border: '1px solid #E8E5E0',
              cursor: 'pointer',
            }}
            aria-label="다음"
          >
            →
          </button>
        </div>

        <div
          className="w-full text-center order-3 sm:order-2 sm:flex-1 sm:w-auto"
          style={{
            fontSize: 15,
            letterSpacing: '0.05em',
            fontWeight: 600,
            color: '#1A1A1A',
          }}
        >
          {view === 'daily' ? formatKoDate(date) : `${viewYear}년 ${viewMonth}월`}
          {isPending && (
            <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>
              불러오는 중…
            </span>
          )}
        </div>

        {/* 우측 — 직원 설정 링크 */}
        <Link
          href="/admin/booking/staff"
          className="order-2 ml-auto sm:order-3 sm:ml-0"
          style={{
            fontSize: 12,
            letterSpacing: '0.05em',
            color: '#666',
            textDecoration: 'none',
            padding: '8px 12px',
            border: '1px solid #E8E5E0',
            background: '#FFFFFF',
            whiteSpace: 'nowrap',
          }}
        >
          ⚙ 직원 설정
        </Link>
      </div>

      {/* ─── 일간 뷰 ─── */}
      {view === 'daily' && (
        <>
          <BookingInput
            date={date}
            staff={staff}
            appointments={appointments}
            onCreated={() => refresh()}
            onDateChange={(d) => setDate(d)}
            prefillText={prefillText}
            prefillSignal={prefillSignal}
          />
          <SlotFinder groomers={staff} onSelectSlot={handleSelectSlot} />
          <TimelineGrid
            date={date}
            staff={staff}
            appointments={appointments}
            staffOff={staffOff}
            onChanged={() => refresh()}
            onDateChange={(d) => setDate(d)}
          />
        </>
      )}

      {/* ─── 월간 뷰 ─── */}
      {view === 'monthly' && (
        <>
          <BookingInput
            date={todayStr}
            staff={staff}
            appointments={monthlyAppts}
            onCreated={() => refreshMonthly()}
            onDateChange={(d) => {
              setDate(d)
              const y = parseInt(d.slice(0, 4))
              const m = parseInt(d.slice(5, 7))
              if (y !== viewYear || m !== viewMonth) {
                setViewYear(y)
                setViewMonth(m)
                // useEffect [view, viewYear, viewMonth] 가 refreshMonthly 호출
              } else {
                refreshMonthly()
              }
            }}
            prefillText={prefillText}
            prefillSignal={prefillSignal}
          />
          <SlotFinder groomers={staff} onSelectSlot={handleSelectSlot} />
          <MonthlyView
            year={viewYear}
            month={viewMonth}
            staff={staff}
            appointments={monthlyAppts}
            onDateSelect={(d) => {
              setDate(d)
              setView('daily')
            }}
            onChanged={refreshMonthly}
            onDateChange={(d) => {
              setDate(d)
              setView('daily')
            }}
          />
        </>
      )}
    </div>
  )
}
