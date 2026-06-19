'use client'

// =============================================================
// 반복(루틴) 예약 설정 — 펫 카드 하단 섹션
// =============================================================

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RecurringSchedule } from '@/types/recurring'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

// 요일 옵션 — 수(3)·일(0) 휴무 제외
const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
]

const FREQUENCY_OPTIONS = [1, 2, 3, 4, 5, 6] as const

// 케어 패턴 태그 후보
const SERVICE_TAGS = ['목욕', '목욕(부분)', '미용']

// 미용 담당이 필요한(=담당 선생님 배정 대상) 서비스
const GROOMING_SERVICES = ['미용', '가위컷', '스포팅']
function isGroomingService(service: string): boolean {
  return GROOMING_SERVICES.some((g) => service.includes(g))
}

type StaffOption = { id: string; name: string }

/** 11:00 ~ 19:30, 30분 단위 */
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = []
  for (let h = 11; h <= 19; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`)
    out.push(`${String(h).padStart(2, '0')}:30`)
  }
  return out // 11:00 ~ 19:30
})()

type Props = {
  petId: string
  guardianId: string
  branchId?: string | null
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.1em',
  color: '#8A8A7A',
  marginBottom: 6,
  display: 'block',
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #E8E5E0',
  borderRadius: 0,
  background: '#FFFFFF',
  padding: '8px 10px',
  fontSize: 13,
  color: '#1A1A1A',
  fontFamily: 'inherit',
  outline: 'none',
}

export default function RecurringScheduleSection({ petId, guardianId, branchId }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [existingId, setExistingId] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [frequencyWeeks, setFrequencyWeeks] = useState<number>(4)
  const [dayOfWeek, setDayOfWeek] = useState<number>(1)
  const [time, setTime] = useState<string>('11:00')
  const [pattern, setPattern] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [stylistId, setStylistId] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const [staffList, setStaffList] = useState<StaffOption[]>([])

  // 미용사 목록 (활성)
  useEffect(() => {
    let cancelled = false
    supabase
      .from('staff')
      .select('id, name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setStaffList(
          (data ?? []).map((s) => ({ id: String(s.id), name: String(s.name) }))
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 패턴에 미용·가위컷·스포팅이 하나라도 있으면 담당 선생님 지정 가능
  const stylistEnabled = pattern.some(isGroomingService)

  // 기존 스케줄 로드
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessage(null)
    supabase
      .from('recurring_schedules')
      .select('*')
      .eq('pet_id', petId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const s = data as RecurringSchedule | null
        if (s) {
          setExistingId(s.id)
          setIsActive(s.is_active)
          setFrequencyWeeks(s.frequency_weeks)
          setDayOfWeek(s.preferred_day_of_week)
          setTime(String(s.preferred_time).slice(0, 5))
          setPattern(Array.isArray(s.service_pattern) ? s.service_pattern : [])
          setCurrentIndex(s.current_pattern_index ?? 0)
          setStylistId(s.grooming_stylist_id ?? '')
          setNotes(s.notes ?? '')
        } else {
          setExistingId(null)
          setIsActive(false)
          setFrequencyWeeks(4)
          setDayOfWeek(1)
          setTime('11:00')
          setPattern([])
          setCurrentIndex(0)
          setStylistId('')
          setNotes('')
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [petId])

  function addTag(tag: string) {
    setPattern((prev) => [...prev, tag])
  }
  function removeTag(i: number) {
    setPattern((prev) => {
      const next = prev.filter((_, idx) => idx !== i)
      // 인덱스가 패턴 길이를 벗어나지 않도록 보정
      setCurrentIndex((ci) => (next.length === 0 ? 0 : Math.min(ci, next.length - 1)))
      return next
    })
  }

  async function handleSave() {
    setMessage(null)
    if (pattern.length === 0) {
      setMessage({ type: 'err', text: '케어 패턴을 1개 이상 추가해 주세요.' })
      return
    }
    setSaving(true)

    const safeIndex = pattern.length === 0 ? 0 : Math.min(currentIndex, pattern.length - 1)
    const payload = {
      pet_id: petId,
      guardian_id: guardianId,
      branch_id: branchId || BRANCH_ID,
      frequency_weeks: frequencyWeeks,
      preferred_day_of_week: dayOfWeek,
      preferred_time: `${time}:00`,
      service_pattern: pattern,
      current_pattern_index: safeIndex,
      is_active: isActive,
      grooming_stylist_id: stylistEnabled ? stylistId || null : null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const res = existingId
      ? await supabase.from('recurring_schedules').update(payload).eq('id', existingId).select('id').maybeSingle()
      : await supabase.from('recurring_schedules').insert(payload).select('id').maybeSingle()

    setSaving(false)

    if (res.error) {
      setMessage({ type: 'err', text: `저장 실패: ${res.error.message}` })
      return
    }
    if (res.data?.id) setExistingId(String(res.data.id))
    setMessage({ type: 'ok', text: '저장되었습니다.' })
  }

  async function handleDelete() {
    if (!existingId) return
    if (!window.confirm('이 반려견의 반복 방문 설정을 삭제할까요?')) return
    setMessage(null)
    setDeleting(true)

    const { error } = await supabase
      .from('recurring_schedules')
      .delete()
      .eq('id', existingId)

    setDeleting(false)

    if (error) {
      setMessage({ type: 'err', text: `삭제 실패: ${error.message}` })
      return
    }

    // 폼 초기화 (신규 입력 상태로)
    setExistingId(null)
    setIsActive(false)
    setFrequencyWeeks(4)
    setDayOfWeek(1)
    setTime('11:00')
    setPattern([])
    setCurrentIndex(0)
    setStylistId('')
    setNotes('')
    setMessage({ type: 'ok', text: '반복 방문 설정을 삭제했습니다.' })
  }

  return (
    <div
      style={{
        border: '1px solid #E8E5E0',
        background: '#FFFFFF',
        padding: 20,
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <h4
          style={{
            fontSize: 13,
            letterSpacing: '0.1em',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: 0,
          }}
        >
          반복 방문 설정
        </h4>
        {/* ON/OFF 토글 */}
        <button
          type="button"
          onClick={() => setIsActive((v) => !v)}
          disabled={loading}
          aria-pressed={isActive}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: `1px solid ${isActive ? '#C9A96E' : '#E8E5E0'}`,
            background: isActive ? '#C9A96E' : '#FFFFFF',
            color: isActive ? '#FFFFFF' : '#8A8A7A',
            borderRadius: 0,
            fontSize: 11,
            letterSpacing: '0.1em',
            padding: '6px 14px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          반복 방문 {isActive ? 'ON' : 'OFF'}
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: '#8A8A7A' }}>불러오는 중…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* 방문 주기 */}
          <div>
            <label style={labelStyle}>방문 주기</label>
            <select
              value={frequencyWeeks}
              onChange={(e) => setFrequencyWeeks(Number(e.target.value))}
              style={{ ...inputStyle, width: '100%' }}
            >
              {FREQUENCY_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w}주
                </option>
              ))}
            </select>
          </div>

          {/* 요일 */}
          <div>
            <label style={labelStyle}>요일</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              style={{ ...inputStyle, width: '100%' }}
            >
              {WEEKDAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}요일
                </option>
              ))}
            </select>
          </div>

          {/* 시간 */}
          <div>
            <label style={labelStyle}>시간</label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* 케어 패턴 */}
          <div className="sm:col-span-2">
            <label style={labelStyle}>케어 패턴 (순서대로)</label>

            {/* 현재 패턴 순서 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, minHeight: 28 }}>
              {pattern.length === 0 ? (
                <span style={{ fontSize: 12, color: '#BBB' }}>추가된 케어가 없습니다.</span>
              ) : (
                pattern.map((p, i) => (
                  <span
                    key={`${p}-${i}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      border: `1px solid ${i === currentIndex ? '#C9A96E' : '#E8E5E0'}`,
                      background: i === currentIndex ? '#FAF6EE' : '#FFFFFF',
                      color: '#1A1A1A',
                      fontSize: 12,
                      padding: '5px 10px',
                    }}
                  >
                    <span style={{ color: '#8A8A7A', fontSize: 11 }}>{i + 1}.</span>
                    {p}
                    <button
                      type="button"
                      onClick={() => removeTag(i)}
                      aria-label="삭제"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#B23A3A',
                        cursor: 'pointer',
                        fontSize: 13,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* 태그 추가 버튼 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SERVICE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  style={{
                    border: '1px solid #E8E5E0',
                    background: '#FFFFFF',
                    color: '#1A1A1A',
                    borderRadius: 0,
                    fontSize: 12,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* 첫 방문 케어 — 몇 번째 케어부터 시작할지 선택 */}
          <div className="sm:col-span-2">
            <label style={labelStyle}>첫 방문 케어</label>
            {pattern.length === 0 ? (
              <p style={{ fontSize: 12, color: '#BBB' }}>케어 패턴을 먼저 추가해 주세요.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pattern.map((p, i) => {
                  const selected = i === currentIndex
                  return (
                    <label
                      key={`${p}-${i}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        border: `1px solid ${selected ? '#C9A96E' : '#E8E5E0'}`,
                        background: selected ? '#FAF6EE' : '#FFFFFF',
                        color: '#1A1A1A',
                        fontSize: 12,
                        padding: '6px 12px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="first-care"
                        checked={selected}
                        onChange={() => setCurrentIndex(i)}
                        style={{ accentColor: '#C9A96E' }}
                      />
                      {p}({i + 1}번째)
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* 미용 담당 선생님 */}
          <div className="sm:col-span-2">
            <label style={labelStyle}>미용 담당 선생님</label>
            <select
              value={stylistId}
              onChange={(e) => setStylistId(e.target.value)}
              disabled={!stylistEnabled}
              style={{
                ...inputStyle,
                width: '100%',
                background: stylistEnabled ? '#FFFFFF' : '#F0EDE8',
                color: stylistEnabled ? '#1A1A1A' : '#BBB',
                cursor: stylistEnabled ? 'pointer' : 'not-allowed',
              }}
            >
              <option value="">지정 없음</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {!stylistEnabled && (
              <p style={{ fontSize: 11, color: '#BBB', marginTop: 6 }}>
                미용·가위컷·스포팅 패턴이 있을 때 지정할 수 있습니다.
              </p>
            )}
          </div>

          {/* 메모 */}
          <div className="sm:col-span-2">
            <label style={labelStyle}>메모</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="고정 미용사, 특이사항 등"
              style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* 저장 */}
          <div className="sm:col-span-2" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || deleting}
              style={{
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 0,
                fontSize: 11,
                letterSpacing: '0.1em',
                padding: '10px 24px',
                cursor: saving || deleting ? 'not-allowed' : 'pointer',
                opacity: saving || deleting ? 0.6 : 1,
              }}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            {existingId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
                style={{
                  background: '#FFFFFF',
                  color: '#B23A3A',
                  border: '1px solid #B23A3A',
                  borderRadius: 0,
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  padding: '10px 20px',
                  cursor: saving || deleting ? 'not-allowed' : 'pointer',
                  opacity: saving || deleting ? 0.6 : 1,
                }}
              >
                {deleting ? '삭제 중…' : '루틴 삭제'}
              </button>
            )}
            {message && (
              <span
                style={{
                  fontSize: 12,
                  color: message.type === 'ok' ? '#1D6A4E' : '#B23A3A',
                }}
              >
                {message.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
