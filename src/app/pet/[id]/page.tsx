import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CopyTextButton from '@/components/CopyTextButton'
import { analyzePet, getRoutineBadgeLabel } from '@/lib/wellness'

// TODO: 역할 기반 인증 — staff 이상
// TODO: record_values 편집 UI

type PageProps = {
  params: Promise<{ id: string }>
}

type Guardian = {
  id: string
  name: string | null
  phone: string | null
  memo?: string | null
}

type Pet = {
  id: string
  guardian_id: string | null
  name: string | null
  breed?: string | null
  gender?: string | null
  birth_date?: string | null
  weight?: number | null
  memo?: string | null
}

type VisitRecord = {
  id: string
  pet_id: string
  visit_date: string | null
  service_type?: string | null
  skin_status?: string | null
  coat_status?: string | null
  condition_status?: string | null
  stress_status?: string | null
  special_notes?: string | null
  next_visit_recommendation?: string | null
  care_summary?: string | null
  care_actions?: string | null
  care_notes?: string | null
  next_care_guide?: string | null
  note?: string | null
  created_at?: string | null
}

type RecordValue = {
  visit_record_id: string
  field_id: string
  value_text: string | null
  value_json: unknown
}

type FieldDef = {
  id: string
  label: string
  field_key: string
  field_type: string
}

function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function formatShortDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatPhone(phone?: string | null) {
  return phone || '-'
}

function joinNonEmpty(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(' · ')
}

function getConcernLevel(score: number) {
  if (score >= 6) return '높음'
  if (score >= 3) return '보통'
  return '낮음'
}

function getConcernColor(score: number) {
  if (score >= 6) return 'text-rose-600 bg-rose-50'
  if (score >= 3) return 'text-amber-700 bg-amber-50'
  return 'text-emerald-700 bg-emerald-50'
}

function calculateAge(birthDate?: string | null): string | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  const years = now.getFullYear() - birth.getFullYear()
  const months = now.getMonth() - birth.getMonth()
  const totalMonths = years * 12 + months
  if (totalMonths < 12) return `${Math.max(totalMonths, 0)}개월`
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return m > 0 ? `${y}세 ${m}개월` : `${y}세`
}

// 타임라인 날짜 그룹핑
function groupByMonth(records: VisitRecord[]): { label: string; records: VisitRecord[] }[] {
  const groups = new Map<string, VisitRecord[]>()
  for (const r of records) {
    const d = r.visit_date ? new Date(r.visit_date) : null
    const key = d && !Number.isNaN(d.getTime())
      ? `${d.getFullYear()}년 ${d.getMonth() + 1}월`
      : '날짜 미입력'
    const list = groups.get(key) ?? []
    list.push(r)
    groups.set(key, list)
  }
  return Array.from(groups.entries()).map(([label, records]) => ({ label, records }))
}

