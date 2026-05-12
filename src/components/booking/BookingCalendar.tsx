'use client'

// =============================================================
// 예약 캘린더 — 날짜 네비 + 입력창 + 타임라인 그리드
// =============================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BookingInput from './BookingInput'
import SlotFinder from './SlotFinder'
import TimelineGrid from './TimelineGrid'
import MonthlyView from './MonthlyView'
import DailySidePanel from './DailySidePanel'
import {
  getBookingData,
  getMonthlyData,
  type Appointment,
  type Staff,
  type StaffOff,
} from '@/lib/booking/actions'

// ─── 캐시 헬퍼 ───

type DailyCacheEntry = {
  staff: Staff[]
  appointments: Appointment[]
  staffOff: StaffOff[]
}
type MonthlyCacheEntry = { staff: Staff[]; appointments: Appointment[] }

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function isoToKstDate(iso: string): string {
  const d = new Date(iso)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`
}

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
  // ── 사이드 패널(오버레이) 열림 여부 ──
  const [panelOpen, setPanelOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => parseInt(initialDate.slice(0, 4)))
  const [viewMonth, setViewMonth] = useState(() => parseInt(initialDate.slice(5, 7)))
  const [monthlyAppts, setMonthlyAppts] = useState<Appointment[]>([])

  // ── BookingInput 외부 prefill (SlotFinder에서 트리거) ──
  const [prefillText, setPrefillText] = useState('')
  const [prefillSignal, setPrefillSignal] = useState(0)

  // ── 월간 뷰 미용사 필터 ──
  const [filterGroomerId, setFilterGroomerId] = useState<string | null>(null)

  // ── 첫 로딩 스켈레톤 표시용 (캐시 미스 + 백그라운드 fetch 중) ──
  const [dailyLoading, setDailyLoading] = useState(false)
  const [monthlyLoading, setMonthlyLoading] = useState(false)

  // ── 클라이언트 캐시 (날짜/월 단위) ──
  const dailyCacheRef = useRef<Map<string, DailyCacheEntry>>(new Map())
  const monthlyCacheRef = useRef<Map<string, MonthlyCacheEntry>>(new Map())

  // ── race guard용 ref ──
  const dateRef = useRef(date)
  const viewRef = useRef(view)
  const viewYearRef = useRef(viewYear)
  const viewMonthRef = useRef(viewMonth)
  useEffect(() => { dateRef.current = date }, [date])
  useEffect(() => { viewRef.current = view }, [view])
  useEffect(() => { viewYearRef.current = viewYear }, [viewYear])
  useEffect(() => { viewMonthRef.current = viewMonth }, [viewMonth])

  // ── 초기 데이터를 캐시에 시드 ──
  useEffect(() => {
    dailyCacheRef.current.set(initialDate, {
      staff: initialStaff,
      appointments: initialAppointments,
      staffOff: initialStaffOff,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleGroomerFilter(groomerId: string) {
    setFilterGroomerId(groomerId)
    setView('monthly')
  }

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

  // 날짜 변경 시 데이터 재조회 (캐시 활용)
  useEffect(() => {
    if (date === initialDate) return
    refresh(date)
    router.replace(`/admin/booking?date=${date}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  // 월간 뷰 — 연/월 변경 시 데이터 재조회 (캐시 활용)
  useEffect(() => {
    if (view !== 'monthly') return
    refreshMonthly()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, viewYear, viewMonth])

  /**
   * 일간 데이터 — stale-while-revalidate.
   * - 캐시 히트: 즉시 화면 반영 + 백그라운드 fresh fetch
   * - 캐시 미스: 스켈레톤 표시 + fetch
   * - skipCache=true: 캐시 hydration 건너뛰고 fetch만 (낙관적 업데이트 후 검증용)
   */
  function refresh(
    targetDate?: string,
    opts: { skipCache?: boolean } = {},
  ) {
    const d = targetDate ?? date
    const cached = opts.skipCache ? undefined : dailyCacheRef.current.get(d)
    if (cached) {
      setStaff(cached.staff)
      setAppointments(cached.appointments)
      setStaffOff(cached.staffOff)
      setDailyLoading(false)
    } else if (!opts.skipCache) {
      // 캐시 미스 → 스켈레톤
      setDailyLoading(true)
    }
    startTransition(async () => {
      const data = await getBookingData(d)
      dailyCacheRef.current.set(d, data)
      if (dateRef.current === d) {
        setStaff(data.staff)
        setAppointments(data.appointments)
        setStaffOff(data.staffOff)
        setDailyLoading(false)
      }
    })
  }

  /** 월간 데이터 — stale-while-revalidate. */
  function refreshMonthly(opts: { skipCache?: boolean } = {}) {
    const key = monthKey(viewYear, viewMonth)
    const cached = opts.skipCache ? undefined : monthlyCacheRef.current.get(key)
    if (cached) {
      setStaff(cached.staff)
      setMonthlyAppts(cached.appointments)
      setMonthlyLoading(false)
    } else if (!opts.skipCache) {
      setMonthlyLoading(true)
    }
    startTransition(async () => {
      const data = await getMonthlyData(viewYear, viewMonth)
      monthlyCacheRef.current.set(key, data)
      if (
        viewRef.current === 'monthly' &&
        monthKey(viewYearRef.current, viewMonthRef.current) === key
      ) {
        setStaff(data.staff)
        setMonthlyAppts(data.appointments)
        setMonthlyLoading(false)
      }
    })
  }

  /**
   * createAppointment 직후 호출되는 낙관적 업데이트 핸들러.
   * 새 Appointment를 받으면 즉시 state/캐시에 반영.
   * (받지 못한 경우 fallback으로 백그라운드 검증 fetch)
   */
  function handleAppointmentCreated(newAppt?: Appointment) {
    if (!newAppt) {
      if (view === 'monthly') refreshMonthly({ skipCache: true })
      else refresh(undefined, { skipCache: true })
      return
    }
    const apptDate = isoToKstDate(newAppt.start_at)

    // 일간 캐시 업데이트
    const dCached = dailyCacheRef.current.get(apptDate)
    if (dCached) {
      dailyCacheRef.current.set(apptDate, {
        ...dCached,
        appointments: [...dCached.appointments, newAppt],
      })
    }
    // 현재 보고 있는 날짜와 일치하면 즉시 화면 반영
    if (apptDate === date) {
      setAppointments((prev) => [...prev, newAppt])
    }

    // 월간: 같은 month면 즉시 push (calendar grid 경계 케이스는 캐시 무효화로 처리)
    const apptYM = apptDate.slice(0, 7)
    const viewYM = monthKey(viewYear, viewMonth)
    if (view === 'monthly' && apptYM === viewYM) {
      setMonthlyAppts((prev) => [...prev, newAppt])
    }
    // 정확성 보장 — 월간 캐시 전부 무효화 (다음 월간 뷰 진입 시 fresh fetch)
    monthlyCacheRef.current.clear()
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

  const isToday = date === todayKst()
  const todayStr = todayKst()
  const isThisMonth =
    view === 'monthly' &&
    viewYear === parseInt(todayStr.slice(0, 4)) &&
    viewMonth === parseInt(todayStr.slice(5, 7))

  return (
    <>
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
            onCreated={handleAppointmentCreated}
            onDateChange={(d) => setDate(d)}
            prefillText={prefillText}
            prefillSignal={prefillSignal}
          />
          <SlotFinder groomers={staff} onSelectSlot={handleSelectSlot} />
          {dailyLoading ? (
            <TimelineSkeleton />
          ) : (
            <TimelineGrid
              date={date}
              staff={staff}
              appointments={appointments}
              staffOff={staffOff}
              onChanged={() => refresh(undefined, { skipCache: true })}
              onDateChange={(d) => setDate(d)}
              onGroomerNameClick={handleGroomerFilter}
            />
          )}
        </>
      )}

      {/* ─── 월간 뷰 ─── */}
      {view === 'monthly' && (
        <>
          <BookingInput
            date={todayStr}
            staff={staff}
            appointments={monthlyAppts}
            onCreated={handleAppointmentCreated}
            onDateChange={(d) => {
              setDate(d)
              const y = parseInt(d.slice(0, 4))
              const m = parseInt(d.slice(5, 7))
              if (y !== viewYear || m !== viewMonth) {
                setViewYear(y)
                setViewMonth(m)
                // useEffect [view, viewYear, viewMonth] 가 refreshMonthly 호출
              } else {
                refreshMonthly({ skipCache: true })
              }
            }}
            prefillText={prefillText}
            prefillSignal={prefillSignal}
          />
          <SlotFinder groomers={staff} onSelectSlot={handleSelectSlot} />

          {/* ─── 미용사 필터 ─── */}
          <div
            className="flex flex-wrap items-center gap-3"
            style={{
              padding: '10px 14px',
              background: '#FFFFFF',
              border: '1px solid #E8E5E0',
              borderRadius: 0,
            }}
          >
            <span
              style={{
                fontSize: 11,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#888',
                fontWeight: 600,
              }}
            >
              미용사 필터
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterGroomerId(null)}
                style={{
                  fontSize: 12,
                  letterSpacing: '0.05em',
                  padding: '6px 12px',
                  background:
                    filterGroomerId === null ? '#1A1A1A' : '#FFFFFF',
                  color: filterGroomerId === null ? '#FFFFFF' : '#1A1A1A',
                  border: '1px solid #E8E5E0',
                  borderRadius: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                전체
              </button>
              {staff.map((g) => {
                const active = filterGroomerId === g.id
                return (
                  <button
                    key={g.id}
                    onClick={() => setFilterGroomerId(g.id)}
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.05em',
                      padding: '6px 12px',
                      background: active ? '#C9A96E' : '#FFFFFF',
                      color: active ? '#FFFFFF' : '#1A1A1A',
                      border: `1px solid ${active ? '#C9A96E' : '#E8E5E0'}`,
                      borderRadius: 0,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {g.name}
                  </button>
                )
              })}
            </div>
          </div>

          {monthlyLoading ? (
            <MonthlySkeleton />
          ) : (
            <MonthlyView
              year={viewYear}
              month={viewMonth}
              staff={staff}
              appointments={monthlyAppts}
              filterGroomerId={filterGroomerId}
              onDateSelect={(d) => {
                setDate(d)
                setView('daily')
              }}
              onChanged={() => refreshMonthly({ skipCache: true })}
              onDateChange={(d) => {
                setDate(d)
                setView('daily')
              }}
            />
          )}
        </>
      )}
    </div>

    {/* ─── 사이드 패널 토글 버튼 — AdminLayout 헤더(52px) 아래에 배치하여 로그아웃 버튼과 겹치지 않게 ─── */}
    <button
      type="button"
      onClick={() => setPanelOpen((v) => !v)}
      aria-label="사이드 패널 열기/닫기"
      title="사이드 패널"
      style={{
        position: 'fixed',
        top: 64,
        right: 16,
        width: 40,
        height: 40,
        background: panelOpen ? '#1A1A1A' : '#FFFFFF',
        color: panelOpen ? '#FFFFFF' : '#1A1A1A',
        border: '1px solid #E8E5E0',
        borderRadius: 0,
        cursor: 'pointer',
        zIndex: 70,
        fontSize: 18,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'inherit',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      {panelOpen ? '×' : '📝'}
    </button>

    {/* ─── 백드롭 (열려있을 때만, 클릭 시 닫힘) ─── */}
    {panelOpen && (
      <div
        onClick={() => setPanelOpen(false)}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 60,
        }}
      />
    )}

    {/* ─── 드로어 패널 — transform으로 슬라이드 애니메이션 ─── */}
    <aside
      onClick={(e) => e.stopPropagation()}
      aria-hidden={!panelOpen}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 260,
        background: '#FAFAF8',
        borderLeft: '1px solid #E8E5E0',
        borderRadius: 0,
        zIndex: 65,
        transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.2s ease',
        overflowY: 'auto',
        // top padding 116 = 토글 버튼(top:64 + height:40) 아래 12px 여백
        padding: '116px 16px 16px',
        boxSizing: 'border-box',
      }}
    >
      <DailySidePanel
        date={date}
        staff={staff}
        appointments={view === 'daily' ? appointments : monthlyAppts}
        mode={view}
      />
    </aside>
    </>
  )
}


// ─── 스켈레톤 컴포넌트 ───

function TimelineSkeleton() {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E5E0',
        padding: 16,
      }}
    >
      <div className="flex gap-2 mb-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{ flex: 1, height: 32, background: '#F0EDE8' }}
          />
        ))}
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            height: 36,
            marginBottom: 6,
            background: '#F5F2EC',
          }}
        />
      ))}
    </div>
  )
}

function MonthlySkeleton() {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E5E0',
        padding: 12,
      }}
    >
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{ height: 96, background: '#F5F2EC' }}
          />
        ))}
      </div>
    </div>
  )
}
