'use client'

// =============================================================
// 예약 블록 — 클릭 시 상세/수정/삭제 모달
// =============================================================

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  deleteAppointment,
  updateAppointment,
  cancelAppointment,
  searchPetsByQuery,
  type Appointment,
  type Staff,
  type PetMatch,
  type CancelReason,
} from '@/lib/booking/actions'
import { pickActor, getOrPickActor } from './ActorPicker'

const CANCEL_REASONS: CancelReason[] = ['보호자 취소', '노쇼', '매장 사정']

function isCancelled(status: string | undefined): boolean {
  return status === 'cancelled' || status === 'noshow'
}

type Props = {
  appointment: Appointment
  time: string             // "HH:MM" KST
  top: number              // px
  height: number           // px
  color: string            // staff signature color
  unassigned: boolean
  staff: Staff[]
  onChanged: () => void
  onDateChange: (newDate: string) => void
  lane?: number            // 0-indexed within overlap group
  totalLanes?: number      // total lanes in overlap group
  isDragging?: boolean
  /** mousedown 시 부모(TimelineGrid)에게 드래그 시작을 알림 */
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>, appointmentId: string) => void
  /** 하단 핸들 mousedown 시 부모(TimelineGrid)에게 리사이즈 시작을 알림 */
  onResizeStart?: (e: React.MouseEvent<HTMLDivElement>, appointmentId: string) => void
}