export default async function PetTimelinePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 반려견
  const { data: pet, error: petError } = await supabase
    .from('pets')
    .select('*')
    .eq('id', id)
    .single<Pet>()

  if (petError || !pet) notFound()

  // 보호자
  let guardian: Guardian | null = null
  if (pet.guardian_id) {
    const { data } = await supabase
      .from('guardians')
      .select('*')
      .eq('id', pet.guardian_id)
      .single<Guardian>()
    guardian = data ?? null
  }

  // 방문 기록
  const { data: visitRecordsData } = await supabase
    .from('visit_records')
    .select('*')
    .eq('pet_id', pet.id)
    .order('visit_date', { ascending: false })

  const records = ensureArray(visitRecordsData as VisitRecord[])

  // 동적 필드 값 로드 (안전 — 테이블 없으면 빈 배열)
  let dynamicValues: RecordValue[] = []
  let fieldDefs: FieldDef[] = []

  if (records.length > 0) {
    try {
      const recordIds = records.map((r) => r.id)
      const [valResult, fieldResult] = await Promise.all([
        supabase
          .from('record_values')
          .select('visit_record_id, field_id, value_text, value_json')
          .in('visit_record_id', recordIds),
        supabase
          .from('record_fields')
          .select('id, label, field_key, field_type')
          .order('sort_order'),
      ])
      dynamicValues = valResult.data ?? []
      fieldDefs = fieldResult.data ?? []
    } catch {
      // 테이블 없음 — 무시
    }
  }

  // field_id → label 맵
  const fieldLabelMap = new Map(fieldDefs.map((f) => [f.id, f.label]))

  // visit_record_id → { label: displayValue }[] 맵
  const dynamicByRecord = new Map<string, { label: string; value: string }[]>()
  for (const v of dynamicValues) {
    const label = fieldLabelMap.get(v.field_id)
    if (!label) continue
    let display = ''
    if (v.value_text) {
      display = v.value_text
    } else if (v.value_json !== null && v.value_json !== undefined) {
      if (Array.isArray(v.value_json)) {
        display = v.value_json.join(', ')
      } else if (typeof v.value_json === 'boolean') {
        display = v.value_json ? '예' : '아니오'
      } else {
        display = String(v.value_json)
      }
    }
    if (!display) continue
    const list = dynamicByRecord.get(v.visit_record_id) ?? []
    list.push({ label, value: display })
    dynamicByRecord.set(v.visit_record_id, list)
  }

  // 웰니스 분석
  const analysis = analyzePet(pet, records)
  const age = calculateAge(pet.birth_date)
  const latestRecord = records[0] ?? null
  const groups = groupByMonth(records)

  // 상담/보호자용 멘트 (기존 로직 유지)
  const counselorMessage = [
    `${pet.name ?? '이 아이'} 브리핑입니다.`,
    `누적 방문은 ${analysis.visitCount}회이며 최근 90일 방문은 ${analysis.recent90Count}회입니다.`,
    analysis.cycleStats?.averageDays
      ? `평균 방문 주기는 ${analysis.cycleStats.averageDays}일입니다.`
      : `방문 주기는 아직 더 기록이 필요합니다.`,
    analysis.routineStats?.routineType
      ? `현재 패턴은 ${getRoutineBadgeLabel(analysis.routineStats.routineType)}으로 해석됩니다.`
      : `루틴 판정 데이터는 아직 충분하지 않습니다.`,
    `최근 상태 관심도는 ${analysis.concernScore}점(${getConcernLevel(analysis.concernScore)})입니다.`,
    analysis.latestRecord?.special_notes
      ? `특이사항: ${analysis.latestRecord.special_notes}`
      : `기록된 특이사항은 없습니다.`,
  ].join(' ')

  const customerMessage = [
    `안녕하세요`,
    `${pet.name ?? '아이'}의 최근 기록을 기준으로 정리해드릴게요.`,
    '',
    `현재 누적 방문은 ${analysis.visitCount}회이고`,
    analysis.cycleStats?.averageDays
      ? `평균 방문 주기는 약 ${analysis.cycleStats.averageDays}일 정도로 보여요.`
      : `방문 주기는 아직 조금 더 기록이 쌓이면 더 정확하게 볼 수 있어요.`,
    '',
    analysis.routineStats?.routineType
      ? `현재는 ${getRoutineBadgeLabel(analysis.routineStats.routineType)} 흐름으로 보입니다.`
      : `아직 정기 루틴은 더 지켜보면 좋을 것 같아요.`,
    '',
    analysis.concernScore >= 3
      ? `최근 기록상 조금 더 세심하게 보면 좋은 포인트가 있어 함께 관리해드리면 좋겠습니다.`
      : `최근 기록상 큰 무리 없이 비교적 안정적인 흐름으로 보입니다.`,
    '',
    `앞으로도 ${pet.name ?? '아이'}의 컨디션과 피부, 모질 상태를 함께 보면서 관리 도와드릴게요.`,
  ].join('\n')

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* ─── 관리자 헤더 + 네비게이션 (admin/layout.tsx와 동일) ─── */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="text-lg font-bold tracking-tight text-neutral-900">
            DAZUL 관리
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            홈으로
          </Link>
        </div>
        <nav className="scrollbar-hide overflow-x-auto border-t border-neutral-100">
          <div className="mx-auto flex max-w-7xl gap-1 px-4 py-2">
            {[
              { href: '/admin', label: '대시보드' },
              { href: '/admin/pets', label: '반려견' },
              { href: '/admin/guardians', label: '보호자' },
              { href: '/admin/records', label: '방문 기록' },
              { href: '/admin/products', label: '제품' },
              { href: '/admin/followups', label: '후속 관리' },
              { href: '/admin/settings', label: '설정' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main>
      {/* ─── 프로필 헤더 ─── */}
      <div className="bg-gradient-to-b from-[#f5f0ea] to-[#faf9f7] px-4 pb-6 pt-8 md:px-6">
        <div className="mx-auto max-w-3xl">
          {/* 페이지 내 네비게이션 */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Link
              href="/admin/pets"
              className="rounded-full border border-stone-200 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-stone-600 backdrop-blur-sm transition hover:bg-white"
            >
              ← 반려견 목록
            </Link>
            {guardian?.id && (
              <Link
                href={`/guardian/${guardian.id}`}
                className="rounded-full border border-stone-200 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-stone-600 backdrop-blur-sm transition hover:bg-white"
              >
                보호자 페이지
              </Link>
            )}
          </div>

          {/* 프로필 카드 */}
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200/60 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
                  Pet Profile
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
                  {pet.name ?? '이름 없음'}
                </h1>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  {joinNonEmpty([
                    pet.breed,
                    pet.gender,
                    age,
                    pet.weight ? `${pet.weight}kg` : null,
                  ]) || '기본 정보가 아직 충분하지 않습니다.'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                  <span>보호자: {guardian?.name ?? '-'}</span>
                  <span>연락처: {formatPhone(guardian?.phone)}</span>
                </div>
                {pet.memo && (
                  <p className="mt-3 rounded-xl bg-stone-50 px-4 py-3 text-xs leading-5 text-stone-600">
                    {pet.memo}
                  </p>
                )}
              </div>

              {/* KPI 미니 카드 */}
              <div className="grid shrink-0 grid-cols-2 gap-2.5 md:w-[240px]">
                <div className="rounded-2xl bg-stone-50 p-3.5 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">누적 방문</p>
                  <p className="mt-1 text-2xl font-bold text-stone-800">{analysis.visitCount}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-3.5 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">90일 방문</p>
                  <p className="mt-1 text-2xl font-bold text-stone-800">{analysis.recent90Count}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-3.5 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">평균 주기</p>
                  <p className="mt-1 text-lg font-bold text-stone-800">
                    {analysis.cycleStats?.averageDays ? `${analysis.cycleStats.averageDays}일` : '-'}
                  </p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-3.5 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">루틴</p>
                  <p className="mt-1 text-sm font-bold text-stone-800">
                    {getRoutineBadgeLabel(analysis.routineStats?.routineType)}
                  </p>
                </div>
              </div>
            </div>

            {/* 상태 요약 바 */}
            {latestRecord && (
              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  최근 상태
                </span>
                {latestRecord.skin_status && (
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700">
                    피부: {latestRecord.skin_status}
                  </span>
                )}
                {latestRecord.coat_status && (
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700">
                    모질: {latestRecord.coat_status}
                  </span>
                )}
                {latestRecord.condition_status && (
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700">
                    컨디션: {latestRecord.condition_status}
                  </span>
                )}
                {latestRecord.stress_status && (
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700">
                    스트레스: {latestRecord.stress_status}
                  </span>
                )}
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getConcernColor(analysis.concernScore)}`}>
                  관심도 {analysis.concernScore}점 · {getConcernLevel(analysis.concernScore)}
                </span>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-12 md:px-6">

        {/* ─── 인사이트 ─── */}
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200/60">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">Insight</p>
          <p className="mt-2 text-sm leading-7 text-stone-700">{analysis.visitSummary}</p>
          <p className="mt-1 text-sm leading-7 text-stone-500">{analysis.flowSummary}</p>
          {analysis.autoRecommendation && (
            <p className="mt-3 rounded-xl bg-stone-50 px-4 py-3 text-xs leading-5 text-stone-600">
              {analysis.autoRecommendation}
            </p>
          )}
        </section>

        {/* ─── 멘트 카드 (접이식) ─── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <details className="group rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60">
            <summary className="flex cursor-pointer items-center justify-between p-5">
              <span className="text-sm font-semibold text-stone-800">상담용 멘트</span>
              <span className="text-xs text-stone-400 group-open:hidden">펼치기</span>
            </summary>
            <div className="border-t border-stone-100 px-5 pb-5 pt-3">
              <p className="whitespace-pre-line text-xs leading-6 text-stone-600">{counselorMessage}</p>
              <div className="mt-3">
                <CopyTextButton text={counselorMessage} label="복사" />
              </div>
            </div>
          </details>

          <details className="group rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60">
            <summary className="flex cursor-pointer items-center justify-between p-5">
              <span className="text-sm font-semibold text-stone-800">보호자 전달용</span>
              <span className="text-xs text-stone-400 group-open:hidden">펼치기</span>
            </summary>
            <div className="border-t border-stone-100 px-5 pb-5 pt-3">
              <p className="whitespace-pre-line text-xs leading-6 text-stone-600">{customerMessage}</p>
              <div className="mt-3">
                <CopyTextButton text={customerMessage} label="복사" />
              </div>
            </div>
          </details>
        </div>

        {/* ─── 새 기록 CTA ─── */}
        <div className="mt-8 flex justify-center">
          <Link
            href={`/admin/records/new?petId=${pet.id}${guardian?.id ? `&guardianId=${guardian.id}` : ''}`}
            className="rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-700"
          >
            + 새 방문 기록 작성
          </Link>
        </div>

        {/* ─── 타임라인 ─── */}
        <section className="mt-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">케어 타임라인</h2>
            <span className="text-xs text-stone-400">{records.length}건 · 최신순</span>
          </div>

          {records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-12 text-center">
              <p className="text-sm text-stone-500">아직 방문 기록이 없습니다.</p>
              <p className="mt-2 text-xs text-stone-400">위의 버튼으로 첫 기록을 작성해보세요.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {groups.map((group) => (
                <div key={group.label}>
                  {/* 월 라벨 */}
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                      {group.label}
                    </span>
                    <div className="h-px flex-1 bg-stone-200" />
                  </div>

                  {/* 방문 카드 */}
                  <div className="space-y-3">
                    {group.records.map((record) => {
                      const dynFields = dynamicByRecord.get(record.id)
                      const careTags = [
                        record.service_type,
                        record.care_summary,
                      ].filter(Boolean)

                      return (
                        <article
                          key={record.id}
                          className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200/60 transition hover:shadow-md"
                        >
                          {/* 헤더 */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-stone-800">
                                {formatShortDate(record.visit_date)}
                              </p>
                              {record.service_type && (
                                <p className="mt-0.5 text-xs text-stone-500">{record.service_type}</p>
                              )}
                            </div>
                            <Link
                              href={`/admin/records/${record.id}`}
                              className="shrink-0 rounded-full border border-stone-200 px-2.5 py-1 text-[10px] font-medium text-stone-500 transition hover:bg-stone-50"
                            >
                              상세
                            </Link>
                          </div>

                          {/* 상태 칩 */}
                          {(record.skin_status || record.coat_status || record.condition_status || record.stress_status) && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {record.skin_status && (
                                <span className="rounded-full bg-stone-50 px-2.5 py-1 text-[11px] text-stone-600">
                                  피부 {record.skin_status}
                                </span>
                              )}
                              {record.coat_status && (
                                <span className="rounded-full bg-stone-50 px-2.5 py-1 text-[11px] text-stone-600">
                                  모질 {record.coat_status}
                                </span>
                              )}
                              {record.condition_status && (
                                <span className="rounded-full bg-stone-50 px-2.5 py-1 text-[11px] text-stone-600">
                                  {record.condition_status}
                                </span>
                              )}
                              {record.stress_status && (
                                <span className="rounded-full bg-stone-50 px-2.5 py-1 text-[11px] text-stone-600">
                                  스트레스 {record.stress_status}
                                </span>
                              )}
                            </div>
                          )}

                          {/* 케어 태그 */}
                          {careTags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {careTags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* 케어 상세 */}
                          {(record.care_actions || record.care_notes) && (
                            <div className="mt-3 space-y-1">
                              {record.care_actions && (
                                <p className="text-xs leading-5 text-stone-600">
                                  <span className="font-medium text-stone-500">케어:</span> {record.care_actions}
                                </p>
                              )}
                              {record.care_notes && (
                                <p className="text-xs leading-5 text-stone-600">
                                  <span className="font-medium text-stone-500">조치:</span> {record.care_notes}
                                </p>
                              )}
                            </div>
                          )}

                          {/* 동적 필드 */}
                          {dynFields && dynFields.length > 0 && (
                            <div className="mt-3 rounded-xl bg-stone-50/60 p-3">
                              <div className="grid gap-1.5 sm:grid-cols-2">
                                {dynFields.map((df, i) => (
                                  <p key={i} className="text-xs leading-5 text-stone-600">
                                    <span className="font-medium text-stone-500">{df.label}:</span> {df.value}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 특이사항 / 메모 */}
                          {(record.special_notes || record.note) && (
                            <div className="mt-3 rounded-xl bg-amber-50/50 px-3.5 py-2.5">
                              {record.special_notes && (
                                <p className="text-xs leading-5 text-amber-800">
                                  {record.special_notes}
                                </p>
                              )}
                              {record.note && !record.special_notes && (
                                <p className="text-xs leading-5 text-stone-600">{record.note}</p>
                              )}
                            </div>
                          )}

                          {/* 다음 방문 */}
                          {(record.next_visit_recommendation || record.next_care_guide) && (
                            <div className="mt-3 border-t border-stone-100 pt-3">
                              {record.next_visit_recommendation && (
                                <p className="text-xs leading-5 text-stone-500">
                                  <span className="font-medium">다음 방문:</span> {record.next_visit_recommendation}
                                </p>
                              )}
                              {record.next_care_guide && (
                                <p className="mt-0.5 text-xs leading-5 text-stone-500">
                                  <span className="font-medium">다음 케어:</span> {record.next_care_guide}
                                </p>
                              )}
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── 푸터 ─── */}
        <footer className="mt-12 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone-300">
            DAZUL · Premium Pet Care
          </p>
        </footer>
      </div>
      </main>
    </div>
  )
}
