import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { buildSiteUrl } from '@/lib/siteUrl'
import ReportDraftButton from '@/components/ReportDraftButton'
import DeleteRecordButton from '@/components/admin/DeleteRecordButton'

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

  // 보호자 공유 링크 (guardian.share_token 기반)
  const shareToken = str(guardian, 'share_token')
  const reportUrl = shareToken ? buildSiteUrl(`/report/${shareToken}`) : null

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

  // 새 컬럼들
  const spaLevel = str(record, 'spa_level')
  const nextVisitDate = str(record, 'next_visit_date')
  const comment = str(record, 'comment')

  // grooming_style JSON 파싱
  const rawGS = record.grooming_style
  const groomingStyle: Record<string, string> =
    rawGS && typeof rawGS === 'object' && !Array.isArray(rawGS)
      ? (rawGS as Record<string, string>)
      : {}
  const hasGroomingStyle = Object.values(groomingStyle).some((v) => v?.trim())

  // spa_level 한글 변환
  const SPA_LABEL: Record<string, string> = {
    basic: '베이직', premium: '에센셜', essential: '에센셜',
    deep: '시그니처', signature: '시그니처', prestige: '프레스티지',
  }
  const spaLabel = spaLevel ? SPA_LABEL[spaLevel] ?? spaLevel : null

  // condition_status 파싱 → 눈/귀/치아/발톱 분리
  function parseCond(s: string | null): Record<string, string | null> {
    const r: Record<string, string | null> = { eyes: null, ears: null, teeth: null, nail: null }
    if (!s) return r
    for (const p of s.split('/').map((x) => x.trim())) {
      if (p.startsWith('눈:')) r.eyes = p.slice(2).trim()
      else if (p.startsWith('귀:')) r.ears = p.slice(2).trim()
      else if (p.startsWith('치아:')) r.teeth = p.slice(3).trim()
      else if (p.startsWith('발톱:')) r.nail = p.slice(3).trim()
    }
    return r
  }
  const cond = parseCond(conditionStatus)
  const healthItems = [
    { label: '피부', value: skinStatus },
    { label: '엉킴', value: coatStatus },
    { label: '눈', value: cond.eyes },
    { label: '귀', value: cond.ears },
    { label: '치아', value: cond.teeth },
    { label: '발톱', value: cond.nail },
  ]
  const hasHealthData = healthItems.some((h) => h.value)

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
          <p className="mt-1 flex items-center gap-2 text-sm text-neutral-500">
            <span>{formatDate(visitDate)} · {serviceType ?? '서비스 미입력'}</span>
            {spaLabel && (
              <span className="inline-block px-2 py-0.5 text-xs font-semibold" style={{ color: '#C9A96E', border: '1px solid #C9A96E' }}>
                ✨ 스파 {spaLabel}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/session/edit/${id}`}
            style={{ border: '1px solid #0A0A0A', background: '#FFFFFF', color: '#0A0A0A', fontSize: 12, letterSpacing: '0.08em', padding: '8px 16px', textDecoration: 'none' }}
          >
            수정
          </Link>
          <DeleteRecordButton recordId={id} />
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
            보호자 공유 링크
          </h2>
          {reportUrl ? (
            <>
              <span className="inline-block rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                공유 가능
              </span>
              <p className="mt-3 break-all rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                {reportUrl}
              </p>
              <Link
                href={`/report/${shareToken}`}
                className="mt-3 inline-block text-sm font-medium text-neutral-500 hover:text-neutral-700"
              >
                리포트 보기 →
              </Link>
            </>
          ) : (
            <>
              <span className="inline-block rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
                보호자 미연결
              </span>
              <p className="mt-2 text-xs text-neutral-400">
                보호자가 연결되면 자동으로 공유 링크가 생성됩니다.
              </p>
            </>
          )}
        </section>
      </div>

      {/* 미용 스타일 */}
      {hasGroomingStyle && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-4 text-lg font-bold text-neutral-900">미용 스타일</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: '얼굴', value: groomingStyle.face },
              { label: '몸', value: groomingStyle.body },
              { label: '다리', value: groomingStyle.legs },
              { label: '꼬리', value: groomingStyle.tail },
              { label: '위생', value: groomingStyle.sanitary },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-neutral-50 p-4">
                <p className="text-xs font-medium text-neutral-500">{item.label}</p>
                <p className="mt-1 text-sm font-medium text-neutral-800">
                  {item.value?.trim() || '—'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 건강 상태 (6칸) */}
      {hasHealthData && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-4 text-lg font-bold text-neutral-900">건강 상태</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {healthItems.map((item) => {
              const hasIssue = item.value && !['좋음', '깨끗함', '없음', '적당함', '양호'].some((g) => item.value!.includes(g))
              return (
                <div
                  key={item.label}
                  className="rounded-xl p-4 text-center"
                  style={{
                    border: hasIssue ? '1px solid #C9A96E' : '1px solid #E8E8E8',
                    background: hasIssue ? '#FFFDF7' : '#FAFAFA',
                  }}
                >
                  <p className="text-xs font-medium" style={{ color: hasIssue ? '#C9A96E' : '#888' }}>
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-medium" style={{ color: hasIssue ? '#C9A96E' : '#888' }}>
                    {item.value ? (hasIssue ? '⚠' : '✓') : '✓'}
                  </p>
                  {hasIssue && item.value && (
                    <p className="mt-1 text-[10px]" style={{ color: '#C9A96E' }}>{item.value}</p>
                  )}
                </div>
              )
            })}
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

      {/* 다음 방문 */}
      {(nextVisitDate || nextVisitRecommendation) && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-3 text-lg font-bold text-neutral-900">다음 방문</h2>
          {nextVisitDate && (
            <p className="text-lg font-semibold text-neutral-900">{formatDate(nextVisitDate)}</p>
          )}
          {nextVisitRecommendation && (
            <p className="mt-2 text-sm text-neutral-600">{nextVisitRecommendation}</p>
          )}
        </section>
      )}

      {/* 보호자 전달 메시지 (리포트 공개) */}
      {comment && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200" style={{ borderLeft: '3px solid #C9A96E' }}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#C9A96E' }}>
            보호자 전달 (리포트 공개)
          </h2>
          <p className="whitespace-pre-line text-sm leading-7 text-neutral-800">{comment}</p>
        </section>
      )}

      {/* 내부 메모 + 기타 */}
      {(specialNotes || note) && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-neutral-900">내부 기록</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            <DetailField label="내부 메모 (비공개)" value={specialNotes} multiline />
            <DetailField label="건강 요약 / 메모" value={note} multiline />
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
