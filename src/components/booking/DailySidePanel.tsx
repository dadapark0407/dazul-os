'use client'

// =============================================================
// DAZUL OS — 일간 예약 화면 우측 사이드 패널
//   1) 오늘의 메모 (날짜별 localStorage 저장, debounce 1초)
//   2) 고정(정기) 예약 목록
// =============================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  listRecurringAppointments,
  createRecurringAppointment,
  deleteRecurringAppointment,
  type Staff,
  type Appointment,
  type RecurringAppointment,
} from '@/lib/booking/actions'

type Props = {
  /** 현재 표시중인 날짜 YYYY-MM-DD (KST). 메모 키로 사용. */
  date: string
  staff: Staff[]
  /** 오늘 예약 목록 — REPORT 섹션에서 사용. */
  appointments?: Appointment[]
  /**
   * 'daily': 메모 + REPORT + 고정 예약 모두 표시
   * 'monthly': 고정 예약만 표시 (메모/REPORT 숨김)
   */
  mode?: 'daily' | 'monthly'
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 한국 성씨 1자 가정 — "강수진" → "수진" */
function givenName(full: string | null | undefined): string | null {
  if (!full) return null
  return full.length >= 2 ? full.slice(1) : full
}

const memoKey = (date: string) => `dazul-daily-memo-${date}`
const reportKey = (date: string) => `dazul-daily-report-${date}`

// ─── 공용 스타일 ───
const sectionStyle: React.CSSProperties = {
  background: '#FAFAF8',
  border: '1px solid #E8E5E0',
  borderRadius: 0,
  padding: 12,
}

const headerStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  fontWeight: 600,
  color: '#1A1A1A',
  marginBottom: 8,
}

const inputStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '6px 8px',
  background: '#FFFFFF',
  color: '#1A1A1A',
  border: '1px solid #E8E5E0',
  borderRadius: 0,
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

const primaryBtnStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.05em',
  padding: '6px 10px',
  background: '#C9A96E',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 600,
}

// =============================================================

export default function DailySidePanel({
  date,
  staff,
  appointments,
  mode = 'daily',
}: Props) {
  const showDailyOnly = mode === 'daily'
  return (
    <div className="flex flex-col gap-3" style={{ width: '100%' }}>
      {showDailyOnly && <DailyMemoSection date={date} />}
      {showDailyOnly && (
        <ReportSection
          date={date}
          staff={staff}
          appointments={appointments ?? []}
        />
      )}
      <RecurringSection staff={staff} />
    </div>
  )
}

// ─── 1. 오늘의 메모 ───────────────────────────────

function DailyMemoSection({ date }: { date: string }) {
  const [memo, setMemo] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLoadingRef = useRef(false)

  // 날짜 변경 시 해당 날짜의 메모 로드
  useEffect(() => {
    isLoadingRef.current = true
    try {
      const saved = localStorage.getItem(memoKey(date)) ?? ''
      setMemo(saved)
    } catch {
      setMemo('')
    }
    // 다음 tick부터 저장 효과 활성화
    setTimeout(() => {
      isLoadingRef.current = false
    }, 0)
  }, [date])

  // memo 변경 시 1초 debounce로 localStorage 저장
  useEffect(() => {
    if (isLoadingRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(memoKey(date), memo)
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 800)
      } catch {
        // 용량 초과 등은 무시
      }
    }, 1000)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [memo, date])

  return (
    <section style={sectionStyle}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <div style={{ ...headerStyle, marginBottom: 0 }}>오늘의 메모</div>
        {savedFlash && (
          <span style={{ fontSize: 10, color: '#C9A96E', letterSpacing: '0.05em' }}>
            저장됨
          </span>
        )}
      </div>
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="오늘 기억할 내용..."
        rows={5}
        style={{
          ...inputStyle,
          resize: 'vertical',
          fontSize: 12,
          lineHeight: 1.5,
          minHeight: 96,
        }}
      />
    </section>
  )
}

// ─── 2. 리포트 발송 체크 ──────────────────────────

