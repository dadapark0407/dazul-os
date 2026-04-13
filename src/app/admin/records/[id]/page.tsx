import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { buildSiteUrl } from '@/lib/siteUrl'
import ReportDraftButton from '@/components/ReportDraftButton'

// TODO: 역할 기반 인증 추가 필요

type PageProps = {
  params: Promise<{ id: string }>
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function DetailField({
  label,
  value,
  multiline,
}: {
  label: string
  value: string | null | undefined
  multiline?: boolean
}) {
  if (!value) return null

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p
        className={`mt-2 text-sm leading-6 text-neutral-800 ${
          multiline ? 'whitespace-pre-line' : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}

// 안전한 필드 접근
function str(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null
  const v = obj[key]
  return typeof v === 'string' ? v : null
}

export default async function AdminRecordDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 방문 기록
  const { data: record, error: recordError } = await supabase
    .from('visit_records')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (recordError || !record) {
    notFound()
  }

  // 반려견 정보
  let pet: Record<string, unknown> | null = null
  const petId = str(record, 'pet_id')
  if (petId) {
    const { data } = await supabase
      .from('pets')
      .select('*')
      .eq('id', petId)
      .maybeSingle()
    pet = data
  }

  // 보호자 정보
  let guardian: Record<string, unknown> | null = null
  const guardianId = str(record, 'guardian_id') ?? str(pet, 'guardian_id')
  if (guardianId) {
    const { data } = await supabase
      .from('guardians')
      .select('*')
      .eq('id', guardianId)
      .maybeSingle()
    guardian = data
  }

  // 리포트 토큰 확인
  const { data: reportToken } = await supabase
    .from('report_tokens')
    .select('token, created_at')
    .eq('visit_record_id', id)
    .maybeSingle()

  const reportUrl = reportToken?.token
    ? buildSiteUrl(`/report/${reportToken.token}`)
    : null

  // 연결된 팔로업 (안전 — 테이블이 없으면 빈 배열)
  const { data: linkedFollowups } = await supabase
    .from('followups')
    .select('id, type, status, due_date, note')
    .eq('related_record_id', id)
    .order('due_date', { ascending: true })

  // 레코드 필드들 — 존재하지 않는 컬럼도 안전하게 처리
  const visitDate = str(record, 'visit_date')
  const serviceType = str(record, 'service_type')
  const note = str(record, 'note')
  const skinStatus = str(record, 'skin_status')
  const coatStatus = str(record, 'coat_status')
  const conditionStatus = str(record, 'condition_status')
  const stressStatus = str(record, 'stress_status')
  const specialNotes = str(record, 'special_notes')
  const nextVisitRecommendation = str(record, 'next_visit_recommendation')
  const careSummary = str(record, 'care_summary')
  const careActions = str(record, 'care_actions')
  const careNotes = str(record, 'care_notes')
  const nextCareGuide = str(record, 'next_care_guide')

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/records"
            className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
          >
            ← 방문 기록 목록
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">
            방문 기록 상세
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {formatDate(visitDate)} · {serviceType ?? '서비스 미입력'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/records/${id}/edit`}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            수정하기
          </Link>
          <Link
            href={`/record/${id}/edit`}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            기존 수정 페이지
          </Link>
        </div>
      </div>

      {/* 연결 정보 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 반려견 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            반려견
          </h2>
          {pet ? (
            <>
              <p className="text-lg font-bold text-neutral-900">
                {str(pet, 'name') ?? '이름 없음'}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {str(pet, 'breed') ?? '품종 미입력'}
              </p>
              <Link
                href={`/admin/pets/${petId}`}
                className="mt-3 inline-block text-sm font-medium text-neutral-500 hover:text-neutral-700"
              >
                상세 보기 →
              </Link>
            </>
          ) : (
            <p className="py-2 text-sm text-neutral-400">반려견 정보 없음</p>
          )}
        </section>

        {/* 보호자 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            보호자
          </h2>
          {guardian ? (
            <>
              <p className="text-lg font-bold text-neutral-900">
                {str(guardian, 'name') ?? '이름 없음'}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {str(guardian, 'phone') ?? '연락처 없음'}
              </p>
              <Link
                href={`/admin/guardians/${guardianId}`}
                className="mt-3 inline-block text-sm font-medium text-neutral-500 hover:text-neutral-700"
              >
                상세 보기 →
              </Link>
            </>
          ) : (
            <p className="py-2 text-sm text-neutral-400">보호자 정보 없음</p>
          )}
        </section>

        {/* 리포트 공유 상태 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            리포트 공유
          </h2>
          {reportToken ? (
            <>
              <div className="flex items-center gap-2">
                <span className="inline-block rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  공유됨
                </span>
                <span className="text-xs text-neutral-400">
                  {formatDate(reportToken.created_at)}
                </span>
              </div>
              {reportUrl && (
                <p className="mt-3 break-all rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                  {reportUrl}
                </p>
              )}
              <Link
                href={`/report/${reportToken.token}`}
                className="mt-3 inline-block text-sm font-medium text-neutral-500 hover:text-neutral-700"
              >
                리포트 보기 →
              </Link>
            </>
          ) : (
            <>
              <span className="inline-block rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
                미공유
              </span>
              <p className="mt-2 text-xs text-neutral-400">
                수정 페이지에서 공유 링크를 생성할 수 있습니다.
              </p>
            </>
          )}
        </section>
      </div>

      {/* 건강/상태 기록 */}
      {(skinStatus || coatStatus || conditionStatus || stressStatus) && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-4 text-lg font-bold text-neutral-900">건강 상태</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: '피부', value: skinStatus },
              { label: '모질', value: coatStatus },
              { label: '컨디션', value: conditionStatus },
              { label: '스트레스', value: stressStatus },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-neutral-50 p-4">
                <p className="text-xs font-medium text-neutral-500">{item.label}</p>
                <p className="mt-1 text-sm font-medium text-neutral-800">
                  {item.value ?? '-'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 케어 기록 */}
      {(careSummary || careActions || careNotes || nextCareGuide) && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-neutral-900">케어 기록</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            <DetailField label="오늘 케어 요약" value={careSummary} multiline />
            <DetailField label="진행한 케어 내용" value={careActions} multiline />
            <DetailField label="문제 → 조치" value={careNotes} multiline />
            <DetailField label="다음 케어 가이드" value={nextCareGuide} multiline />
          </div>
        </section>
      )}

      {/* 추가 기록 */}
      {(specialNotes || nextVisitRecommendation || note) && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-neutral-900">추가 기록</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            <DetailField label="특이사항" value={specialNotes} multiline />
            <DetailField label="다음 방문 추천" value={nextVisitRecommendation} multiline />
            <DetailField label="메모" value={note} multiline />
          </div>
        </section>
      )}

      {/* 연결된 팔로업 */}
      {linkedFollowups && linkedFollowups.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">후속 관리</h2>
            <span className="text-xs text-neutral-400">
              {linkedFollowups.length}건
            </span>
          </div>
          <ul className="mt-4 space-y-2">
            {linkedFollowups.map((f) => {
              const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
                pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: '대기' },
                completed: { bg: 'bg-green-50', text: 'text-green-700', label: '완료' },
                skipped: { bg: 'bg-neutral-100', text: 'text-neutral-500', label: '건너뜀' },
                cancelled: { bg: 'bg-neutral-100', text: 'text-neutral-500', label: '취소' },
              }
              const badge = statusBadge[f.status] ?? statusBadge.pending
              return (
                <li key={f.id}>
                  <Link
                    href={`/admin/followups/${f.id}`}
                    className="flex items-center justify-between rounded-xl border border-neutral-100 p-3 transition hover:bg-neutral-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                        {f.type}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      {f.note && (
                        <span className="hidden text-xs text-neutral-500 sm:inline">
                          {f.note.length > 30 ? f.note.slice(0, 30) + '...' : f.note}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {f.due_date ? formatDate(f.due_date) : '-'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* 리포트 초안 생성 */}
      <ReportDraftButton
        input={{
          petName: str(pet, 'name'),
          guardianName: str(guardian, 'name'),
          breed: str(pet, 'breed'),
          visitDate,
          serviceType,
          skinStatus,
          coatStatus,
          conditionStatus,
          stressStatus,
          careSummary,
          careActions,
          careNotes,
          nextCareGuide,
          specialNotes,
          nextVisitRecommendation,
          note,
        }}
      />

      {/* 아무 상세 필드도 없는 경우 */}
      {!skinStatus &&
        !coatStatus &&
        !conditionStatus &&
        !stressStatus &&
        !careSummary &&
        !careActions &&
        !careNotes &&
        !nextCareGuide &&
        !specialNotes &&
        !nextVisitRecommendation &&
        !note && (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-10 text-center">
            <p className="text-sm text-neutral-500">
              이 방문 기록에는 상세 내용이 아직 입력되지 않았습니다.
            </p>
            <Link
              href={`/admin/records/${id}/edit`}
              className="mt-3 inline-block text-sm font-medium text-neutral-500 hover:text-neutral-700"
            >
              수정하러 가기 →
            </Link>
          </div>
        )}
    </div>
  )
}
