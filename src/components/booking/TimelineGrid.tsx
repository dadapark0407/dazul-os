'use client'

// =============================================================
// 타임라인 그리드 — 가로: 미용사 + 미지정 / 세로: 30분 단위
// 드래그앤드롭은 mousedown/mousemove/mouseup 기반 (HTML5 Drag API 미사용)
// =============================================================

import { useState, useEffect, useRef } from 'react'
import AppointmentBlock from './AppointmentBlock'
import type {
  Appointment,
  Staff,
  StaffOff,
} from '@/lib/booking/actions'
import { updateAppointment } from '@/lib/booking/actions'

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

type LanedAppt = {
  appt: Appointment
  offset: number
  lane: number
  totalLanes: number
}

/** 같은 열 내 겹치는 예약에 레인(가로 분할) 배정 */
function computeLanes(appts: Appointment[]): LanedAppt[] {
  if (appts.length === 0) return []

  type Item = { appt: Appointment; offset: number; end: number; lane: number }

  const items: Item[] = appts
    .map((a) => {
      const offset = hhmmToOffsetMin(isoToKstHHMM(a.start_at))
      return { appt: a, offset, end: offset + a.duration_min, lane: 0 }
    })
    .sort((a, b) => a.offset - b.offset)

  // 탐욕적 레인 배정: 가장 먼저 끝난 레인에 배치
  const laneEnds: number[] = []
  for (const item of items) {
    let lane = laneEnds.findIndex((end) => end <= item.offset)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(0)
    }
    laneEnds[lane] = item.end
    item.lane = lane
  }

  // 각 예약의 totalLanes = 자신과 겹치는 모든 예약 중 최대 레인 인덱스 + 1
  return items.map((item) => ({
    appt: item.appt,
    offset: item.offset,
    lane: item.lane,
    totalLanes:
      items
        .filter((o) => o.offset < item.end && o.end > item.offset)
        .reduce((max, o) => Math.max(max, o.lane), 0) + 1,
  }))
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

export default function TimelineGrid({
  date,
  staff,
  appointments,
  staffOff,
  onChanged,
  onDateChange,
  onGroomerNameClick,
}: Props) {
  const [localAppts, setLocalAppts] = useState<Appointment[]>(appointments)
  const [dragState, setDragState] = useState<DragState | null>(null)

  // refs (document mouse 핸들러에서 최신값 참조용)
  const innerRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const localApptsRef = useRef<Appointment[]>(localAppts)

  useEffect(() => { dragStateRef.current = dragState }, [dragState])
  useEffect(() => { localApptsRef.current = localAppts }, [localAppts])
  useEffect(() => { setLocalAppts(appointments) }, [appointments])

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

      const result = await updateAppointment(cur.appointmentId, {
        start_at: newStartAt,
        staff_id: staffId,
      })

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
        // 드래그 중 텍스트 선택 방지
        userSelect: dragState ? 'none' : 'auto',
        WebkitUserSelect: dragState ? 'none' : 'auto',
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

                {/* ── 점심 블록 ── */}
                {!isFullDayOff &&
                  offs
                    .filter((o) => o.off_type === 'lunch' && o.start_time)
                    .map((o) => {
                      const startOffset = hhmmToOffsetMin(o.start_time!)
                      const dur = o.end_time
                        ? hhmmToOffsetMin(o.end_time) - startOffset
                        : 60   // 기본 점심 60분
                      if (startOffset < 0) return null
                      return (
                        <div
                          key={o.id}
                          style={{
                            position: 'absolute',
                            top: minToPx(startOffset),
                            left: 4,
                            right: 4,
                            height: minToPx(dur),
                            background: 'rgba(120,120,120,0.15)',
                            border: '1px dashed #B8B5B0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            color: '#666',
                            letterSpacing: '0.05em',
                            pointerEvents: 'none',
                          }}
                        >
                          점심
                        </div>
                      )
                    })}

                {/* ── 예약 블록 ── */}
                {computeLanes(colAppts).map(({ appt: a, offset, lane, totalLanes }) => {
                  if (offset < 0 || offset >= TOTAL_SLOTS * SLOT_MIN) return null

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
                      top={minToPx(offset)}
                      height={minToPx(a.duration_min)}
                      color={color}
                      unassigned={col.isUnassigned}
                      staff={staff}
                      onChanged={onChanged}
                      onDateChange={onDateChange}
                      lane={lane}
                      totalLanes={totalLanes}
                      isDragging={isThisDragging}
                      onMouseDown={handleApptMouseDown}
                    />
                  )
                })}
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
    </div>
  )
}