/** ISO 문자열 → KST "HH:MM" */
function isoToKstHHMM(iso: string): string {
  const d = new Date(iso)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const h = String(kst.getUTCHours()).padStart(2, '0')
  const m = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function ReportSection({
  date,
  staff,
  appointments,
}: {
  date: string
  staff: Staff[]
  appointments: Appointment[]
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const isLoadingRef = useRef(false)

  // 날짜 변경 시 localStorage에서 체크 상태 로드
  useEffect(() => {
    isLoadingRef.current = true
    try {
      const raw = localStorage.getItem(reportKey(date))
      const arr = raw ? (JSON.parse(raw) as string[]) : []
      setChecked(new Set(arr))
    } catch {
      setChecked(new Set())
    }
    setTimeout(() => {
      isLoadingRef.current = false
    }, 0)
  }, [date])

  // checked 변경 시 localStorage 저장 (로드 직후엔 skip)
  useEffect(() => {
    if (isLoadingRef.current) return
    try {
      localStorage.setItem(reportKey(date), JSON.stringify([...checked]))
    } catch {
      // 무시
    }
  }, [checked, date])

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 시간순 정렬한 표시 목록
  const sorted = [...appointments].sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  )

  const doneCount = sorted.filter((a) => checked.has(a.id)).length
  const totalCount = sorted.length

  return (
    <section style={sectionStyle}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <div style={{ ...headerStyle, marginBottom: 0 }}>Report</div>
        {totalCount > 0 && (
          <span style={{ fontSize: 10, color: '#888', letterSpacing: '0.05em' }}>
            {doneCount}/{totalCount}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div style={{ fontSize: 11, color: '#888' }}>예약 없음</div>
      ) : (
        <div className="flex flex-col">
          {sorted.map((a) => {
            const staffName = staff.find((s) => s.id === a.staff_id)?.name
            const short = givenName(staffName)
            const petLabel = a.pet_name ?? '(이름 없음)'
            const isChecked = checked.has(a.id)
            return (
              <label
                key={a.id}
                className="flex items-center gap-2 cursor-pointer"
                style={{
                  padding: '5px 0',
                  borderTop: '1px solid #E8E5E0',
                  fontSize: 11,
                  lineHeight: 1.4,
                  color: isChecked ? '#999' : '#1A1A1A',
                  textDecoration: isChecked ? 'line-through' : 'none',
                  opacity: isChecked ? 0.55 : 1,
                  transition: 'opacity 0.15s, color 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(a.id)}
                  style={{
                    accentColor: '#C9A96E',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, wordBreak: 'break-word' }}>
                  <span style={{ color: '#888', marginRight: 4 }}>
                    {isoToKstHHMM(a.start_at)}
                  </span>
                  <span style={{ fontWeight: 600 }}>{petLabel}</span>
                  {short && (
                    <span style={{ color: isChecked ? '#999' : '#C9A96E' }}>
                      {' '}({short})
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─── 3. 고정(정기) 예약 ──────────────────────────

function RecurringSection({ staff }: { staff: Staff[] }) {
  const [items, setItems] = useState<RecurringAppointment[]>([])
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [isPending, startTransition] = useTransition()

  // 추가 form state
  const [petName, setPetName] = useState('')
  const [petBreed, setPetBreed] = useState('')
  const [weekday, setWeekday] = useState<number>(1) // 월요일 기본
  const [formStaffId, setFormStaffId] = useState<string>('')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  // 최초 로드
  useEffect(() => {
    let cancelled = false
    listRecurringAppointments().then((data) => {
      if (!cancelled) {
        setItems(data)
        setLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleAdd() {
    setErrMsg(null)
    if (!petName.trim()) {
      setErrMsg('이름을 입력해 주세요')
      return
    }
    startTransition(async () => {
      const r = await createRecurringAppointment({
        petName,
        petBreed: petBreed || null,
        weekday,
        staffId: formStaffId || null,
      })
      if (!r.ok) {
        setErrMsg(r.error ?? '등록 실패')
        return
      }
      // 재조회
      const data = await listRecurringAppointments()
      setItems(data)
      setPetName('')
      setPetBreed('')
      setFormStaffId('')
      setAdding(false)
    })
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteRecurringAppointment(id)
      if (r.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id))
      }
    })
  }

  return (
    <section style={sectionStyle}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <div style={{ ...headerStyle, marginBottom: 0 }}>고정 예약</div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          style={{
            fontSize: 11,
            color: '#666',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {adding ? '닫기' : '+ 추가'}
        </button>
      </div>

      {/* 추가 form */}
      {adding && (
        <div
          className="flex flex-col gap-2"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8E5E0',
            padding: 8,
            marginBottom: 8,
          }}
        >
          <input
            placeholder="이름"
            value={petName}
            onChange={(e) => setPetName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="품종 (선택)"
            value={petBreed}
            onChange={(e) => setPetBreed(e.target.value)}
            style={inputStyle}
          />
          <select
            value={weekday}
            onChange={(e) => setWeekday(parseInt(e.target.value, 10))}
            style={inputStyle}
          >
            {WEEKDAYS.map((label, idx) => (
              <option key={idx} value={idx}>
                매주 {label}
              </option>
            ))}
          </select>
          <select
            value={formStaffId}
            onChange={(e) => setFormStaffId(e.target.value)}
            style={inputStyle}
          >
            <option value="">미용사 (선택)</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending}
              style={{
                ...primaryBtnStyle,
                opacity: isPending ? 0.5 : 1,
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? '등록 중…' : '등록'}
            </button>
            {errMsg && (
              <span style={{ fontSize: 10, color: '#B23A3A' }}>{errMsg}</span>
            )}
          </div>
        </div>
      )}

      {/* 목록 */}
      {!loaded ? (
        <div style={{ fontSize: 11, color: '#888' }}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 11, color: '#888' }}>등록된 고정 예약이 없습니다</div>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => {
            const short = givenName(item.staff_name)
            return (
              <div
                key={item.id}
                className="flex items-center justify-between"
                style={{
                  padding: '6px 0',
                  borderTop: '1px solid #E8E5E0',
                  fontSize: 11,
                  color: '#1A1A1A',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ flex: 1, wordBreak: 'break-word' }}>
                  <span style={{ fontWeight: 600 }}>{item.pet_name}</span>
                  {item.pet_breed && (
                    <span style={{ color: '#888' }}> ({item.pet_breed})</span>
                  )}
                  <span style={{ color: '#666' }}>
                    {' '}— 매주 {WEEKDAYS[item.weekday]}
                  </span>
                  {short && (
                    <span style={{ color: '#C9A96E' }}> {short}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={isPending}
                  aria-label="삭제"
                  style={{
                    fontSize: 11,
                    color: '#B23A3A',
                    background: 'transparent',
                    border: 'none',
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    padding: '0 4px',
                    marginLeft: 6,
                  }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
