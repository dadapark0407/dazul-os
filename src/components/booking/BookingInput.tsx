'use client'

// =============================================================
// 자연어 예약 입력창 — Enter로 파싱 → DB 저장 (여러 줄 지원)
// =============================================================

import { useState, useRef, useEffect } from 'react'
import {
  parseBookingLine,
  type ParsedAppointment,
} from '@/lib/booking/parser'
import {
  createAppointment,
  createStaffOff,
  findPetsByName,
  createPetWithGuardian,
  autoAssignGroomer,
  type PetMatch,
  type Staff,
  type Appointment,
} from '@/lib/booking/actions'

type Props = {
  date: string                // YYYY-MM-DD (KST)
  staff: Staff[]
  appointments?: Appointment[]
  /**
   * 예약 생성 후 호출.
   * - newAppt가 있으면 부모가 낙관적 업데이트(state/캐시에 push)에 사용
   * - 없으면 부모가 fallback으로 refetch
   */
  onCreated: (newAppt?: Appointment) => void
  onDateChange: (newDate: string) => void
  prefillText?: string        // 외부에서 입력창을 채우고 싶을 때
  prefillSignal?: number      // 변경될 때마다 prefillText 적용
}

type Pending = {
  line: string
  originalIdx: number
  appointment: ParsedAppointment
  staffId: string | null
  assignType: 'fixed' | 'random'
  matches: PetMatch[]
  targetDate: string
}

type NewPetForm = {
  petName: string
  breed: string | null
  guardianName: string
  guardianPhone: string
}

type QueueItem = { line: string; originalIdx: number }

type QueueState = {
  remaining: QueueItem[]
  failed: { line: string; originalIdx: number; msg: string }[]
  successCount: number
  totalLines: number
  successDates: string[]
}

/** "HH:MM" + "YYYY-MM-DD" → KST ISO 문자열 */
function kstToIso(date: string, hhmm: string): string {
  return new Date(`${date}T${hhmm}:00+09:00`).toISOString()
}

/**
 * 서버 createAppointment 응답(row)을 Appointment 타입으로 정규화.
 * row는 select() 결과로 컬럼 그대로 — pets/guardians 조인이 없으므로
 * pet_name·pet_breed 스냅샷만 사용 (현재 UI 표시 fallback과 일치).
 */
function rowToAppointment(
  row: any,
  fallback: { guardian_name?: string | null } = {},
): Appointment {
  return {
    id: row.id,
    start_at: row.start_at,
    duration_min: row.duration_min,
    status: row.status ?? 'confirmed',
    pet_id: row.pet_id ?? null,
    guardian_id: row.guardian_id ?? null,
    staff_id: row.staff_id ?? null,
    note: row.note ?? null,
    raw_input: row.raw_input ?? null,
    pet_name: row.pet_name ?? null,
    pet_breed: row.pet_breed ?? null,
    guardian_name: fallback.guardian_name ?? null,
    service: row.service ?? null,
    assign_type: row.assign_type ?? 'fixed',
  }
}

