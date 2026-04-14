'use client'

import { useState, useMemo } from 'react'

// ─── 타입 ───

type VisitRecord = Record<string, unknown>
type Pet = { id: string; name: string | null; breed: string | null }
type Salon = { name: string; phone: string | null; instagram: string | null; address: string | null }

type Props = {
  guardianName: string
  pets: Pet[]
  records: VisitRecord[]
  salon: Salon
  petMap: Record<string, Pet>
}

// ─── 유틸 ───

function hasValue(v: unknown): v is string {
  if (typeof v !== 'string') return false
  const trimmed = v.trim()
  if (trimmed === '' || trimmed === '-') return false
  // "피부 상태:" 처럼 라벨만 있고 실제 내용이 없는 경우
  if (/^[\w가-힣\s]+[:\uff1a]\s*$/.test(trimmed)) return false
  return true
}

function formatDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function formatShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(date)
}

function getYearMonth(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '날짜 미상'
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
}

// ─── 골드 디바이더 ───

function GoldDivider() {
  return <div className="mx-auto my-8 h-px w-16 bg-dz-accent/40" />
}

// ─── 방문 카드 (접기/펼치기) ───

function VisitCard({
  record,
  petMap,
  defaultOpen,
}: {
  record: VisitRecord
  petMap: Record<string, Pet>
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const visitDate = formatDate(record.visit_date as string)
  const petId = record.pet_id as string
  const pet = petId ? petMap[petId] : null

  const statusFields = [
    { label: '피부', value: record.skin_status },
    { label: '모질', value: record.coat_status },
    { label: '컨디션', value: record.condition_status },
    { label: '스트레스', value: record.stress_status },
  ].filter((f) => hasValue(f.value))

  const careTags = [
    record.service_type as string,
    record.service as string,
  ].filter(hasValue)

  const careDetails = [
    { label: '케어 요약', value: record.care_summary },
    { label: '진행 내용', value: record.care_actions },
    { label: '문제 → 조치', value: record.care_notes },
    { label: '다음 케어', value: record.next_care_guide },
  ].filter((f) => hasValue(f.value))

  const extras = [
    { label: '특이사항', value: record.special_notes },
    { label: '메모', value: record.note },
  ].filter((f) => hasValue(f.value))

  const nextVisit = hasValue(record.next_visit_recommendation)
    ? (record.next_visit_recommendation as string)
    : null

  const hasContent = statusFields.length > 0 || careDetails.length > 0 || extras.length > 0 || nextVisit

  return (
    <article className="border-b border-dz-border/40 pb-6 last:border-b-0 last:pb-0">
      {/* 헤더 (항상 보임) — 클릭으로 토글 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-3 text-left transition-all duration-400"
      >
        <div>
          <div className="flex items-baseline gap-2">
            {pet?.name && (
              <span className="font-heading text-lg font-light tracking-wide text-dz-primary">
                {pet.name}
              </span>
            )}
            {careTags.length > 0 && (
              <span className="text-[10px] tracking-[0.1em] text-dz-muted">
                {careTags.join(' · ')}
              </span>
            )}
          </div>
          {visitDate && (
            <p className="mt-0.5 text-[11px] tracking-[0.05em] text-dz-muted/60">{visitDate}</p>
          )}
        </div>
        <span className={`mt-1 text-[10px] text-dz-muted/40 transition-transform duration-400 ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {/* 상세 (토글) */}
      {open && hasContent && (
        <div className="mt-5 space-y-5 animate-in fade-in duration-300">
          {/* 상태 */}
          {statusFields.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statusFields.map((f) => (
                <div key={f.label} className="text-center">
                  <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-dz-muted/60">
                    {f.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-dz-primary">{f.value as string}</p>
                </div>
              ))}
            </div>
          )}

          {/* 케어 상세 */}
          {careDetails.map((f) => (
            <div key={f.label}>
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-dz-accent">
                {f.label}
              </p>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-7 text-dz-primary/80">
                {f.value as string}
              </p>
            </div>
          ))}

          {/* 특이사항 */}
          {extras.map((f) => (
            <div key={f.label} className="border-l-2 border-dz-accent/30 pl-4">
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-dz-muted/60">
                {f.label}
              </p>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-7 text-dz-primary/70">
                {f.value as string}
              </p>
            </div>
          ))}

          {/* 다음 방문 */}
          {nextVisit && (
            <div className="border border-dz-accent/30 bg-dz-gold-light/30 px-5 py-3.5 text-center">
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-dz-accent">
                Next Visit
              </p>
              <p className="mt-1 text-sm font-medium text-dz-primary">{nextVisit}</p>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

// ─── 캘린더 뷰 ───

function CalendarView({
  records,
  petMap,
}: {
  records: VisitRecord[]
  petMap: Record<string, Pet>
}) {
  const [currentDate, setCurrentDate] = useState(() => {
    // 가장 최근 방문 월로 시작
    if (records.length > 0 && records[0].visit_date) {
      const d = new Date(records[0].visit_date as string)
      return new Date(d.getFullYear(), d.getMonth(), 1)
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  })

  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // 이번 달 방문 날짜 세트
  const visitDates = useMemo(() => {
    const set = new Set<number>()
    for (const r of records) {
      const d = new Date(r.visit_date as string)
      if (d.getFullYear() === year && d.getMonth() === month) {
        set.add(d.getDate())
      }
    }
    return set
  }, [records, year, month])

  // 달력 그리드 계산
  const firstDay = new Date(year, month, 1).getDay() // 0=일
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDate(null)
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDate(null)
  }

  function handleDateClick(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelectedDate(selectedDate === dateStr ? null : dateStr)
  }

  // 선택된 날짜의 기록
  const selectedRecords = selectedDate
    ? records.filter((r) => (r.visit_date as string) === selectedDate)
    : []

  const monthLabel = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(currentDate)

  return (
    <div>
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-center gap-8">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-8 w-8 items-center justify-center text-dz-muted transition-all duration-400 hover:text-dz-primary"
        >
          ‹
        </button>
        <p className="min-w-[120px] text-center text-[14px] font-medium tracking-[0.1em] text-dz-primary">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-8 w-8 items-center justify-center text-dz-muted transition-all duration-400 hover:text-dz-primary"
        >
          ›
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="mx-auto mt-6 grid max-w-[320px] grid-cols-7">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div
            key={d}
            className={`pb-3 text-center text-[10px] font-medium tracking-[0.1em] ${
              i === 0 ? 'text-dz-accent/60' : 'text-dz-muted/40'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 — 정사각형 셀 */}
      <div className="mx-auto grid max-w-[320px] grid-cols-7">
        {/* 빈 칸 */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`e-${i}`} className="aspect-square" />
        ))}
        {/* 날짜 */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const hasVisit = visitDates.has(day)
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isSelected = selectedDate === dateStr

          return (
            <div key={day} className="flex aspect-square items-center justify-center">
              <button
                type="button"
                onClick={() => hasVisit && handleDateClick(day)}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] transition-all duration-400 ${
                  hasVisit
                    ? isSelected
                      ? 'bg-dz-accent font-semibold text-white shadow-sm'
                      : 'bg-dz-accent/15 font-medium text-dz-primary hover:bg-dz-accent/30'
                    : 'cursor-default text-dz-border/60'
                }`}
              >
                {day}
              </button>
            </div>
          )
        })}
      </div>

      {/* 범례 */}
      <div className="mx-auto mt-4 flex max-w-[320px] items-center justify-center gap-4 text-[10px] text-dz-muted/40">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-dz-accent/15" />
          방문일
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-dz-accent" />
          선택됨
        </span>
      </div>

      {/* 선택된 날짜의 기록 */}
      {selectedRecords.length > 0 && (
        <div className="mt-8 space-y-6 border-t border-dz-border/30 pt-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-dz-accent">
            {formatDate(selectedDate)} 방문 기록
          </p>
          {selectedRecords.map((record, i) => (
            <VisitCard key={record.id as string ?? i} record={record} petMap={petMap} defaultOpen />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 리스트 뷰 (월별 그룹 + 아코디언) ───

function ListView({
  records,
  petMap,
}: {
  records: VisitRecord[]
  petMap: Record<string, Pet>
}) {
  // 월별 그룹
  const grouped = useMemo(() => {
    const map = new Map<string, VisitRecord[]>()
    for (const r of records) {
      const key = r.visit_date ? getYearMonth(r.visit_date as string) : '날짜 미상'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return Array.from(map.entries())
  }, [records])

  let globalIndex = 0

  return (
    <div className="space-y-8">
      {grouped.map(([monthLabel, monthRecords]) => (
        <section key={monthLabel}>
          <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-dz-muted/50">
            {monthLabel}
          </p>
          <div className="space-y-6">
            {monthRecords.map((record) => {
              const isFirst = globalIndex === 0
              globalIndex++
              return (
                <VisitCard
                  key={record.id as string ?? globalIndex}
                  record={record}
                  petMap={petMap}
                  defaultOpen={isFirst}
                />
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

// ─── 메인 클라이언트 ───

export default function ReportClient({ guardianName, pets, records, salon, petMap }: Props) {
  const [selectedPet, setSelectedPet] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'calendar'>('list')

  // 필터링된 기록
  const filtered = useMemo(() => {
    if (!selectedPet) return records
    return records.filter((r) => r.pet_id === selectedPet)
  }, [records, selectedPet])

  const latestNextVisit =
    filtered.length > 0 && hasValue(filtered[0].next_visit_recommendation)
      ? (filtered[0].next_visit_recommendation as string)
      : null

  return (
    <main className="min-h-screen bg-white">
      {/* ─── 브랜드 헤더 ─── */}
      <header className="border-b border-dz-border/40 bg-white px-4 py-10 text-center">
        <p className="font-heading text-2xl font-light tracking-[0.5em] text-dz-primary">
          {salon.name.toUpperCase()}
        </p>
        <p className="mt-2 text-[9px] font-medium uppercase tracking-[0.3em] text-dz-muted">
          Holistic Wellness Care
        </p>
        <div className="mx-auto mt-6 h-px w-20 bg-dz-accent/50" />
      </header>

      <div className="mx-auto max-w-lg px-6 py-10 md:px-8">
        {/* ─── 보호자 요약 ─── */}
        <section className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-dz-muted">
            Care Report
          </p>
          <h1 className="mt-4 font-heading text-3xl font-light tracking-wide text-dz-primary">
            {guardianName}
          </h1>
          <p className="mt-3 text-[10px] text-dz-border">
            {filtered.length}건의 케어 기록
          </p>
        </section>

        {/* ─── 반려견 필터 탭 ─── */}
        {pets.length > 1 && (
          <div className="mt-8 flex flex-wrap justify-center gap-6">
            <button
              type="button"
              onClick={() => setSelectedPet(null)}
              className={`pb-2 text-[14px] tracking-[0.08em] transition-all duration-400 ${
                !selectedPet
                  ? 'border-b-2 border-dz-accent font-semibold text-dz-primary'
                  : 'font-light text-dz-muted/40 hover:text-dz-muted'
              }`}
            >
              전체
            </button>
            {pets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPet(p.id)}
                className={`pb-2 text-[14px] tracking-[0.08em] transition-all duration-400 ${
                  selectedPet === p.id
                    ? 'border-b-2 border-dz-accent font-semibold text-dz-primary'
                    : 'font-light text-dz-muted/40 hover:text-dz-muted'
                }`}
              >
                {p.name ?? '이름 없음'}
              </button>
            ))}
          </div>
        )}

        {/* ─── 다음 방문 ─── */}
        {latestNextVisit && (
          <>
            <GoldDivider />
            <div className="border border-dz-accent/30 bg-dz-gold-light/20 px-6 py-5 text-center">
              <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-dz-accent">
                Next Appointment
              </p>
              <p className="mt-2 text-[14px] font-medium text-dz-primary">{latestNextVisit}</p>
            </div>
          </>
        )}

        <GoldDivider />

        {/* ─── 뷰 전환 ─── */}
        <div className="flex justify-center gap-6">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`pb-1 text-[10px] uppercase tracking-[0.2em] transition-all duration-400 ${
              view === 'list'
                ? 'border-b border-dz-accent text-dz-primary'
                : 'text-dz-muted/40 hover:text-dz-muted'
            }`}
          >
            목록
          </button>
          <button
            type="button"
            onClick={() => setView('calendar')}
            className={`pb-1 text-[10px] uppercase tracking-[0.2em] transition-all duration-400 ${
              view === 'calendar'
                ? 'border-b border-dz-accent text-dz-primary'
                : 'text-dz-muted/40 hover:text-dz-muted'
            }`}
          >
            캘린더
          </button>
        </div>

        {/* ─── 콘텐츠 ─── */}
        <div className="mt-8">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-dz-muted">
              아직 케어 기록이 없습니다.
            </p>
          ) : view === 'list' ? (
            <ListView records={filtered} petMap={petMap} />
          ) : (
            <CalendarView records={filtered} petMap={petMap} />
          )}
        </div>

        {/* ─── 살롱 정보 ─── */}
        {(salon.phone || salon.instagram || salon.address) && (
          <>
            <GoldDivider />
            <section className="text-center">
              <p className="font-heading text-lg font-light tracking-[0.3em] text-dz-primary">
                {salon.name.toUpperCase()}
              </p>
              <div className="mt-3 space-y-1 text-[11px] text-dz-muted">
                {salon.phone && <p>{salon.phone}</p>}
                {salon.instagram && <p>{salon.instagram}</p>}
                {salon.address && <p>{salon.address}</p>}
              </div>
            </section>
          </>
        )}

        {/* ─── 푸터 ─── */}
        <footer className="mt-16 border-t border-dz-border/30 pt-6 text-center">
          <p className="text-[9px] uppercase tracking-[0.3em] text-dz-border">
            {salon.name} · Holistic Wellness Care
          </p>
        </footer>
      </div>
    </main>
  )
}
