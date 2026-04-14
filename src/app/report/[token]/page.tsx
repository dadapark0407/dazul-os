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

async function fetchReportData(token: string) {
  const supabase = await createClient()

  const { data: reportToken, error: tokenError } = await supabase
    .from('report_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (tokenError || !reportToken) {
    return { reportToken: null, visitRecord: null, petName: null, petBreed: null, salon: null }
  }

  const { data: visitRecord, error: visitError } = await supabase
    .from('visit_records')
    .select('*')
    .eq('id', reportToken.visit_record_id)
    .maybeSingle()

  if (visitError || !visitRecord) {
    return { reportToken: null, visitRecord: null, petName: null, petBreed: null, salon: null }
  }

  // 반려견 이름: visit_records.pet_name 우선, 없으면 pets 테이블 조인
  let petName = hasValue(visitRecord.pet_name) ? visitRecord.pet_name : null
  let petBreed: string | null = null

  if (visitRecord.pet_id) {
    const { data: pet } = await supabase
      .from('pets')
      .select('name, breed')
      .eq('id', visitRecord.pet_id)
      .maybeSingle()
    if (pet) {
      if (!petName && hasValue(pet.name)) petName = pet.name
      if (hasValue(pet.breed)) petBreed = pet.breed
    }
  }

  // 살롱 설정 로드 (없으면 기본값)
  const { data: salonData } = await supabase
    .from('salon_settings')
    .select('salon_name, phone, instagram, address, description')
    .limit(1)
    .maybeSingle()

  const salon = {
    name: salonData?.salon_name ?? 'DAZUL',
    phone: salonData?.phone ?? null,
    instagram: salonData?.instagram ?? null,
    address: salonData?.address ?? null,
    description: salonData?.description ?? null,
  }

  return { reportToken, visitRecord, petName, petBreed, salon }
}

export default async function ReportPage({ params }: PageProps) {
  const { token: rawToken } = await params
  const token = rawToken?.trim()
  const { reportToken, visitRecord, petName, petBreed, salon } = token
    ? await fetchReportData(token)
    : { reportToken: null, visitRecord: null, petName: null, petBreed: null, salon: null }

  const salonInfo = salon ?? { name: 'DAZUL', phone: null, instagram: null, address: null, description: null }

  if (!reportToken || !visitRecord) {
    return (
      <main className="min-h-screen bg-[#faf9f7] px-4 py-10">
        <div className="mx-auto max-w-lg rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-stone-200/60">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-stone-400">
            DAZUL
          </p>
          <h1 className="mt-4 text-xl font-bold text-stone-900">
            유효하지 않은 공유 보고서입니다.
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

  const visitDate = formatDate(visitRecord.visit_date)

  // 케어 태그 수집 (비어있지 않은 것만)
  const careTags = [
    visitRecord.service_type,
    visitRecord.service,
    visitRecord.care_summary,
  ].filter(hasValue)

  // 상태 필드
  const statusFields = [
    { label: '피부', value: visitRecord.skin_status },
    { label: '모질', value: visitRecord.coat_status },
    { label: '컨디션', value: visitRecord.condition_status },
    { label: '스트레스', value: visitRecord.stress_status },
  ].filter((f) => hasValue(f.value))

  // 케어 상세 필드
  const careDetails = [
    { label: '오늘 케어 요약', value: visitRecord.care_summary },
    { label: '진행한 케어 내용', value: visitRecord.care_actions },
    { label: '문제 → 조치', value: visitRecord.care_notes },
    { label: '다음 케어 가이드', value: visitRecord.next_care_guide },
  ].filter((f) => hasValue(f.value))

  // 추가 필드
  const extraFields = [
    { label: '특이사항', value: visitRecord.special_notes },
    { label: '메모', value: visitRecord.note },
  ].filter((f) => hasValue(f.value))

  const nextVisit = hasValue(visitRecord.next_visit_recommendation)
    ? visitRecord.next_visit_recommendation
    : null

  return (
    <main className="min-h-screen bg-[#faf9f7]">
      {/* ─── 브랜드 헤더 ─── */}
      <div className="bg-gradient-to-b from-[#f5f0ea] to-[#faf9f7] px-4 pb-8 pt-10">
        <div className="mx-auto max-w-lg">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.4em] text-stone-400">
            {salonInfo.name}
          </p>
          <p className="mt-1 text-center text-[10px] tracking-[0.15em] text-stone-300">
            Premium Pet Care
          </p>

          {/* 메인 카드 */}
          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200/60 md:p-8">
            {/* 반려견 이름 + 방문일 */}
            <div className="text-center">
              {petName && (
                <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                  {petName}
                  {petBreed && (
                    <span className="ml-2 text-base font-normal text-stone-400">{petBreed}</span>
                  )}
                </h1>
              )}
              {visitDate && (
                <p className="mt-2 text-sm text-stone-500">{visitDate} 방문 기록</p>
              )}
            </div>

            {/* 서비스/케어 뱃지 */}
            {careTags.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {careTags.map((tag, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-stone-200 bg-stone-50 px-3.5 py-1.5 text-xs font-medium text-stone-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* 상태 요약 */}
            {statusFields.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                {statusFields.map((f) => (
                  <div
                    key={f.label}
                    className="rounded-2xl bg-[#faf9f7] p-3.5 text-center"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                      {f.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-stone-800">{f.value}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pb-12">
        {/* ─── 다음 방문 강조 ─── */}
        {nextVisit && (
          <section className="mt-6 rounded-2xl bg-stone-900 p-5 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
              다음 방문 안내
            </p>
            <p className="mt-2 text-base font-bold leading-7 text-white">{nextVisit}</p>
          </section>
        )}

        {/* ─── 케어 상세 ─── */}
        {careDetails.length > 0 && (
          <section className="mt-6 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
              케어 기록
            </p>
            {careDetails.map((f) => (
              <div
                key={f.label}
                className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200/60"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  {f.label}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-stone-700">
                  {f.value}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* ─── 특이사항 / 메모 ─── */}
        {extraFields.length > 0 && (
          <section className="mt-6 space-y-3">
            {extraFields.map((f) => (
              <div
                key={f.label}
                className="rounded-2xl bg-amber-50/60 p-5 ring-1 ring-amber-100/80"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/60">
                  {f.label}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-stone-700">
                  {f.value}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* ─── 살롱 연락처 ─── */}
        {(salonInfo.phone || salonInfo.instagram || salonInfo.address) && (
          <section className="mt-10 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-200/60">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
              살롱 안내
            </p>
            <p className="mt-3 text-sm font-semibold text-stone-800">{salonInfo.name}</p>
            <div className="mt-2 space-y-1 text-xs text-stone-500">
              {salonInfo.phone && <p>전화: {salonInfo.phone}</p>}
              {salonInfo.instagram && <p>Instagram: {salonInfo.instagram}</p>}
              {salonInfo.address && <p>{salonInfo.address}</p>}
            </div>
            <p className="mt-3 text-xs leading-5 text-stone-400">
              궁금한 점이 있으시면 언제든 연락 주세요.
            </p>
          </section>
        )}

        {/* ─── 푸터 ─── */}
        <footer className="mt-10 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone-300">
            {salonInfo.name} · Premium Pet Care
          </p>
        </footer>
      </div>
    </main>
  )
}
