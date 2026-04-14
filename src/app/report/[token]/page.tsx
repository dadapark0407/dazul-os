import { createClient } from '@/utils/supabase/server'

type PageProps = {
  params: Promise<{ token: string }>
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

function hasValue(v: unknown): v is string {
  if (typeof v !== 'string') return false
  const trimmed = v.trim()
  return trimmed !== '' && trimmed !== '-'
}

type VisitRecord = Record<string, unknown>
type Pet = { id: string; name: string | null; breed: string | null }

async function fetchGuardianReport(token: string) {
  const supabase = await createClient()

  // 1) share_token으로 보호자 조회
  const { data: guardian, error: gErr } = await supabase
    .from('guardians')
    .select('id, name, phone, share_token')
    .eq('share_token', token)
    .maybeSingle()

  if (gErr || !guardian) return null

  // 2) 보호자의 반려견 목록
  const { data: petsData } = await supabase
    .from('pets')
    .select('id, name, breed')
    .eq('guardian_id', guardian.id)
    .order('name')

  const pets: Pet[] = (petsData ?? []) as Pet[]
  const petIds = pets.map((p) => p.id).filter(Boolean)

  // 3) 모든 방문 기록 (최신순)
  let records: VisitRecord[] = []
  if (petIds.length > 0) {
    const { data: recordsData } = await supabase
      .from('visit_records')
      .select('*')
      .in('pet_id', petIds)
      .order('visit_date', { ascending: false })

    records = recordsData ?? []
  }

  // 4) 살롱 설정
  const { data: salonData } = await supabase
    .from('salon_settings')
    .select('salon_name, phone, instagram, address')
    .limit(1)
    .maybeSingle()

  const salon = {
    name: salonData?.salon_name ?? 'DAZUL',
    phone: salonData?.phone ?? null,
    instagram: salonData?.instagram ?? null,
    address: salonData?.address ?? null,
  }

  // pet ID → 이름/품종 매핑
  const petMap: Record<string, Pet> = {}
  for (const p of pets) petMap[p.id] = p

  return { guardian, pets, records, salon, petMap }
}

// ─── 방문 카드 컴포넌트 ───

function VisitCard({
  record,
  petMap,
}: {
  record: VisitRecord
  petMap: Record<string, Pet>
}) {
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

  return (
    <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200/60">
      {/* 헤더: 날짜 + 반려견 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          {pet?.name && (
            <p className="text-base font-bold text-stone-900">
              {pet.name}
              {pet.breed && (
                <span className="ml-1.5 text-sm font-normal text-stone-400">{pet.breed}</span>
              )}
            </p>
          )}
          {visitDate && (
            <p className="mt-0.5 text-xs text-stone-400">{visitDate}</p>
          )}
        </div>
        {careTags.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {careTags.map((tag, i) => (
              <span
                key={i}
                className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-medium text-stone-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 상태 그리드 */}
      {statusFields.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {statusFields.map((f) => (
            <div key={f.label} className="rounded-xl bg-[#faf9f7] p-3 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                {f.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-stone-800">
                {f.value as string}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 케어 상세 */}
      {careDetails.length > 0 && (
        <div className="mt-4 space-y-2">
          {careDetails.map((f) => (
            <div key={f.label} className="rounded-xl bg-[#faf9f7] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                {f.label}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-stone-700">
                {f.value as string}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 특이사항 */}
      {extras.length > 0 && (
        <div className="mt-3 space-y-2">
          {extras.map((f) => (
            <div key={f.label} className="rounded-xl bg-amber-50/60 p-3.5 ring-1 ring-amber-100/80">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/60">
                {f.label}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-stone-700">
                {f.value as string}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 다음 방문 */}
      {nextVisit && (
        <div className="mt-4 rounded-xl bg-stone-900 p-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-400">
            다음 방문
          </p>
          <p className="mt-1 text-sm font-bold text-white">{nextVisit}</p>
        </div>
      )}
    </article>
  )
}

// ─── 메인 페이지 ───

export default async function ReportPage({ params }: PageProps) {
  const { token: rawToken } = await params
  const token = rawToken?.trim()

  const data = token ? await fetchGuardianReport(token) : null

  if (!data) {
    return (
      <main className="min-h-screen bg-[#faf9f7] px-4 py-10">
        <div className="mx-auto max-w-lg rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-stone-200/60">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-stone-400">
            DAZUL
          </p>
          <h1 className="mt-4 text-xl font-bold text-stone-900">
            유효하지 않은 공유 링크입니다.
          </h1>
          <p className="mt-3 text-sm leading-7 text-stone-500">
            링크가 잘못되었거나 만료되었을 수 있어요.
            <br />
            살롱에 다시 공유를 요청해주세요.
          </p>
        </div>
      </main>
    )
  }

  const { guardian, pets, records, salon, petMap } = data
  const guardianName = guardian.name ?? '보호자'

  // 가장 최근 방문의 다음 방문 추천
  const latestNextVisit =
    records.length > 0 && hasValue(records[0].next_visit_recommendation)
      ? (records[0].next_visit_recommendation as string)
      : null

  return (
    <main className="min-h-screen bg-[#faf9f7]">
      {/* ─── 브랜드 헤더 ─── */}
      <div className="bg-gradient-to-b from-[#f5f0ea] to-[#faf9f7] px-4 pb-6 pt-10">
        <div className="mx-auto max-w-lg">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.4em] text-stone-400">
            {salon.name}
          </p>
          <p className="mt-1 text-center text-[10px] tracking-[0.15em] text-stone-300">
            Premium Pet Care
          </p>

          {/* 보호자 + 반려견 요약 */}
          <section className="mt-6 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-200/60 md:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">
              {guardianName}님의 케어 기록
            </h1>

            {/* 반려견 뱃지 */}
            {pets.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {pets.map((p) => (
                  <span
                    key={p.id}
                    className="rounded-full border border-stone-200 bg-stone-50 px-3.5 py-1.5 text-xs font-medium text-stone-700"
                  >
                    {p.name ?? '이름 없음'}
                    {p.breed && (
                      <span className="ml-1 text-stone-400">{p.breed}</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-3 text-xs text-stone-400">
              총 {records.length}건의 방문 기록
            </p>
          </section>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pb-12">
        {/* ─── 다음 방문 (최신 기록 기준) ─── */}
        {latestNextVisit && (
          <section className="mt-6 rounded-2xl bg-stone-900 p-5 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
              다음 방문 안내
            </p>
            <p className="mt-2 text-base font-bold leading-7 text-white">
              {latestNextVisit}
            </p>
          </section>
        )}

        {/* ─── 방문 기록 타임라인 ─── */}
        {records.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-stone-200/60">
            <p className="text-sm text-stone-500">아직 방문 기록이 없습니다.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
              방문 기록
            </p>
            {records.map((record, i) => (
              <VisitCard key={record.id as string ?? i} record={record} petMap={petMap} />
            ))}
          </div>
        )}

        {/* ─── 살롱 연락처 ─── */}
        {(salon.phone || salon.instagram || salon.address) && (
          <section className="mt-10 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-200/60">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
              살롱 안내
            </p>
            <p className="mt-3 text-sm font-semibold text-stone-800">{salon.name}</p>
            <div className="mt-2 space-y-1 text-xs text-stone-500">
              {salon.phone && <p>전화: {salon.phone}</p>}
              {salon.instagram && <p>Instagram: {salon.instagram}</p>}
              {salon.address && <p>{salon.address}</p>}
            </div>
            <p className="mt-3 text-xs leading-5 text-stone-400">
              궁금한 점이 있으시면 언제든 연락 주세요.
            </p>
          </section>
        )}

        {/* ─── 푸터 ─── */}
        <footer className="mt-10 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone-300">
            {salon.name} · Premium Pet Care
          </p>
        </footer>
      </div>
    </main>
  )
}
