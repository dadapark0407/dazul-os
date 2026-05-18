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
import SidePanelOverlay from './SidePanelOverlay'
import AuditHistoryModal from './AuditHistoryModal'
import { pickActor } from './ActorPicker'
import { getSessionActor } from '@/lib/booking/actor-client'
import {
  getBookingData,
  getMonthlyData,
  type Appointment,
  type Staff,
  type StaffOff,
} from '@/lib/booking/actions'
import { isClosedDow } from '@/lib/booking/constants'

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

// ─── 중앙 헤더용 공유 스타일 ───
const arrowBtnStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#1A1A1A',
  background: '#FFFFFF',
  border: '1px solid #E8E5E0',
  padding: '4px 10px',
  cursor: 'pointer',
  borderRadius: 0,
}
const dateTextBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '4px 8px',
  font: 'inherit',
  color: 'inherit',
  letterSpacing: 'inherit',
  cursor: 'pointer',
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

  // ── 월간 뷰 미용사 필터 ──
  const [filterGroomerId, setFilterGroomerId] = useState<string | null>(null)

  // ── 월간 헤더 연월 피커 ──
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(viewYear)
  const pickerRef = useRef<HTMLDivElement | null>(null)

  // ── 변경 이력 모달 ──
  const [auditOpen, setAuditOpen] = useState(false)

  // ── 현재 세션 처리자 (UI 표시용) ──
  const [actorLabel, setActorLabel] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return getSessionActor()?.staff_name ?? null
  })
  function refreshActorLabel() {
    setActorLabel(getSessionActor()?.staff_name ?? null)
  }

  // ── 일간 헤더 날짜 피커 ──
  const [dateOpen, setDateOpen] = useState(false)
  // 피커 안에서 보고 있는 month grid (선택과 별개로 이동 가능)
  const [dateYM, setDateYM] = useState<{ year: number; month: number }>(() => ({
    year: parseInt(initialDate.slice(0, 4)),
    month: parseInt(initialDate.slice(5, 7)),
  }))

  // 피커 열릴 때 현재 viewYear로 동기화
  useEffect(() => {
    if (pickerOpen) setPickerYear(viewYear)
  }, [pickerOpen, viewYear])

  // 날짜 피커 열릴 때 현재 date의 y/m로 동기화
  useEffect(() => {
    if (dateOpen) {
      setDateYM({
        year: parseInt(date.slice(0, 4)),
        month: parseInt(date.slice(5, 7)),
      })
    }
  }, [dateOpen, date])

  // 바깥 클릭 시 둘 다 닫기 (두 피커 모두 헤더 같은 컨테이너 안에 있어 ref 공유)
  useEffect(() => {
    if (!pickerOpen && !dateOpen) return
    const onDown = (e: MouseEvent) => {
      if (!pickerRef.current) return
      if (!pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
        setDateOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [pickerOpen, dateOpen])

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

  return (
    <>
    <div className="flex flex-col gap-4">
      {/* ─── 1행: 제목 + 일간/월간 탭 ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <h1
          style={{
            fontSize: 22,
            letterSpacing: '0.08em',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: 0,
          }}
        >
          예약 관리
        </h1>
        <div style={{ display: 'inline-flex', border: '1px solid #E8E5E0' }}>
          <button
            onClick={() => handleSetView('daily')}
            style={{
              fontSize: 12,
              letterSpacing: '0.05em',
              padding: '8px 14px',
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
              padding: '8px 14px',
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
      </div>

      {/* ─── 2행: [변경 이력 / 처리자]  ← 날짜 →  [직원 설정] ─── */}
      <div
        className="flex flex-wrap items-center gap-2"
        style={{
          padding: '12px 16px',
          background: '#FFFFFF',
          border: '1px solid #E8E5E0',
        }}
      >
        {/* 좌 */}
        <div className="flex items-center gap-2">
          {/* 변경 이력 */}
          <button
            onClick={() => setAuditOpen(true)}
            style={{
              fontSize: 12,
              letterSpacing: '0.05em',
              padding: '8px 12px',
              background: '#FFFFFF',
              color: '#1A1A1A',
              border: '1px solid #E8E5E0',
              cursor: 'pointer',
            }}
          >
            변경 이력
          </button>

          {/* 세션 처리자 */}
          <button
            onClick={async () => {
              await pickActor()
              refreshActorLabel()
            }}
            title="처리자 변경"
            style={{
              fontSize: 11,
              letterSpacing: '0.05em',
              padding: '8px 10px',
              background: '#FAFAF8',
              color: actorLabel ? '#1A1A1A' : '#8A8A7A',
              border: '1px solid #E8E5E0',
              cursor: 'pointer',
            }}
          >
            처리자: {actorLabel ?? '미지정'} ↻
          </button>
        </div>

        {/* 중앙 — 날짜 네비 */}
        <div
          ref={pickerRef}
          className="w-full text-center order-3 sm:order-2 sm:flex-1 sm:w-auto"
          style={{
            position: 'relative',
            fontSize: 15,
            letterSpacing: '0.05em',
            fontWeight: 600,
            color: '#1A1A1A',
          }}
        >
          {view === 'daily' ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => setDate(shiftDate(date, -1))}
                aria-label="이전 날"
                style={arrowBtnStyle}
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setDateOpen((v) => !v)}
                style={dateTextBtnStyle}
                aria-haspopup="dialog"
                aria-expanded={dateOpen}
              >
                {formatKoDate(date)}
              </button>
              <button
                type="button"
                onClick={() => setDate(shiftDate(date, 1))}
                aria-label="다음 날"
                style={arrowBtnStyle}
              >
                →
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="이전 달"
                style={arrowBtnStyle}
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                style={dateTextBtnStyle}
                aria-haspopup="dialog"
                aria-expanded={pickerOpen}
              >
                {viewYear}년 {viewMonth}월
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="다음 달"
                style={arrowBtnStyle}
              >
                →
              </button>
            </div>
          )}
          {isPending && (
            <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>
              불러오는 중…
            </span>
          )}

          {/* 연월 피커 오버레이 */}
          {view === 'monthly' && pickerOpen && (
            <MonthPicker
              pickerYear={pickerYear}
              currentYear={viewYear}
              currentMonth={viewMonth}
              onYearChange={setPickerYear}
              onSelect={(y, m) => {
                setViewYear(y)
                setViewMonth(m)
                setPickerOpen(false)
              }}
            />
          )}

          {/* 날짜 피커 오버레이 */}
          {view === 'daily' && dateOpen && (
            <DatePicker
              year={dateYM.year}
              month={dateYM.month}
              selectedDate={date}
              today={todayKst()}
              onMonthChange={(y, m) => setDateYM({ year: y, month: m })}
              onSelect={(d) => {
                setDate(d)
                setDateOpen(false)
              }}
            />
          )}
        </div>

        {/* 우 — 직원 설정 링크 */}
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
            date={todayKst()}
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

    {/* ─── 변경 이력 모달 ─── */}
    <AuditHistoryModal open={auditOpen} onClose={() => setAuditOpen(false)} />

    {/* ─── 사이드 패널 오버레이 (토글 + 드로어) ─── */}
    <SidePanelOverlay
      date={date}
      staff={staff}
      appointments={view === 'daily' ? appointments : monthlyAppts}
      mode={view}
    />
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


// =============================================================
// 연월 피커 오버레이
// =============================================================

function MonthPicker({
  pickerYear,
  currentYear,
  currentMonth,
  onYearChange,
  onSelect,
}: {
  pickerYear: number
  currentYear: number
  currentMonth: number
  onYearChange: (y: number) => void
  onSelect: (year: number, month: number) => void
}) {
  return (
    <div
      role="dialog"
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        background: '#FAFAF8',
        border: '1px solid #E8E5E0',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        padding: 16,
        minWidth: 240,
        textAlign: 'left',
      }}
    >
      {/* 연도 네비 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={() => onYearChange(pickerYear - 1)}
          aria-label="이전 연도"
          style={pickerArrowStyle}
        >
          ▲
        </button>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: '#1A1A1A',
          }}
        >
          {pickerYear}년
        </span>
        <button
          type="button"
          onClick={() => onYearChange(pickerYear + 1)}
          aria-label="다음 연도"
          style={pickerArrowStyle}
        >
          ▼
        </button>
      </div>

      {/* 월 그리드 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
        }}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const isCurrent = pickerYear === currentYear && m === currentMonth
          return (
            <button
              key={m}
              type="button"
              onClick={() => onSelect(pickerYear, m)}
              style={{
                fontSize: 13,
                letterSpacing: '0.04em',
                padding: '8px 0',
                background: isCurrent ? '#C9A96E' : '#FFFFFF',
                color: isCurrent ? '#FFFFFF' : '#1A1A1A',
                border: isCurrent
                  ? '1px solid #C9A96E'
                  : '1px solid #E8E5E0',
                cursor: 'pointer',
                fontWeight: isCurrent ? 600 : 400,
              }}
            >
              {m}월
            </button>
          )
        })}
      </div>
    </div>
  )
}

const pickerArrowStyle: React.CSSProperties = {
  fontSize: 11,
  width: 28,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#FFFFFF',
  color: '#1A1A1A',
  border: '1px solid #E8E5E0',
  cursor: 'pointer',
}


// =============================================================
// 일간 날짜 피커 오버레이
// =============================================================

// 월요일 시작 캘린더 헤더 (요일 → JS getDay 값)
const WEEKDAY_HEADERS: { label: string; dow: number }[] = [
  { label: '월', dow: 1 },
  { label: '화', dow: 2 },
  { label: '수', dow: 3 },
  { label: '목', dow: 4 },
  { label: '금', dow: 5 },
  { label: '토', dow: 6 },
  { label: '일', dow: 0 },
]

type DayCell =
  | { inMonth: true; date: string; day: number; dow: number }
  | { inMonth: false }

function buildMonthCells(year: number, month: number): DayCell[] {
  const firstDow = new Date(year, month - 1, 1).getDay()         // 0=일
  const leadingBlanks = (firstDow + 6) % 7                       // 월요일 시작 기준
  const lastDay = new Date(year, month, 0).getDate()             // 이번달 말일

  const cells: DayCell[] = []
  for (let i = 0; i < leadingBlanks; i++) cells.push({ inMonth: false })
  for (let d = 1; d <= lastDay; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = new Date(year, month - 1, d).getDay()
    cells.push({ inMonth: true, date, day: d, dow })
  }
  while (cells.length % 7 !== 0) cells.push({ inMonth: false })
  return cells
}

function DatePicker({
  year,
  month,
  selectedDate,
  today,
  onMonthChange,
  onSelect,
}: {
  year: number
  month: number
  selectedDate: string
  today: string
  onMonthChange: (year: number, month: number) => void
  onSelect: (date: string) => void
}) {
  const cells = buildMonthCells(year, month)

  function shift(delta: number) {
    let y = year
    let m = month + delta
    if (m > 12) { y += 1; m = 1 }
    if (m < 1) { y -= 1; m = 12 }
    onMonthChange(y, m)
  }

  return (
    <div
      role="dialog"
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        background: '#FAFAF8',
        border: '1px solid #E8E5E0',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        padding: 16,
        minWidth: 280,
        textAlign: 'left',
      }}
    >
      {/* 월 네비 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="이전 월"
          style={pickerArrowStyle}
        >
          ◀
        </button>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: '#1A1A1A',
          }}
        >
          {year}년 {month}월
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="다음 월"
          style={pickerArrowStyle}
        >
          ▶
        </button>
      </div>

      {/* 요일 헤더 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
          marginBottom: 6,
        }}
      >
        {WEEKDAY_HEADERS.map(({ label, dow }) => {
          const closed = isClosedDow(dow)
          return (
            <div
              key={label}
              style={{
                fontSize: 11,
                textAlign: 'center',
                color: closed ? '#BBB' : '#666',
                letterSpacing: '0.05em',
                padding: '4px 0',
              }}
            >
              {label}
            </div>
          )
        })}
      </div>

      {/* 날짜 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((c, i) => {
          if (!c.inMonth) return <div key={i} style={{ height: 32 }} />
          const closed = isClosedDow(c.dow)
          const isToday = c.date === today
          const isSelected = c.date === selectedDate
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(c.date)}
              style={{
                fontSize: 13,
                height: 32,
                background: isSelected ? '#C9A96E' : '#FFFFFF',
                color: isSelected
                  ? '#FFFFFF'
                  : closed
                  ? '#BBB'
                  : '#1A1A1A',
                // 오늘은 골드 보더로 강조 (선택 상태이면 선택 스타일이 우선)
                border:
                  isSelected || isToday
                    ? '1px solid #C9A96E'
                    : '1px solid #E8E5E0',
                fontWeight: isSelected || isToday ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {c.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
