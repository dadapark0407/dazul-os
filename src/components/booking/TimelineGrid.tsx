'use client'

// =============================================================
// 타임라인 그리드 — 가로: 미용사 + 미지정 / 세로: 30분 단위
// 드래그앤드롭은 mousedown/mousemove/mouseup 기반 (HTML5 Drag API 미사용)
// =============================================================

import { useState, useEffect, useMemo, useRef } from 'react'
import AppointmentBlock from './AppointmentBlock'
import type {
  Appointment,
  Staff,
  StaffOff,
} from '@/lib/booking/actions'
import { updateAppointment, createStaffOff } from '@/lib/booking/actions'
import { getSessionActor } from '@/lib/booking/actor-client'

type Props = {
  date: string
  staff: Staff[]
  appointments: Appointment[]
  staffOff: StaffOff[]
  onChanged: () => void
  onDateChange: (newDate: string) => void
  onGroomerNameClick?: (groomerId: string) => void
}

// ─── 타임라인 상수 ───
const START_HOUR = 11
const END_HOUR = 20          // 마지막 슬롯은 19:30 시작 → 20:00 끝
const SLOT_MIN = 30
const SLOT_HEIGHT = 36       // px — 30분 한 칸 높이
const COL_WIDTH = 140        // px — 미용사 한 칸 너비
const TIME_COL_WIDTH = 56    // px — 시간 라벨 열
const HEADER_HEIGHT = 56     // px — 미용사 이름 헤더 높이
const DRAG_THRESHOLD = 5     // px — 클릭 vs 드래그 구분

const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MIN  // 18

const UNASSIGNED_KEY = '__unassigned__'

/** ISO 문자열 → KST "HH:MM" */
function isoToKstHHMM(iso: string): string {
  const d = new Date(iso)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const h = kst.getUTCHours()
  const m = kst.getUTCMinutes()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "HH:MM" → 그리드 시작점부터의 분 */
function hhmmToOffsetMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h - START_HOUR) * 60 + m
}

/** 분 → px (1분 = SLOT_HEIGHT/30 px) */
function minToPx(min: number): number {
  return (min / SLOT_MIN) * SLOT_HEIGHT
}

/** ISO 문자열 → KST "YYYY-MM-DD" */
function isoToKstDate(iso: string): string {
  const d = new Date(iso)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (m === 0) return `${h}시간`
  if (m === 30) return `${h}시간 30분`
  return `${h}시간 ${m}분`
}

type LaneEntry =
  | { kind: 'appt'; id: string; appt: Appointment; offset: number; durationMin: number }
  | { kind: 'lunch'; id: string; off: StaffOff; offset: number; durationMin: number }

type Laned<T> = T & { lane: number; totalLanes: number }

/** 같은 열 내 겹치는 항목(예약 + 점심)에 레인(가로 분할) 배정 */
function computeLanes<T extends { offset: number; durationMin: number }>(
  items: T[],
): Laned<T>[] {
  if (items.length === 0) return []

  type WithEnd = T & { end: number; lane: number }
  const sorted: WithEnd[] = items
    .map((it) => ({ ...it, end: it.offset + it.durationMin, lane: 0 }))
    .sort((a, b) => a.offset - b.offset)

  // 탐욕적 레인 배정: 가장 먼저 끝난 레인에 배치
  const laneEnds: number[] = []
  for (const item of sorted) {
    let lane = laneEnds.findIndex((end) => end <= item.offset)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(0)
    }
    laneEnds[lane] = item.end
    item.lane = lane
  }

  // 각 항목의 totalLanes = 자신과 겹치는 모든 항목 중 최대 레인 인덱스 + 1
  return sorted.map((item) => ({
    ...item,
    totalLanes:
      sorted
        .filter((o) => o.offset < item.end && o.end > item.offset)
        .reduce((max, o) => Math.max(max, o.lane), 0) + 1,
  })) as Laned<T>[]
}

// ─── 드래그 상태 ───

type DragState = {
  appointmentId: string
  startMouseY: number
  startMouseX: number
  originalTop: number
  originalLeft: number
  groomerId: string | null
  // 추적용 (ghost 위치 / 슬롯 하이라이트용)
  currentX: number
  currentY: number
  committed: boolean      // 임계값 넘어서 진짜 드래그가 시작됐는지
  appt: Appointment       // ghost 렌더용 스냅샷
  color: string
  unassigned: boolean
}

