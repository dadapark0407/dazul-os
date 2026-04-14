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

  const { data: guardian, error: gErr } = await supabase
    .from('guardians')
    .select('id, name, phone, share_token')
    .eq('share_token', token)
    .maybeSingle()

  if (gErr || !guardian) return null

  const { data: petsData } = await supabase
    .from('pets')
    .select('id, name, breed')
    .eq('guardian_id', guardian.id)
    .order('name')

  const pets: Pet[] = (petsData ?? []) as Pet[]
  const petIds = pets.map((p) => p.id).filter(Boolean)

  let records: VisitRecord[] = []
  if (petIds.length > 0) {
    const { data: recordsData } = await supabase
      .from('visit_records')
      .select('*')
      .in('pet_id', petIds)
      .order('visit_date', { ascending: false })
    records = recordsData ?? []
  }

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

  const petMap: Record<string, Pet> = {}
  for (const p of pets) petMap[p.id] = p

  return { guardian, pets, records, salon, petMap }
}

// ─── 골드 디바이더 ───

function GoldDivider() {
  return <div className="mx-auto my-8 h-px w-16 bg-dz-accent/40" />
}

// ─── 방문 카드 ───

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
    <article className="border-b border-dz-border/50 pb-10 last:border-b-0">
      {/* 날짜 + 반려견 */}
      <div className="flex items-baseline justify-between gap-4">
        <div>
          {pet?.name && (
            <h3 className="font-heading text-xl font-light tracking-wide text-dz-primary">
              {pet.name}
            </h3>
          )}
          {visitDate && (
            <p className="mt-1 text-[11px] tracking-[0.1em] text-dz-muted">{visitDate}</p>
          )}
        </div>
        {careTags.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {careTags.map((tag, i) => (
              <span
                key={i}
                className="border-b border-dz-accent/40 pb-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-dz-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 상태 */}
      {statusFields.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statusFields.map((f) => (
            <div key={f.label} className="text-center">
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-dz-muted/60">
                {f.label}
              </p>
              <p className="mt-1.5 text-sm font-medium text-dz-primary">
                {f.value as string}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 케어 상세 */}
      {careDetails.length > 0 && (
        <div className="mt-6 space-y-4">
          {careDetails.map((f) => (
            <div key={f.label}>
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-dz-accent">
                {f.label}
              </p>
              <p className="mt-1.5 whitespace-pre-line text-[13px] leading-7 text-dz-primary/80">
                {f.value as string}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 특이사항 */}
      {extras.length > 0 && (
        <div className="mt-6 space-y-3">
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
        </div>
      )}

      {/* 다음 방문 */}
      {nextVisit && (
        <div className="mt-6 border border-dz-accent/30 bg-dz-gold-light/30 px-5 py-4 text-center">
          <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-dz-accent">
            Next Visit
          </p>
          <p className="mt-1.5 text-sm font-medium text-dz-primary">{nextVisit}</p>
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
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-sm text-center">
          <p className="font-heading text-2xl font-light tracking-[0.4em] text-dz-primary">
            DAZUL
          </p>
          <div className="mx-auto my-6 h-px w-12 bg-dz-accent/40" />
          <p className="text-sm text-dz-muted">유효하지 않은 공유 링크입니다.</p>
          <p className="mt-2 text-xs text-dz-border">
            살롱에 다시 공유를 요청해주세요.
          </p>
        </div>
      </main>
    )
  }

  const { guardian, pets, records, salon, petMap } = data
  const guardianName = guardian.name ?? '보호자'

  const latestNextVisit =
    records.length > 0 && hasValue(records[0].next_visit_recommendation)
      ? (records[0].next_visit_recommendation as string)
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
        {/* 골드 라인 */}
        <div className="mx-auto mt-6 h-px w-20 bg-dz-accent/50" />
      </header>

      <div className="mx-auto max-w-lg px-6 py-10 md:px-8">
        {/* ─── 보호자 + 반려견 ─── */}
        <section className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-dz-muted">
            Care Report
          </p>
          <h1 className="mt-4 font-heading text-3xl font-light tracking-wide text-dz-primary">
            {guardianName}
          </h1>

          {pets.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {pets.map((p) => (
                <span
                  key={p.id}
                  className="text-[11px] tracking-[0.1em] text-dz-muted"
                >
                  {p.name ?? '이름 없음'}
                  {p.breed && (
                    <span className="ml-1 text-dz-border">{p.breed}</span>
                  )}
                </span>
              ))}
            </div>
          )}

          <p className="mt-3 text-[10px] text-dz-border">
            {records.length}건의 케어 기록
          </p>
        </section>

        {/* ─── 다음 방문 강조 ─── */}
        {latestNextVisit && (
          <>
            <GoldDivider />
            <section className="border border-dz-accent/30 bg-dz-gold-light/20 px-6 py-6 text-center">
              <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-dz-accent">
                Next Appointment
              </p>
              <p className="mt-2 text-base font-medium text-dz-primary">
                {latestNextVisit}
              </p>
            </section>
          </>
        )}

        <GoldDivider />

        {/* ─── 방문 기록 타임라인 ─── */}
        {records.length === 0 ? (
          <p className="py-12 text-center text-sm text-dz-muted">
            아직 케어 기록이 없습니다.
          </p>
        ) : (
          <div className="space-y-10">
            {records.map((record, i) => (
              <VisitCard key={record.id as string ?? i} record={record} petMap={petMap} />
            ))}
          </div>
        )}

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