export default function BookingInput({
  date,
  staff,
  appointments,
  onCreated,
  onDateChange,
  prefillText,
  prefillSignal,
}: Props) {
  const [text, setText] = useState('')
  const [errorMessages, setErrorMessages] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [newPet, setNewPet] = useState<NewPetForm | null>(null)
  const [petCreating, setPetCreating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const queueRef = useRef<QueueState | null>(null)
  // 한 줄에서 파싱된 여러 예약(멀티 펫)을 순차 처리하기 위한 서브 큐
  const lineQueueRef = useRef<{
    line: string
    originalIdx: number
    appts: ParsedAppointment[]
  } | null>(null)
  const [conflictConfirm, setConflictConfirm] = useState<{
    message: string
    onConfirm: () => Promise<void>
    onCancel: () => void
  } | null>(null)

  const staffNames = staff.map((s) => s.name)

  function isoToKstHHMM(iso: string): string {
    const d = new Date(iso)
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    return `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`
  }

  async function checkConflictThen(
    staffId: string | null,
    startIso: string,
    durationMin: number,
    line: string,
    originalIdx: number,
    proceed: () => Promise<void>,
  ) {
    if (!staffId || !appointments?.length) {
      await proceed()
      return
    }
    const newStart = new Date(startIso).getTime()
    const newEnd = newStart + durationMin * 60000
    const conflict = appointments.find((a) => {
      if (a.staff_id !== staffId) return false
      const existStart = new Date(a.start_at).getTime()
      const existEnd = existStart + a.duration_min * 60000
      return newStart < existEnd && existStart < newEnd
    })
    if (!conflict) {
      await proceed()
      return
    }
    const staffName = staff.find((s) => s.id === staffId)?.name ?? '미용사'
    const conflictPetName = conflict.pet_name ?? '(이름 없음)'
    setConflictConfirm({
      message: `${staffName} ${isoToKstHHMM(conflict.start_at)}에 이미 '${conflictPetName}' 예약이 있습니다. 그래도 등록할까요?`,
      onConfirm: async () => {
        setConflictConfirm(null)
        await proceed()
      },
      onCancel: () => {
        const q = queueRef.current
        if (q) q.failed.push({ line, originalIdx, msg: '중복 시간으로 취소됨' })
        setConflictConfirm(null)
        processNext()
      },
    })
  }

  function findStaffId(name: string | null): string | null {
    if (!name) return null
    return staff.find((s) => s.name === name)?.id ?? null
  }

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  // 외부 prefill — signal 바뀔 때마다 텍스트 채워 넣고 포커스
  useEffect(() => {
    if (prefillSignal === undefined || prefillSignal === 0) return
    setText(prefillText ?? '')
    setErrorMessages([])
    setTimeout(() => {
      autoResize()
      const el = textareaRef.current
      if (el) {
        el.focus()
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillSignal])

  // ─── 큐 완료 ───
  function finishQueue() {
    const q = queueRef.current
    queueRef.current = null
    setBusy(false)
    if (!q) return

    const sortedFailed = [...q.failed].sort((a, b) => a.originalIdx - b.originalIdx)

    // 실패한 줄만 입력창에 남기기
    setText(sortedFailed.map((f) => f.line).join('\n'))
    setTimeout(autoResize, 0)

    setErrorMessages(
      sortedFailed.map((f) => {
        const prefix = q.totalLines > 1 ? `${f.originalIdx + 1}번째 줄: ` : ''
        return `${prefix}${f.msg}`
      }),
    )

    if (q.successCount > 0) {
      const uniqueDates = [...new Set(q.successDates)]
      // 다른 날짜로 생성된 단일 줄이면 그 날짜로 이동
      // 그 외 케이스는 createAppointment마다 이미 낙관적 업데이트로 반영됐으므로 별도 refetch 불필요
      if (uniqueDates.length === 1 && uniqueDates[0] !== date) {
        onDateChange(uniqueDates[0])
      }
    }
  }

  // ─── 다음 처리 단위 진행 ───
  // 우선순위: 현재 줄의 남은 멀티-예약 → 큐의 다음 줄
  async function processNext() {
    const lq = lineQueueRef.current
    if (lq && lq.appts.length > 0) {
      const [next, ...restAppts] = lq.appts
      lineQueueRef.current = { ...lq, appts: restAppts }
      await processAppointment(next, lq.line, lq.originalIdx)
      return
    }
    lineQueueRef.current = null
    const q = queueRef.current
    if (!q || q.remaining.length === 0) {
      finishQueue()
      return
    }
    const [current, ...rest] = q.remaining
    queueRef.current = { ...q, remaining: rest }
    await processLine(current.line, current.originalIdx)
  }

  // ─── 한 줄 파싱 후 멀티-예약 서브 큐로 분배 ───
  async function processLine(line: string, originalIdx: number) {
    const q = queueRef.current
    if (!q) return

    let result
    try {
      result = parseBookingLine(line, staffNames)
    } catch (err) {
      q.failed.push({ line, originalIdx, msg: err instanceof Error ? err.message : '파싱 오류' })
      await processNext()
      return
    }

    // ─── 에러 ───
    if (result.type === 'error') {
      q.failed.push({ line, originalIdx, msg: result.message })
      await processNext()
      return
    }

    // ─── 점심 / 휴무 ───
    if (result.type === 'staff_off') {
      const staffId = findStaffId(result.data.staffName)
      if (!staffId) {
        q.failed.push({ line, originalIdx, msg: '미용사 정보를 찾을 수 없습니다' })
        await processNext()
        return
      }
      const r = await createStaffOff({
        staff_id: staffId,
        off_date: date,
        off_type: result.data.offType,
        start_time: result.data.startTime,
        end_time: null,
      })
      if (!r.ok) {
        q.failed.push({ line, originalIdx, msg: r.error })
      } else {
        q.successCount++
        q.successDates.push(date)
      }
      await processNext()
      return
    }

    // ─── 예약 (멀티 가능) ───
    // 파서가 배열로 반환 — 길이 1은 단일 펫, 2+는 멀티 펫
    lineQueueRef.current = { line, originalIdx, appts: result.data }
    await processNext()
  }

  // ─── 한 예약 처리 ───
  async function processAppointment(
    appt: ParsedAppointment,
    line: string,
    originalIdx: number,
  ) {
    const q = queueRef.current
    if (!q) return

    const targetDate = appt.date ?? date
    let staffId = findStaffId(appt.staffName)
    let assignType: 'fixed' | 'random' = 'fixed'

    // 미용사 미지정/지정없음 → 자동 배정 시도
    console.log('[BookingInput] parsed', {
      time: appt.time,
      petName: appt.petName,
      service: appt.service,
      staffName: appt.staffName,
      unassigned: appt.unassigned,
      resolvedStaffId: staffId,
    })
    if (staffId === null) {
      console.log('[BookingInput] calling autoAssignGroomer', {
        targetDate, time: appt.time, duration: appt.duration, service: appt.service,
      })
      try {
        const autoId = await autoAssignGroomer(
          targetDate,
          appt.time,
          appt.duration,
          appt.service ?? null,
        )
        console.log('[BookingInput] autoAssignGroomer returned', autoId)
        if (autoId) {
          staffId = autoId
          assignType = 'random'
        }
      } catch (err) {
        console.log('[BookingInput] autoAssignGroomer threw', err)
      }
    } else {
      console.log('[BookingInput] staffId already set, skipping autoAssign')
    }

    // 신규 고객 — DB 매칭 스킵
    if (appt.isNewCustomer) {
      const startIso = kstToIso(targetDate, appt.time)
      await checkConflictThen(staffId, startIso, appt.duration, line, originalIdx, async () => {
        const r = await createAppointment({
          start_at: startIso,
          duration_min: appt.duration,
          pet_id: null,
          guardian_id: null,
          staff_id: staffId,
          note: appt.note,
          raw_input: appt.raw,
          pet_name: appt.petName,
          pet_breed: appt.breed,
          service: appt.service,
          assign_type: assignType,
        })
        const q2 = queueRef.current
        if (q2) {
          if (!r.ok) q2.failed.push({ line, originalIdx, msg: r.error })
          else {
            q2.successCount++
            q2.successDates.push(targetDate)
            // 낙관적 업데이트 — 부모에 새 Appointment 즉시 전달
            if (r.data) onCreated(rowToAppointment(r.data))
          }
        }
        await processNext()
      })
      return
    }

    // 기존 고객 매칭
    let matches: PetMatch[]
    try {
      matches = await findPetsByName(appt.petName, appt.breed)
    } catch (err) {
      q.failed.push({ line, originalIdx, msg: err instanceof Error ? err.message : '조회 오류' })
      await processNext()
      return
    }

    if (matches.length === 1) {
      const m = matches[0]
      const startIso = kstToIso(targetDate, appt.time)
      await checkConflictThen(staffId, startIso, appt.duration, line, originalIdx, async () => {
        await saveWithPet(line, originalIdx, targetDate, appt, staffId, assignType, {
          id: m.id,
          guardian_id: m.guardian_id,
          name: m.name,
          breed: m.breed,
        })
      })
      return
    }

    // 0건 or 2건+ → 팝업으로 일시 중단
    setPending({ line, originalIdx, appointment: appt, staffId, assignType, matches, targetDate })
    if (matches.length === 0) {
      setNewPet({
        petName: appt.petName,
        breed: appt.breed,
        guardianName: '',
        guardianPhone: '',
      })
    }
  }

  // ─── 예약 저장 ───
  async function saveWithPet(
    line: string,
    originalIdx: number,
    targetDate: string,
    appt: ParsedAppointment,
    staffId: string | null,
    assignType: 'fixed' | 'random',
    pet: {
      id: string
      guardian_id: string | null
      name: string
      breed: string | null
      guardian_name?: string | null   // 표시용 fallback
    },
  ) {
    const r = await createAppointment({
      start_at: kstToIso(targetDate, appt.time),
      duration_min: appt.duration,
      pet_id: pet.id,
      guardian_id: pet.guardian_id,
      staff_id: staffId,
      note: appt.note,
      raw_input: appt.raw,
      pet_name: pet.name,
      pet_breed: pet.breed,
      service: appt.service,
      assign_type: assignType,
    })
    const q = queueRef.current
    if (q) {
      if (!r.ok) {
        q.failed.push({ line, originalIdx, msg: r.error })
      } else {
        q.successCount++
        q.successDates.push(targetDate)
        // 낙관적 업데이트
        if (r.data) {
          onCreated(rowToAppointment(r.data, { guardian_name: pet.guardian_name ?? null }))
        }
      }
    }
    setPending(null)
    setNewPet(null)
    if (queueRef.current) {
      await processNext()
    }
  }

  // ─── 팝업: 매칭 선택 ───
  async function handleSelectMatch(match: PetMatch) {
    if (!pending) return
    const p = pending
    setSaving(true)
    try {
      const startIso = kstToIso(p.targetDate, p.appointment.time)
      await checkConflictThen(p.staffId, startIso, p.appointment.duration, p.line, p.originalIdx, async () => {
        await saveWithPet(p.line, p.originalIdx, p.targetDate, p.appointment, p.staffId, p.assignType, {
          id: match.id,
          guardian_id: match.guardian_id,
          name: match.name,
          breed: match.breed,
          guardian_name: match.guardian_name,
        })
      })
    } finally {
      setSaving(false)
    }
  }

  // ─── 팝업: 신규 등록 ───
  async function handleCreateNewPet() {
    if (!pending || !newPet || petCreating) return
    if (!newPet.guardianName.trim() || !newPet.guardianPhone.trim()) {
      setErrorMessages(['보호자 이름·연락처를 모두 입력해 주세요'])
      return
    }
    setPetCreating(true)
    try {
      const r = await createPetWithGuardian({
        petName: newPet.petName,
        breed: newPet.breed,
        guardianName: newPet.guardianName.trim(),
        guardianPhone: newPet.guardianPhone.trim(),
      })
      if (!r.ok) {
        setErrorMessages([r.error])
        return
      }
      const p = pending
      const np = newPet
      const startIso = kstToIso(p.targetDate, p.appointment.time)
      await checkConflictThen(p.staffId, startIso, p.appointment.duration, p.line, p.originalIdx, async () => {
        await saveWithPet(p.line, p.originalIdx, p.targetDate, p.appointment, p.staffId, p.assignType, {
          id: r.petId,
          guardian_id: r.guardianId,
          name: np.petName,
          breed: np.breed,
          guardian_name: np.guardianName.trim() || null,
        })
      })
    } finally {
      setPetCreating(false)
    }
  }

  // ─── 팝업 취소 ───
  function handleCancel() {
    const q = queueRef.current
    const currentPending = pending
    const currentLineQueue = lineQueueRef.current
    queueRef.current = null
    lineQueueRef.current = null
    setBusy(false)
    setSaving(false)
    setPetCreating(false)
    setPending(null)
    setNewPet(null)

    if (!q) return

    // 취소한 줄 + 처리 못 한 멀티-예약이 남아있던 줄 + 큐의 다음 줄들 → 입력창으로 복원
    // (한 줄에서 멀티 예약 중간에 취소되면 그 줄 전체를 복원)
    const lineRestore =
      currentPending
        ? [{ idx: currentPending.originalIdx, line: currentPending.line }]
        : currentLineQueue && currentLineQueue.appts.length > 0
          ? [{ idx: currentLineQueue.originalIdx, line: currentLineQueue.line }]
          : []
    const unprocessed = [
      ...lineRestore,
      ...q.remaining.map((r) => ({ idx: r.originalIdx, line: r.line })),
    ]
    const sortedFailed = [...q.failed].sort((a, b) => a.originalIdx - b.originalIdx)

    const combined = [
      ...sortedFailed.map((f) => ({ idx: f.originalIdx, line: f.line })),
      ...unprocessed,
    ].sort((a, b) => a.idx - b.idx)

    setText(combined.map((c) => c.line).join('\n'))
    setTimeout(autoResize, 0)

    setErrorMessages(
      sortedFailed.map((f) => {
        const prefix = q.totalLines > 1 ? `${f.originalIdx + 1}번째 줄: ` : ''
        return `${prefix}${f.msg}`
      }),
    )

    if (q.successCount > 0) {
      const uniqueDates = [...new Set(q.successDates)]
      if (uniqueDates.length === 1 && uniqueDates[0] !== date) {
        onDateChange(uniqueDates[0])
      }
      // else: 낙관적 업데이트로 이미 반영됨
    }
  }

  // ─── 제출 ───
  async function handleSubmit() {
    if (!text.trim() || busy) return
    setErrorMessages([])
    setBusy(true)

    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      setBusy(false)
      return
    }

    queueRef.current = {
      remaining: lines.map((line, idx) => ({ line, originalIdx: idx })),
      failed: [],
      successCount: 0,
      totalLines: lines.length,
      successDates: [],
    }

    await processNext()
  }

  return (
    <div
      style={{
        padding: 16,
        background: '#FFFFFF',
        border: '1px solid #E8E5E0',
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          ref={textareaRef}
          value={text}
          rows={1}
          onChange={(e) => {
            setText(e.target.value)
            autoResize()
          }}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="예: 10시 코코 비숑 2시간 미용사A (Shift+Enter로 여러 건)"
          disabled={busy}
          className="flex-1"
          style={{
            fontSize: 15,
            padding: '12px 14px',
            background: '#FFFFFF',
            color: '#1A1A1A',
            border: '1px solid #E8E5E0',
            outline: 'none',
            resize: 'none',
            overflow: 'hidden',
            lineHeight: 1.5,
            minHeight: 44,
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={busy || !text.trim()}
          style={{
            fontSize: 14,
            letterSpacing: '0.05em',
            padding: '12px 24px',
            background: busy ? '#888' : '#1A1A1A',
            color: '#FFFFFF',
            border: 'none',
            cursor: busy ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {busy ? '처리 중…' : '입력'}
        </button>
      </div>

      {errorMessages.length > 0 && (
        <div className="flex flex-col gap-1" style={{ marginTop: 10 }}>
          {errorMessages.map((msg, i) => (
            <div key={i} style={{ fontSize: 13, color: '#B23A3A' }}>
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* ─── 다중 매칭 선택 모달 ─── */}
      {pending && pending.matches.length >= 2 && (
        <ModalShell title="고객 선택" onClose={handleCancel}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            같은 이름의 반려견이 여러 건 있습니다. 선택해 주세요.
          </div>
          <div className="flex flex-col gap-2">
            {pending.matches.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSelectMatch(m)}
                disabled={saving}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  background: '#FFFFFF',
                  border: '1px solid #E8E5E0',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                  {m.name} {m.breed && `· ${m.breed}`}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  보호자: {m.guardian_name ?? '-'}{' '}
                  {m.guardian_phone && `· ${m.guardian_phone}`}
                </div>
              </button>
            ))}
          </div>
        </ModalShell>
      )}

      {/* ─── 신규 등록 모달 ─── */}
      {pending && pending.matches.length === 0 && newPet && (
        <ModalShell title="신규 고객 등록" onClose={handleCancel}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            등록된 정보가 없습니다. 아래 정보를 입력해 주세요.
          </div>
          <div className="flex flex-col gap-3">
            <Field label="반려견 이름">
              <input
                value={newPet.petName}
                onChange={(e) =>
                  setNewPet({ ...newPet, petName: e.target.value })
                }
                style={inputStyle}
              />
            </Field>
            <Field label="품종">
              <input
                value={newPet.breed ?? ''}
                onChange={(e) =>
                  setNewPet({ ...newPet, breed: e.target.value || null })
                }
                style={inputStyle}
              />
            </Field>
            <Field label="보호자 이름 *">
              <input
                value={newPet.guardianName}
                onChange={(e) =>
                  setNewPet({ ...newPet, guardianName: e.target.value })
                }
                style={inputStyle}
              />
            </Field>
            <Field label="연락처 *">
              <input
                value={newPet.guardianPhone}
                onChange={(e) =>
                  setNewPet({ ...newPet, guardianPhone: e.target.value })
                }
                placeholder="010-0000-0000"
                style={inputStyle}
              />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={handleCancel} style={btnSecondary}>
              취소
            </button>
            <button
              onClick={handleCreateNewPet}
              disabled={petCreating}
              style={btnPrimary}
            >
              {petCreating ? '등록 중…' : '등록 후 예약'}
            </button>
          </div>
        </ModalShell>
      )}

      {/* ─── 중복 시간 확인 모달 ─── */}
      {/* 매칭/신규 모달 위에 표시되도록 가장 마지막에 렌더 (같은 z-index에서 DOM 순서로 스택) */}
      {conflictConfirm && (
        <ModalShell title="시간 중복 확인" onClose={conflictConfirm.onCancel}>
          <div style={{ fontSize: 14, color: '#1A1A1A', marginBottom: 20, lineHeight: 1.6 }}>
            {conflictConfirm.message}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={conflictConfirm.onCancel} style={btnSecondary}>
              취소
            </button>
            <button onClick={conflictConfirm.onConfirm} style={btnPrimary}>
              등록
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  )
}


// ─── 공용 UI ───

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
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
        className="w-full sm:max-w-[420px] overflow-y-auto"
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
            marginBottom: 12,
          }}
        >
          {title}
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span style={{ fontSize: 12, color: '#666' }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  fontSize: 14,
  padding: '10px 12px',
  background: '#FFFFFF',
  color: '#1A1A1A',
  border: '1px solid #E8E5E0',
  outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  fontSize: 13,
  letterSpacing: '0.05em',
  padding: '10px 18px',
  background: '#1A1A1A',
  color: '#FFFFFF',
  border: 'none',
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  fontSize: 13,
  letterSpacing: '0.05em',
  padding: '10px 18px',
  background: '#FFFFFF',
  color: '#1A1A1A',
  border: '1px solid #E8E5E0',
  cursor: 'pointer',
}