// ─── 리사이즈 상태 ───

type ResizeState = {
  appointmentId: string
  originalEndMin: number    // 그리드 시작점 기준, 리사이즈 시작 시점의 종료 오프셋(분)
  startMouseY: number
}

export default function TimelineGrid({
  date,
  staff,
  appointments,
  staffOff,
  onChanged,
  onDateChange,
  onGroomerNameClick,
}: Props) {
  // 취소/노쇼 예약은 캘린더에서 완전히 숨김
  const activeAppointments = useMemo(
    () =>
      appointments.filter(
        (a) => a.status !== 'cancelled' && a.status !== 'noshow',
      ),
    [appointments],
  )
  const [localAppts, setLocalAppts] = useState<Appointment[]>(activeAppointments)
  // prop 변경 시 렌더 단계에서 즉시 동기화 — useEffect 방식의 1프레임 이전 데이터 렌더 제거
  const [prevActiveAppts, setPrevActiveAppts] = useState(activeAppointments)
  if (prevActiveAppts !== activeAppointments) {
    setPrevActiveAppts(activeAppointments)
    setLocalAppts(activeAppointments)
  }
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  // 시간 블락 추가 모달 대상 미용사 ID
  const [timeBlockTarget, setTimeBlockTarget] = useState<string | null>(null)

  // refs (document mouse 핸들러에서 최신값 참조용)
  const innerRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const localApptsRef = useRef<Appointment[]>(localAppts)
  const resizeStateRef = useRef<ResizeState | null>(null)

  useEffect(() => { dragStateRef.current = dragState }, [dragState])
  useEffect(() => { localApptsRef.current = localAppts }, [localAppts])
  useEffect(() => { resizeStateRef.current = resizeState }, [resizeState])

  // 시간 라벨
  const timeLabels: string[] = []
  for (let s = 0; s < TOTAL_SLOTS; s++) {
    const totalMin = s * SLOT_MIN
    const h = START_HOUR + Math.floor(totalMin / 60)
    const m = totalMin % 60
    timeLabels.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }

  // 열 정의: staff + 미지정
  const columns = [
    ...staff.map((s) => ({
      key: s.id,
      name: s.name,
      color: s.signature_color,
      isUnassigned: false,
    })),
    {
      key: UNASSIGNED_KEY,
      name: '미지정',
      color: '#888888',
      isUnassigned: true,
    },
  ]

  /** 화면 좌표 → 어떤 (열, 슬롯) 위에 있는지 */
  function getSlotAt(clientX: number, clientY: number): { colKey: string; slotIdx: number } | null {
    const inner = innerRef.current
    if (!inner) return null
    const rect = inner.getBoundingClientRect()
    const relX = clientX - rect.left - TIME_COL_WIDTH
    const relY = clientY - rect.top - HEADER_HEIGHT
    if (relX < 0 || relY < 0) return null
    const colIdx = Math.floor(relX / COL_WIDTH)
    const slotIdx = Math.floor(relY / SLOT_HEIGHT)
    if (colIdx < 0 || colIdx >= columns.length) return null
    if (slotIdx < 0 || slotIdx >= TOTAL_SLOTS) return null
    return { colKey: columns[colIdx].key, slotIdx }
  }

  // ─── 드래그 중 document-level 마우스 이벤트 ───
  // dragState가 null → non-null 로 바뀔 때 한 번만 등록한다.
  const isDragging = dragState !== null

  useEffect(() => {
    if (!isDragging) return

    function onMove(e: MouseEvent) {
      setDragState((cur) => {
        if (!cur) return cur
        const dx = Math.abs(e.clientX - cur.startMouseX)
        const dy = Math.abs(e.clientY - cur.startMouseY)
        const committed = cur.committed || dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD
        return {
          ...cur,
          currentX: e.clientX,
          currentY: e.clientY,
          committed,
        }
      })
    }

    async function onUp(e: MouseEvent) {
      const cur = dragStateRef.current
      // 드롭 후 dragState는 무조건 비운다 (ghost 사라짐)
      setDragState(null)
      // 실제 드래그(committed)였을 때만 위치 변경
      if (!cur || !cur.committed) return

      const slot = getSlotAt(e.clientX, e.clientY)
      if (!slot) return  // 그리드 바깥 → 원위치 유지

      // 30분 단위 스냅 (slotIdx는 이미 30분 단위 인덱스이지만 명시적으로 라운딩)
      const newStartMin = Math.round((slot.slotIdx * SLOT_MIN) / 30) * 30
      const staffId = slot.colKey === UNASSIGNED_KEY ? null : slot.colKey

      const target = cur.appt
      const kstDate = isoToKstDate(target.start_at)
      const h = START_HOUR + Math.floor(newStartMin / 60)
      const m = newStartMin % 60
      const newStartAt = new Date(
        `${kstDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+09:00`,
      ).toISOString()

      // 변경 없으면 서버 호출 생략
      if (newStartAt === target.start_at && staffId === target.staff_id) return

      const prev = localApptsRef.current
      setLocalAppts(prev.map((a) =>
        a.id === cur.appointmentId
          ? { ...a, start_at: newStartAt, staff_id: staffId }
          : a,
      ))

      const result = await updateAppointment(
        cur.appointmentId,
        { start_at: newStartAt, staff_id: staffId },
        getSessionActor(),
      )

      if (!result.ok) {
        setLocalAppts(prev)
      } else {
        onChanged()
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    // isDragging만 의존성으로 두어 드래그 시작/끝 시점에만 핸들러 등록/해제
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging])

  /** AppointmentBlock 의 mousedown → 드래그 후보 진입 */
  function handleApptMouseDown(e: React.MouseEvent, id: string) {
    const target = localApptsRef.current.find((a) => a.id === id)
    if (!target) return
    const colKey = target.staff_id ?? UNASSIGNED_KEY
    const col = columns.find((c) => c.key === colKey)
    const offset = hhmmToOffsetMin(isoToKstHHMM(target.start_at))
    setDragState({
      appointmentId: id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      originalTop: minToPx(offset),
      originalLeft: 0,
      groomerId: target.staff_id,
      currentX: e.clientX,
      currentY: e.clientY,
      committed: false,
      appt: target,
      color: col?.color ?? '#888888',
      unassigned: !!col?.isUnassigned,
    })
  }

  /** AppointmentBlock 하단 핸들 mousedown → 리사이즈 시작 */
  function handleApptResizeStart(e: React.MouseEvent, id: string) {
    const target = localApptsRef.current.find((a) => a.id === id)
    if (!target) return
    const offset = hhmmToOffsetMin(isoToKstHHMM(target.start_at))
    setResizeState({
      appointmentId: id,
      originalEndMin: offset + target.duration_min,
      startMouseY: e.clientY,
    })
  }

  // ─── 리사이즈 중 document-level 마우스 이벤트 ───
  const isResizing = resizeState !== null

  useEffect(() => {
    if (!isResizing) return

    function onMove(e: MouseEvent) {
      const cur = resizeStateRef.current
      if (!cur) return
      const deltaY = e.clientY - cur.startMouseY
      const deltaMin = (deltaY * SLOT_MIN) / SLOT_HEIGHT
      // 30분 단위 스냅된 새 종료 오프셋
      const snappedEndMin =
        Math.round((cur.originalEndMin + deltaMin) / SLOT_MIN) * SLOT_MIN

      setLocalAppts((prev) => {
        const appt = prev.find((a) => a.id === cur.appointmentId)
        if (!appt) return prev
        const startOffset = hhmmToOffsetMin(isoToKstHHMM(appt.start_at))
        // 최소 30분 보장
        const newDur = Math.max(SLOT_MIN, snappedEndMin - startOffset)
        if (newDur === appt.duration_min) return prev
        return prev.map((a) =>
          a.id === cur.appointmentId ? { ...a, duration_min: newDur } : a,
        )
      })
    }

    async function onUp() {
      const cur = resizeStateRef.current
      setResizeState(null)
      if (!cur) return

      const updated = localApptsRef.current.find((a) => a.id === cur.appointmentId)
      const original = appointments.find((a) => a.id === cur.appointmentId)
      if (!updated || !original) return
      // 변경 없으면 서버 호출 생략
      if (updated.duration_min === original.duration_min) return

      const result = await updateAppointment(
        cur.appointmentId,
        { duration_min: updated.duration_min },
        getSessionActor(),
      )

      if (!result.ok) {
        // 실패 시 원복
        setLocalAppts((prev) =>
          prev.map((a) =>
            a.id === cur.appointmentId
              ? { ...a, duration_min: original.duration_min }
              : a,
          ),
        )
      } else {
        onChanged()
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    // isResizing만 의존성으로 두어 시작/끝 시점에만 핸들러 등록/해제
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizing])

  // 열별 예약 분류
  const apptByCol = new Map<string, Appointment[]>()
  for (const col of columns) apptByCol.set(col.key, [])
  for (const a of localAppts) {
    const key = a.staff_id ?? UNASSIGNED_KEY
    if (apptByCol.has(key)) apptByCol.get(key)!.push(a)
  }

  // 열별 staff_off
  const offByStaff = new Map<string, StaffOff[]>()
  for (const off of staffOff) {
    const list = offByStaff.get(off.staff_id) ?? []
    list.push(off)
    offByStaff.set(off.staff_id, list)
  }

  // 드래그 중 마우스 아래의 슬롯 (committed 일 때만 하이라이트)
  const hoverSlot = dragState && dragState.committed
    ? getSlotAt(dragState.currentX, dragState.currentY)
    : null

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E5E0',
        overflowX: 'auto',
        // 드래그/리사이즈 중 텍스트 선택 방지
        userSelect: dragState || resizeState ? 'none' : 'auto',
        WebkitUserSelect: dragState || resizeState ? 'none' : 'auto',
      }}
    >
      <div ref={innerRef} style={{ display: 'inline-flex', minWidth: '100%' }}>
        {/* ─── 시간 열 ─── */}
        <div
          style={{
            width: TIME_COL_WIDTH,
            flexShrink: 0,
            borderRight: '1px solid #E8E5E0',
            background: '#FAFAF8',
            position: 'sticky',
            left: 0,
            zIndex: 2,
          }}
        >
          {/* 헤더 자리 */}
          <div
            style={{
              height: HEADER_HEIGHT,
              borderBottom: '1px solid #E8E5E0',
            }}
          />
          {/* 시간 라벨 */}
          {timeLabels.map((label) => (
            <div
              key={label}
              style={{
                height: SLOT_HEIGHT,
                borderBottom: '1px solid #F0EDE8',
                fontSize: 11,
                color: '#888',
                paddingLeft: 8,
                paddingTop: 2,
                letterSpacing: '0.03em',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* ─── 미용사 열들 + 미지정 열 ─── */}
        {columns.map((col) => {
          const offs = col.isUnassigned ? [] : offByStaff.get(col.key) ?? []
          const isFullDayOff = offs.some((o) => o.off_type === 'dayoff')
          const colAppts = apptByCol.get(col.key) ?? []

          return (
            <div
              key={col.key}
              style={{
                width: COL_WIDTH,
                flexShrink: 0,
                borderRight: '1px solid #E8E5E0',
                position: 'relative',
                background: col.isUnassigned ? '#FAFAF8' : '#FFFFFF',
              }}
            >
              {/* ── 헤더 ── */}
              <div
                style={{
                  height: HEADER_HEIGHT,
                  borderBottom: '1px solid #E8E5E0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  background: '#FFFFFF',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: col.color,
                      display: 'inline-block',
                    }}
                  />
                  {col.isUnassigned ? (
                    <span
                      style={{
                        fontSize: 13,
                        letterSpacing: '0.05em',
                        fontWeight: 600,
                        color: '#1A1A1A',
                      }}
                    >
                      {col.name}
                    </span>
                  ) : (
                    <span
                      onClick={() => onGroomerNameClick?.(col.key)}
                      className="cursor-pointer hover:text-[#C9A96E] transition-colors"
                      style={{
                        fontSize: 13,
                        letterSpacing: '0.05em',
                        fontWeight: 600,
                        color: '#1A1A1A',
                      }}
                    >
                      {col.name}
                    </span>
                  )}
                  {!col.isUnassigned && (
                    <button
                      type="button"
                      onClick={() => setTimeBlockTarget(col.key)}
                      title="시간 블락 추가"
                      className="cursor-pointer hover:text-[#C9A96E] transition-colors"
                      style={{
                        fontSize: 12,
                        lineHeight: 1,
                        color: '#BBB',
                        background: 'none',
                        border: 'none',
                        padding: '2px 4px',
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>

              {/* ── 슬롯 배경 ── */}
              <div style={{ position: 'relative' }}>
                {timeLabels.map((label, slotIdx) => {
                  const isOver =
                    hoverSlot !== null &&
                    hoverSlot.colKey === col.key &&
                    hoverSlot.slotIdx === slotIdx
                  return (
                    <div
                      key={label}
                      style={{
                        height: SLOT_HEIGHT,
                        borderBottom: '1px solid #F0EDE8',
                        background: isOver
                          ? 'rgba(201, 169, 110, 0.18)'
                          : col.isUnassigned
                            ? 'repeating-linear-gradient(45deg, #FAFAF8 0 6px, #F4F1EC 6px 12px)'
                            : '#FFFFFF',
                        boxShadow: isOver
                          ? 'inset 0 0 0 1px rgba(201, 169, 110, 0.5)'
                          : 'none',
                      }}
                    />
                  )
                })}

                {/* ── 휴무 (열 전체) ── */}
                {isFullDayOff && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(120,120,120,0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        letterSpacing: '0.1em',
                        fontWeight: 600,
                        color: '#666',
                      }}
                    >
                      휴 무
                    </span>
                  </div>
                )}

                {/* ── 점심 + 예약 (레인 통합) ── */}
                {(() => {
                  if (isFullDayOff) return null

                  const entries: LaneEntry[] = []

                  for (const o of offs) {
                    if (
                      (o.off_type !== 'lunch' &&
                        o.off_type !== 'half_off' &&
                        o.off_type !== 'time_block') ||
                      !o.start_time
                    )
                      continue
                    const startOffset = hhmmToOffsetMin(o.start_time)
                    if (startOffset < 0) continue
                    const dur = o.end_time
                      ? hhmmToOffsetMin(o.end_time) - startOffset
                      : 60 // 기본 점심 60분
                    entries.push({
                      kind: 'lunch',
                      id: o.id,
                      off: o,
                      offset: startOffset,
                      durationMin: dur,
                    })
                  }

                  for (const a of colAppts) {
                    const offset = hhmmToOffsetMin(isoToKstHHMM(a.start_at))
                    entries.push({
                      kind: 'appt',
                      id: a.id,
                      appt: a,
                      offset,
                      durationMin: a.duration_min,
                    })
                  }

                  return computeLanes(entries).map((item) => {
                    if (item.offset < 0 || item.offset >= TOTAL_SLOTS * SLOT_MIN) return null

                    const top = minToPx(item.offset)
                    const blockHeight = minToPx(item.durationMin)

                    if (item.kind === 'lunch') {
                      const offType = item.off.off_type
                      const isHalfOff = offType === 'half_off'
                      const isTimeBlock = offType === 'time_block'
                      // 라벨: 시간 블락은 사유 우선 (12자 잘라냄)
                      const rawReason = (item.off.reason ?? '').trim()
                      const label = isTimeBlock
                        ? rawReason
                          ? rawReason.length > 12
                            ? `${rawReason.slice(0, 12)}…`
                            : rawReason
                          : '블락'
                        : isHalfOff
                          ? '반차'
                          : '점심'
                      const bg = isTimeBlock
                        ? '#F0EDE8'
                        : isHalfOff
                          ? '#E8E5E0'
                          : '#C9A96E'
                      const fg = isTimeBlock || isHalfOff ? '#666666' : '#FFFFFF'
                      const laneStyle: React.CSSProperties =
                        item.totalLanes === 1
                          ? { left: 4, right: 4 }
                          : {
                              left: `calc(${(item.lane / item.totalLanes) * 100}% + 1px)`,
                              width: `calc(${(1 / item.totalLanes) * 100}% - 2px)`,
                            }
                      return (
                        <div
                          key={`lunch-${item.id}`}
                          title={isTimeBlock && rawReason ? rawReason : undefined}
                          style={{
                            position: 'absolute',
                            top,
                            ...laneStyle,
                            height: blockHeight,
                            background: bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            color: fg,
                            letterSpacing: '0.05em',
                            pointerEvents: 'none',
                            overflow: 'hidden',
                            padding: '0 4px',
                            textAlign: 'center',
                          }}
                        >
                          {label}
                        </div>
                      )
                    }

                    const a = item.appt
                    const hhmm = isoToKstHHMM(a.start_at)
                    const color =
                      columns.find((c) => c.key === (a.staff_id ?? UNASSIGNED_KEY))
                        ?.color ?? '#888888'

                    const isThisDragging =
                      dragState?.appointmentId === a.id && dragState.committed

                    return (
                      <AppointmentBlock
                        key={a.id}
                        appointment={a}
                        time={hhmm}
                        top={top}
                        height={blockHeight}
                        color={color}
                        unassigned={col.isUnassigned}
                        staff={staff}
                        onChanged={onChanged}
                        onDateChange={onDateChange}
                        lane={item.lane}
                        totalLanes={item.totalLanes}
                        isDragging={isThisDragging}
                        onMouseDown={handleApptMouseDown}
                        onResizeStart={handleApptResizeStart}
                      />
                    )
                  })
                })()}
              </div>
            </div>
          )
        })}
      </div>

      {/* ─── 드래그 ghost (마우스 따라다님) ─── */}
      {dragState && dragState.committed && (
        <div
          style={{
            position: 'fixed',
            left: dragState.currentX + 8,
            top: dragState.currentY + 8,
            width: COL_WIDTH - 12,
            minHeight: Math.max(minToPx(dragState.appt.duration_min) - 2, 44),
            padding: '4px 6px',
            fontSize: 11,
            lineHeight: 1.3,
            letterSpacing: '0.02em',
            pointerEvents: 'none',
            zIndex: 9999,
            opacity: 0.92,
            background: dragState.unassigned ? '#F0EDE8' : dragState.color,
            color: dragState.unassigned ? '#1A1A1A' : '#FFFFFF',
            border: dragState.unassigned ? '1px dashed #888888' : 'none',
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {isoToKstHHMM(dragState.appt.start_at)}
            {' · '}
            {[dragState.appt.pet_breed, dragState.appt.pet_name ?? '(이름 없음)']
              .filter(Boolean)
              .join(' ')}
          </div>
          <div style={{ opacity: dragState.unassigned ? 0.7 : 0.85 }}>
            {formatDuration(dragState.appt.duration_min)}
          </div>
          {dragState.appt.note && (
            <div
              style={{
                marginTop: 2,
                fontSize: 10,
                opacity: 0.75,
                whiteSpace: 'normal',
                wordBreak: 'break-word',
              }}
            >
              {dragState.appt.note}
            </div>
          )}
        </div>
      )}

      {/* ─── 시간 블락 추가 모달 ─── */}
      {timeBlockTarget && (
        <TimeBlockModal
          date={date}
          staffId={timeBlockTarget}
          staff={staff}
          onClose={() => setTimeBlockTarget(null)}
          onCreated={() => {
            setTimeBlockTarget(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

// ─── 시간 블락 추가 모달 ───

// 사유 프리셋 — 대상에 따라 다른 목록 표시
const REASON_PRESETS_ONE = ['오전 반차', '오후 반차', '외부 미팅', '교육', '개인 사정'] as const
const REASON_PRESETS_ALL = ['매장 청소', '전체 교육', '임시 휴점'] as const

const pad = (n: number) => String(n).padStart(2, '0')
const OPEN_TIME = `${pad(START_HOUR)}:00`   // 11:00
const CLOSE_TIME = `${pad(END_HOUR)}:00`    // 20:00
const HALF_SPLIT = '13:00'                  // 반차 기준 시각

/** 30분 단위 시간 옵션: 11:00 ~ 20:00 */
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = []
  for (let min = START_HOUR * 60; min <= END_HOUR * 60; min += SLOT_MIN) {
    const h = Math.floor(min / 60)
    const m = min % 60
    out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  return out
})()

function TimeBlockModal({
  date,
  staffId,
  staff,
  onClose,
  onCreated,
}: {
  date: string
  staffId: string
  staff: Staff[]
  onClose: () => void
  onCreated: () => void
}) {
  const [blockDate, setBlockDate] = useState(date)
  const [startTime, setStartTime] = useState('14:00')
  const [endTime, setEndTime] = useState('15:00')
  const [reason, setReason] = useState('')
  const [target, setTarget] = useState<'one' | 'all'>('one')
  const [selectedStaffId, setSelectedStaffId] = useState(staffId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 프리셋 선택 — 반차는 시간 자동 설정
  function pickPreset(p: string) {
    setReason(p)
    if (p === '오전 반차') {
      setStartTime(OPEN_TIME)
      setEndTime(HALF_SPLIT)
    } else if (p === '오후 반차') {
      setStartTime(HALF_SPLIT)
      setEndTime(CLOSE_TIME)
    }
  }

  async function handleSubmit() {
    if (saving) return
    if (startTime >= endTime) {
      setError('종료 시간이 시작 시간보다 늦어야 합니다')
      return
    }
    const targetIds =
      target === 'all' ? staff.map((s) => s.id) : [selectedStaffId]
    if (targetIds.length === 0) {
      setError('대상 미용사가 없습니다')
      return
    }
    setSaving(true)
    setError(null)
    const results = await Promise.all(
      targetIds.map((id) =>
        createStaffOff({
          staff_id: id,
          off_date: blockDate,
          off_type: 'time_block',
          start_time: startTime,
          end_time: endTime,
          reason: reason.trim() || null,
        }),
      ),
    )
    setSaving(false)
    const failed = results.filter((r) => !r.ok)
    if (failed.length > 0) {
      setError(
        failed.length === results.length
          ? ((failed[0] as { error?: string }).error ?? '등록에 실패했습니다')
          : `일부 등록 실패 (${failed.length}/${results.length})`,
      )
      return
    }
    onCreated()
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: '0.15em',
    color: '#8A8A7A',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
  }
  const fieldStyle: React.CSSProperties = {
    width: '100%',
    background: '#FAFAF8',
    border: '1px solid #E8E5E0',
    borderRadius: 0,
    padding: '8px 10px',
    fontSize: 14,
    color: '#1A1A1A',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E5E0',
          borderRadius: 0,
          width: '100%',
          maxWidth: 360,
          padding: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 13,
              letterSpacing: '0.15em',
              fontWeight: 600,
              color: '#1A1A1A',
              textTransform: 'uppercase',
            }}
          >
            시간 블락
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 16,
              color: '#8A8A7A',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>대상</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {([
              { v: 'one', label: '특정 미용사' },
              { v: 'all', label: '전체 미용사' },
            ] as const).map((t) => (
              <button
                key={t.v}
                type="button"
                onClick={() => {
                  setTarget(t.v)
                  setReason('')
                }}
                style={{
                  flex: 1,
                  border: `1px solid ${target === t.v ? '#C9A96E' : '#E8E5E0'}`,
                  background: target === t.v ? 'rgba(201,169,110,0.12)' : '#FFFFFF',
                  color: target === t.v ? '#C9A96E' : '#6B6B6B',
                  fontSize: 12,
                  padding: '6px 0',
                  borderRadius: 0,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {target === 'one' && (
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              style={fieldStyle}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>날짜</label>
          <input
            type="date"
            value={blockDate}
            onChange={(e) => setBlockDate(e.target.value)}
            style={fieldStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>시작</label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={fieldStyle}
            >
              {TIME_OPTIONS.slice(0, -1).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>종료</label>
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={fieldStyle}
            >
              {TIME_OPTIONS.slice(1).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>사유</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {(target === 'all' ? REASON_PRESETS_ALL : REASON_PRESETS_ONE).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => pickPreset(p)}
                style={{
                  border: `1px solid ${reason === p ? '#C9A96E' : '#E8E5E0'}`,
                  background: reason === p ? 'rgba(201,169,110,0.12)' : '#FFFFFF',
                  color: reason === p ? '#C9A96E' : '#6B6B6B',
                  fontSize: 12,
                  padding: '5px 10px',
                  borderRadius: 0,
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="직접 입력"
            style={fieldStyle}
          />
        </div>

        {error && (
          <p style={{ fontSize: 12, color: '#C0392B', marginBottom: 10 }}>{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          style={{
            width: '100%',
            background: '#C9A96E',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 0,
            padding: '10px 0',
            fontSize: 14,
            letterSpacing: '0.1em',
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? '등록 중…' : '등록'}
        </button>
      </div>
    </div>
  )
}