export default function AppointmentBlock({
  appointment,
  time,
  top,
  height,
  color,
  unassigned,
  staff,
  onChanged,
  onDateChange,
  lane = 0,
  totalLanes = 1,
  isDragging = false,
  onMouseDown,
  onResizeStart,
}: Props) {
  const [open, setOpen] = useState(false)
  // mousedown 시점 좌표 — 클릭(움직임 거의 없음) vs 드래그(>5px 움직임) 구분용
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null)
  // 리사이즈 중인지. 리사이즈 직후의 click 이벤트(부모 블록에서 fire됨)를 차단하기 위함.
  const isResizingRef = useRef(false)

  const breedLabel = appointment.pet_breed
  // 형식: "{품종} {이름} {서비스}" — 빠진 항목은 자동 생략
  const petLabel = [
    breedLabel,
    appointment.pet_name ?? '(이름 없음)',
    appointment.service ?? null,
  ]
    .filter(Boolean)
    .join(' ')
  const durLabel = formatDuration(appointment.duration_min)
  const isRandom = appointment.assign_type === 'random'
  const cancelled = isCancelled(appointment.status)
  const isNoshow = appointment.status === 'noshow'

  const blockStyle: React.CSSProperties = unassigned
    ? {
        background: '#F0EDE8',
        border: '1px dashed #888888',
        color: '#1A1A1A',
      }
    : isRandom
    ? {
        background: color,
        border: `2px dashed ${color}`,
        color: '#FFFFFF',
      }
    : {
        background: color,
        border: 'none',
        color: '#FFFFFF',
      }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onMouseDown={(e) => {
          // 좌클릭만 처리
          if (e.button !== 0) return
          e.preventDefault()
          // 취소된 예약은 드래그 금지 — 클릭 추적도 생략 (클릭→모달 흐름은 유지)
          if (cancelled) return
          mouseDownPosRef.current = { x: e.clientX, y: e.clientY }
          onMouseDown?.(e, appointment.id)
        }}
        onClick={(e) => {
          // 리사이즈 직후 부모 블록에서 발생한 click은 무시 (수정 모달 차단)
          if (isResizingRef.current) {
            e.preventDefault()
            return
          }
          // 드래그였다면 모달 열지 않음 (5px 임계값)
          const start = mouseDownPosRef.current
          if (start) {
            const dx = Math.abs(e.clientX - start.x)
            const dy = Math.abs(e.clientY - start.y)
            mouseDownPosRef.current = null
            if (dx > 5 || dy > 5) return
          }
          setOpen(true)
        }}
        className={cancelled ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
        style={{
          position: 'absolute',
          top,
          ...(totalLanes === 1
            ? { left: 2, right: 2 }
            : {
                left: `calc(${(lane / totalLanes) * 100}% + 1px)`,
                width: `calc(${(1 / totalLanes) * 100}% - 2px)`,
              }),
          minHeight: Math.max(height - 2, 44),
          padding: '4px 6px',
          textAlign: 'left',
          fontSize: 11,
          lineHeight: 1.3,
          letterSpacing: '0.02em',
          whiteSpace: 'normal',
          // 취소된 예약은 흐리게 + 취소선
          opacity: cancelled ? 0.4 : isDragging ? 0.3 : 1,
          textDecoration: cancelled ? 'line-through' : 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          ...blockStyle,
        }}
        aria-label={`${time} ${petLabel} 예약`}
      >
        <div style={{ fontWeight: 600 }}>
          {time} · {petLabel}
        </div>
        <div
          style={{
            opacity: unassigned ? 0.7 : 0.85,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <span>{durLabel}</span>
          {isRandom && (
            <span
              style={{
                fontSize: 10,
                color: '#B23A3A',
                background: '#FFFFFF',
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '1px 4px',
                lineHeight: 1.2,
                opacity: 1,
              }}
            >
              자동
            </span>
          )}
          {cancelled && (
            <span
              style={{
                fontSize: 10,
                color: '#FFFFFF',
                background: '#B23A3A',
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '1px 4px',
                lineHeight: 1.2,
                opacity: 1,
                textDecoration: 'none',
              }}
            >
              {isNoshow ? '노쇼' : '취소'}
            </span>
          )}
        </div>
        {appointment.note && (
          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              opacity: 0.9,
              color: '#FFFFFF',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
            }}
          >
            📝 {appointment.note}
          </div>
        )}

        {/* 리사이즈 핸들 — 하단 8px, ns-resize. 시그니처 컬러보다 약간 어둡게. */}
        {/* 취소된 예약은 리사이즈 금지. */}
        {onResizeStart && !cancelled && (
          <div
            onMouseDown={(e) => {
              if (e.button !== 0) return
              e.preventDefault()
              e.stopPropagation()      // 부모의 드래그 mousedown 차단
              mouseDownPosRef.current = null
              isResizingRef.current = true
              // 리사이즈 종료 직후 부모 블록에서 click 이벤트가 fire될 수 있음.
              // mouseup 이후 click 처리까지 isResizing=true를 유지하다가 다음 틱에 해제.
              const handleUp = () => {
                document.removeEventListener('mouseup', handleUp)
                setTimeout(() => { isResizingRef.current = false }, 0)
              }
              document.addEventListener('mouseup', handleUp)
              onResizeStart(e, appointment.id)
            }}
            onClick={(e) => e.stopPropagation()}
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 8,
              cursor: 'ns-resize',
              background: 'rgba(0,0,0,0.2)',
            }}
          />
        )}
      </div>

      {open && (
        <DetailModal
          appointment={appointment}
          staff={staff}
          onClose={() => setOpen(false)}
          onChanged={onChanged}
          onDateChange={onDateChange}
        />
      )}
    </>
  )
}


// 소요시간 프리셋 (분 단위) — 30분 ~ 5시간, 30분 간격
const DURATION_PRESETS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300] as const

// 시간 프리셋 (11:00 ~ 20:00, 30분 간격)
const TIME_PRESETS = [
  '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00',
] as const


// ─── ISO ↔ KST 변환 헬퍼 ───

function isoToKstParts(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const y = k.getUTCFullYear()
  const mo = String(k.getUTCMonth() + 1).padStart(2, '0')
  const da = String(k.getUTCDate()).padStart(2, '0')
  const hh = String(k.getUTCHours()).padStart(2, '0')
  const mm = String(k.getUTCMinutes()).padStart(2, '0')
  return { date: `${y}-${mo}-${da}`, time: `${hh}:${mm}` }
}

function kstPartsToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+09:00`).toISOString()
}


// ─── 상세 / 수정 / 삭제 모달 ───

export function DetailModal({
  appointment,
  staff,
  onClose,
  onChanged,
  onDateChange,
}: {
  appointment: Appointment
  staff: Staff[]
  onClose: () => void
  onChanged: () => void
  onDateChange: (newDate: string) => void
}) {
  const original = isoToKstParts(appointment.start_at)
  const [date, setDate] = useState(original.date)
  const [time, setTime] = useState(original.time)
  const [duration, setDuration] = useState(appointment.duration_min)
  const [staffId, setStaffId] = useState<string | null>(appointment.staff_id)
  const [note, setNote] = useState(appointment.note ?? '')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // 'pick' = 취소 사유 선택 단계
  const [cancelStep, setCancelStep] = useState<null | 'pick'>(null)
  const [error, setError] = useState<string | null>(null)

  const cancelled = isCancelled(appointment.status)
  const isNoshow = appointment.status === 'noshow'

  // 고객 연결 상태
  const [petId, setPetId] = useState<string | null>(appointment.pet_id)
  const [petName, setPetName] = useState<string | null>(appointment.pet_name ?? null)
  const [petBreed, setPetBreed] = useState<string | null>(appointment.pet_breed ?? null)
  const [guardianId, setGuardianId] = useState<string | null>(appointment.guardian_id)
  const [guardianName, setGuardianName] = useState<string | null>(appointment.guardian_name ?? null)
  const [guardianPhone, setGuardianPhone] = useState<string | null>(appointment.guardian_phone ?? null)
  const [phoneCopied, setPhoneCopied] = useState(false)

  // 인라인 검색
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PetMatch[]>([])
  const [searchBusy, setSearchBusy] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!searchQuery.trim()) { setSearchResults([]); return }
    searchTimerRef.current = setTimeout(async () => {
      setSearchBusy(true)
      try { setSearchResults(await searchPetsByQuery(searchQuery)) }
      finally { setSearchBusy(false) }
    }, 300)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchQuery])

  function connectPet(m: PetMatch) {
    setPetId(m.id)
    setPetName(m.name)
    setPetBreed(m.breed)
    setGuardianId(m.guardian_id)
    setGuardianName(m.guardian_name)
    setGuardianPhone(m.guardian_phone)
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
  }

  async function copyPhone() {
    if (!guardianPhone) return
    try {
      await navigator.clipboard.writeText(guardianPhone)
      setPhoneCopied(true)
      setTimeout(() => setPhoneCopied(false), 1500)
    } catch {
      // 권한 없으면 무시
    }
  }

  async function handleSave() {
    // 수정은 보조 작업 — 세션 처리자 사용 (없으면 1회 모달)
    const actor = await getOrPickActor()
    setBusy(true)
    setError(null)
    try {
      const r = await updateAppointment(
        appointment.id,
        {
          start_at: kstPartsToIso(date, time),
          duration_min: duration,
          staff_id: staffId,
          note: note.trim() || null,
          pet_id: petId,
          guardian_id: guardianId,
          pet_name: petName,
          pet_breed: petBreed,
        },
        actor,
      )
      if (!r.ok) {
        setError(r.error)
        return
      }
      onClose()
      // 날짜가 바뀌었으면 캘린더도 이동, 아니면 단순 새로고침
      if (date !== original.date) onDateChange(date)
      else onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel(reason: CancelReason) {
    // 취소는 주요 작업 — 매번 처리자 선택
    const actor = await pickActor()
    if (!actor) return
    setBusy(true)
    setError(null)
    try {
      const r = await cancelAppointment(appointment.id, reason, actor)
      if (!r.ok) {
        setError(r.error)
        return
      }
      onChanged()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    // 삭제는 주요 작업 — 매번 처리자 선택
    const actor = await pickActor()
    if (!actor) return
    setBusy(true)
    setError(null)
    try {
      const r = await deleteAppointment(appointment.id, actor)
      if (!r.ok) {
        setError(r.error)
        return
      }
      onChanged()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  // ─── 취소된 예약 → 읽기 전용 + 삭제만 가능 ───
  if (cancelled) {
    const cancelledStaff = staff.find((s) => s.id === appointment.staff_id)?.name
    const cancelledLabel = isNoshow ? '노쇼' : '취소'
    return (
      <div
        onClick={onClose}
        className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4"
        style={{ background: 'rgba(0,0,0,0.4)', zIndex: 50 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-[460px] overflow-y-auto"
          style={{
            maxHeight: '90vh',
            background: '#FFFFFF',
            padding: 20,
            border: '1px solid #E8E5E0',
          }}
        >
          <div
            style={{
              fontSize: 16,
              letterSpacing: '0.06em',
              fontWeight: 600,
              color: '#1A1A1A',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            예약 상세
            <span
              style={{
                fontSize: 11,
                color: '#FFFFFF',
                background: '#B23A3A',
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '2px 6px',
                lineHeight: 1.2,
              }}
            >
              {cancelledLabel}
            </span>
          </div>

          <div className="flex flex-col gap-2" style={{ fontSize: 13, color: '#1A1A1A' }}>
            <Row label="날짜" value={original.date} />
            <Row label="시간" value={original.time} />
            <Row label="소요시간" value={formatDuration(appointment.duration_min)} />
            <Row
              label="반려견"
              value={
                appointment.pet_name
                  ? `${appointment.pet_name}${appointment.pet_breed ? ` · ${appointment.pet_breed}` : ''}`
                  : '미연결'
              }
            />
            {appointment.guardian_name && (
              <Row label="보호자" value={appointment.guardian_name} />
            )}
            <Row label="담당" value={cancelledStaff ?? '미지정'} />
            {appointment.cancel_reason && (
              <Row label="취소 사유" value={appointment.cancel_reason} />
            )}
            {appointment.note && <Row label="메모" value={appointment.note} />}
          </div>

          {error && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#B23A3A' }}>{error}</div>
          )}

          <div className="mt-5 flex justify-between gap-2">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                style={btnDanger}
              >
                삭제
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleDelete} disabled={busy} style={btnDanger}>
                  {busy ? '삭제 중…' : '정말 삭제'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                  style={btnSecondary}
                >
                  취소
                </button>
              </div>
            )}
            <button onClick={onClose} disabled={busy} style={btnSecondary}>
              닫기
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4"
      style={{
        background: 'rgba(0,0,0,0.4)',
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[460px] overflow-y-auto"
        style={{
          maxHeight: '90vh',
          background: '#FFFFFF',
          padding: 20,
          border: '1px solid #E8E5E0',
        }}
      >
        <div
          style={{
            fontSize: 16,
            letterSpacing: '0.06em',
            fontWeight: 600,
            color: '#1A1A1A',
            marginBottom: 16,
          }}
        >
          예약 상세
        </div>

        {/* 보호자 정보 */}
        {(guardianName || guardianPhone) && (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              background: '#FAFAF8',
              border: '1px solid #E8E5E0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {guardianName && (
                <span style={{ fontSize: 11, color: '#8A8A7A', letterSpacing: '0.04em' }}>
                  {guardianName}
                </span>
              )}
              {guardianPhone ? (
                <a
                  href={`tel:${guardianPhone.replace(/[^0-9+]/g, '')}`}
                  style={{
                    fontSize: 14,
                    color: '#C9A96E',
                    textDecoration: 'underline',
                    letterSpacing: '0.02em',
                  }}
                >
                  {guardianPhone}
                </a>
              ) : (
                <span style={{ fontSize: 12, color: '#8A8A7A' }}>전화번호 없음</span>
              )}
            </div>
            {guardianPhone && (
              <button
                type="button"
                onClick={copyPhone}
                style={{
                  fontSize: 11,
                  letterSpacing: '0.05em',
                  padding: '6px 10px',
                  background: '#FFFFFF',
                  border: '1px solid #E8E5E0',
                  color: phoneCopied ? '#7A9E8A' : '#1A1A1A',
                  cursor: 'pointer',
                  borderRadius: 0,
                }}
              >
                {phoneCopied ? '✓ 복사됨' : '복사'}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4" style={{ fontSize: 13, color: '#1A1A1A' }}>
          {/* 1. 날짜 */}
          <label className="flex flex-col gap-1">
            <span style={{ fontSize: 12, color: '#666' }}>날짜</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </label>

          {/* 2. 시간 */}
          <div className="flex flex-col gap-2">
            <span style={{ fontSize: 12, color: '#666' }}>시간</span>
            <div className="flex flex-wrap gap-1">
              {TIME_PRESETS.map((t) => {
                const selected = time === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTime(t)}
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.02em',
                      padding: '8px 10px',
                      background: selected ? '#1A1A1A' : '#FFFFFF',
                      color: selected ? '#FFFFFF' : '#1A1A1A',
                      border: selected
                        ? '1px solid #1A1A1A'
                        : '1px solid #E8E5E0',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. 담당 미용사 */}
          <div className="flex flex-col gap-2">
            <span style={{ fontSize: 12, color: '#666' }}>담당 미용사</span>
            <div className="flex flex-wrap gap-1">
              {staff.map((s) => {
                const selected = staffId === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStaffId(s.id)}
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.02em',
                      padding: '8px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: selected ? '#1A1A1A' : '#FFFFFF',
                      color: selected ? '#FFFFFF' : '#1A1A1A',
                      border: selected
                        ? '1px solid #1A1A1A'
                        : '1px solid #E8E5E0',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: s.signature_color,
                        display: 'inline-block',
                        border: selected ? '1px solid #FFFFFF' : 'none',
                      }}
                    />
                    {s.name}
                  </button>
                )
              })}
              {/* 미지정 */}
              {(() => {
                const selected = staffId === null
                return (
                  <button
                    type="button"
                    onClick={() => setStaffId(null)}
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.02em',
                      padding: '8px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: selected ? '#1A1A1A' : '#FFFFFF',
                      color: selected ? '#FFFFFF' : '#666',
                      border: selected
                        ? '1px solid #1A1A1A'
                        : '1px dashed #888888',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#888888',
                        display: 'inline-block',
                      }}
                    />
                    미지정
                  </button>
                )
              })()}
            </div>
          </div>

          {/* 4. 소요시간 */}
          <div className="flex flex-col gap-2">
            <span style={{ fontSize: 12, color: '#666' }}>소요시간</span>
            <div className="flex flex-wrap gap-1">
              {DURATION_PRESETS.map((min) => {
                const selected = duration === min
                return (
                  <button
                    key={min}
                    type="button"
                    onClick={() => setDuration(min)}
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.02em',
                      padding: '8px 12px',
                      background: selected ? '#1A1A1A' : '#FFFFFF',
                      color: selected ? '#FFFFFF' : '#1A1A1A',
                      border: selected
                        ? '1px solid #1A1A1A'
                        : '1px solid #E8E5E0',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDuration(min)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 5. 반려견 · 보호자 + 고객 연결 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: '#666' }}>반려견 · 보호자</span>
              {petId ? (
                <button
                  type="button"
                  onClick={() => setShowSearch((v) => !v)}
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    padding: '4px 10px',
                    background: '#FFFFFF',
                    color: '#666',
                    border: '1px solid #E8E5E0',
                    cursor: 'pointer',
                  }}
                >
                  고객 변경
                </button>
              ) : (
                <Link
                  href="/admin/guardians/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    padding: '4px 10px',
                    background: '#FFFFFF',
                    color: '#C9A96E',
                    border: '1px solid #C9A96E',
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  고객 등록
                </Link>
              )}
            </div>

            {/* 현재 연결된 고객 표시 */}
            {petName ? (
              <div>
                <div style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>
                  {petName}{petBreed ? ` · ${petBreed}` : ''}
                </div>
                {guardianName && (
                  <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                    보호자: {guardianName}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#AAA' }}>미연결</div>
            )}

            {/* 인라인 검색 */}
            {showSearch && (
              <div style={{ border: '1px solid #E8E5E0', padding: 10 }}>
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="반려견 이름으로 검색"
                  style={{
                    width: '100%',
                    fontSize: 13,
                    padding: '8px 10px',
                    border: '1px solid #E8E5E0',
                    outline: 'none',
                    background: '#FFFFFF',
                    color: '#1A1A1A',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />

                {searchBusy && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>검색 중…</div>
                )}

                {!searchBusy && searchQuery.trim() && searchResults.length === 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                      검색 결과 없음
                    </div>
                    <Link
                      href="/admin/clients/new"
                      style={{
                        fontSize: 12,
                        color: '#C9A96E',
                        textDecoration: 'none',
                        borderBottom: '1px solid #C9A96E',
                      }}
                    >
                      고객 등록 페이지에서 등록하기 →
                    </Link>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {searchResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => connectPet(m)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 10px',
                          background: '#FFFFFF',
                          border: 'none',
                          borderTop: '1px solid #E8E5E0',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                          {m.name}{m.breed ? ` · ${m.breed}` : ''}
                        </span>
                        {m.guardian_name && (
                          <span style={{ fontSize: 12, color: '#666', marginLeft: 6 }}>
                            · 보호자 {m.guardian_name}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 7. 메모 */}
          <label className="flex flex-col gap-1">
            <span style={{ fontSize: 12, color: '#666' }}>메모</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>
        </div>

        {error && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#B23A3A' }}>{error}</div>
        )}

        {/* 하단 버튼 */}
        {cancelStep === 'pick' ? (
          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {CANCEL_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => handleCancel(reason)}
                  disabled={busy}
                  style={btnDanger}
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCancelStep(null)}
              disabled={busy}
              style={btnSecondary}
            >
              돌아가기
            </button>
          </div>
        ) : (
          <div className="mt-5 flex justify-between gap-2">
            {!confirmDelete ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                  style={btnDanger}
                >
                  삭제
                </button>
                <button
                  onClick={() => setCancelStep('pick')}
                  disabled={busy}
                  style={btnDanger}
                >
                  예약 취소
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleDelete} disabled={busy} style={btnDanger}>
                  {busy ? '삭제 중…' : '정말 삭제'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                  style={btnSecondary}
                >
                  취소
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={onClose} disabled={busy} style={btnSecondary}>
                닫기
              </button>
              <button onClick={handleSave} disabled={busy} style={btnPrimary}>
                {busy ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ─── 헬퍼 ───

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span style={{ width: 80, fontSize: 12, color: '#666' }}>{label}</span>
      <span style={{ flex: 1, fontSize: 13, color: '#1A1A1A' }}>{value}</span>
    </div>
  )
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (m === 0) return `${h}시간`
  if (m === 30) return `${h}시간 30분`
  return `${h}시간 ${m}분`
}

const inputStyle: React.CSSProperties = {
  fontSize: 14,
  padding: '8px 10px',
  background: '#FFFFFF',
  color: '#1A1A1A',
  border: '1px solid #E8E5E0',
  outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  fontSize: 13,
  letterSpacing: '0.05em',
  padding: '9px 16px',
  background: '#1A1A1A',
  color: '#FFFFFF',
  border: 'none',
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  fontSize: 13,
  letterSpacing: '0.05em',
  padding: '9px 16px',
  background: '#FFFFFF',
  color: '#1A1A1A',
  border: '1px solid #E8E5E0',
  cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  fontSize: 13,
  letterSpacing: '0.05em',
  padding: '9px 16px',
  background: '#FFFFFF',
  color: '#B23A3A',
  border: '1px solid #B23A3A',
  cursor: 'pointer',
}
