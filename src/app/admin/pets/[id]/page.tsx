import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import StatusAction from '@/components/admin/StatusAction'

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

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-100 py-3 last:border-b-0">
      <span className="shrink-0 text-sm font-medium text-neutral-500">{label}</span>
      <span className="text-right text-sm text-neutral-900">{value || '-'}</span>
    </div>
  )
}

/** active / is_active / archived_at 중 어떤 패턴이든 안전하게 판정 */
function resolveActiveState(record: Record<string, unknown>): boolean {
  if ('active' in record) return record.active !== false
  if ('is_active' in record) return record.is_active !== false
  if ('archived_at' in record) return record.archived_at == null
  return true // 상태 컬럼이 없으면 활성으로 간주
}

export default async function AdminPetDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 반려견 정보
  const { data: pet, error: petError } = await supabase
    .from('pets')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (petError || !pet) {
    notFound()
  }

  const isActive = resolveActiveState(pet)

  // 보호자 정보
  let guardian: Record<string, unknown> | null = null
  if (pet.guardian_id) {
    const { data } = await supabase
      .from('guardians')
      .select('*')
      .eq('id', pet.guardian_id)
      .maybeSingle()
    guardian = data
  }

  // 방문 기록
  const { data: visitRecords } = await supabase
    .from('visit_records')
    .select('id, visit_date, service_type, skin_status, coat_status, condition_status, stress_status, special_notes')
    .eq('pet_id', id)
    .order('visit_date', { ascending: false })
    .limit(20)

  const records = visitRecords ?? []
  const totalVisits = records.length

  // 안전한 필드 접근 헬퍼
  const str = (obj: Record<string, unknown> | null, key: string): string | null => {
    if (!obj) return null
    const v = obj[key]
    return typeof v === 'string' ? v : null
  }

  const num = (obj: Record<string, unknown> | null, key: string): number | null => {
    if (!obj) return null
    const v = obj[key]
    return typeof v === 'number' ? v : null
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <Link
              href="/admin/pets"
              className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
            >
              ← 반려견 목록
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900">
              {str(pet, 'name') ?? '이름 없음'}
            </h1>
          </div>
          {isActive ? (
            <span className="inline-block rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
              활성
            </span>
          ) : (
            <span className="inline-block rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-500">
              비활성
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/pets/${id}/edit`}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            수정하기
          </Link>
          <Link
            href={`/pet/${id}`}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            통합 페이지 보기
          </Link>
          <Link
            href={`/admin/records/new?petId=${id}${pet.guardian_id ? `&guardianId=${pet.guardian_id}` : ''}`}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
          >
            기록 작성
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 기본 정보 카드 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            기본 정보
          </h2>
          <InfoRow label="이름" value={str(pet, 'name')} />
          <InfoRow label="품종" value={str(pet, 'breed')} />
          <InfoRow label="성별" value={str(pet, 'gender')} />
          <InfoRow
            label="생년월일"
            value={formatDate(str(pet, 'birth_date'))}
          />
          <InfoRow
            label="체중"
            value={num(pet, 'weight') !== null ? `${num(pet, 'weight')}kg` : null}
          />
          <InfoRow label="메모" value={str(pet, 'memo')} />
        </section>

        {/* 보호자 정보 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            보호자
          </h2>
          {guardian ? (
            <>
              <InfoRow label="이름" value={str(guardian, 'name')} />
              <InfoRow label="연락처" value={str(guardian, 'phone')} />
              <InfoRow label="메모" value={str(guardian, 'memo')} />
              <div className="mt-4">
                <Link
                  href={`/admin/guardians/${pet.guardian_id}`}
                  className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
                >
                  보호자 상세 보기 →
                </Link>
              </div>
            </>
          ) : (
            <p className="py-4 text-sm text-neutral-400">연결된 보호자 정보가 없습니다.</p>
          )}
        </section>

        {/* 방문 요약 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            방문 요약
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-neutral-50 p-4">
              <p className="text-xs text-neutral-500">총 방문</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900">{totalVisits}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 p-4">
              <p className="text-xs text-neutral-500">최근 방문일</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">
                {records.length > 0 ? formatDate(records[0].visit_date) : '-'}
              </p>
            </div>
          </div>

          {/* 최근 상태 스냅샷 */}
          {records.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-neutral-500">최근 상태</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '피부', value: records[0].skin_status },
                  { label: '모질', value: records[0].coat_status },
                  { label: '컨디션', value: records[0].condition_status },
                  { label: '스트레스', value: records[0].stress_status },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-neutral-50 px-3 py-2">
                    <p className="text-xs text-neutral-400">{item.label}</p>
                    <p className="mt-0.5 text-xs font-medium text-neutral-700">
                      {item.value ?? '-'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 방문 기록 타임라인 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">방문 기록</h2>
          <span className="text-sm text-neutral-500">최근 20건</span>
        </div>

        {records.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-neutral-300 py-10 text-center">
            <p className="text-sm text-neutral-500">방문 기록이 아직 없습니다.</p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-neutral-100">
            {records.map((record) => (
              <Link
                key={record.id}
                href={`/admin/records/${record.id}`}
                className="block py-4 transition hover:bg-neutral-50 -mx-2 px-2 rounded-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {formatDate(record.visit_date)}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {record.service_type ?? '서비스 미입력'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {record.skin_status && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                        피부: {record.skin_status}
                      </span>
                    )}
                    {record.condition_status && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                        {record.condition_status}
                      </span>
                    )}
                  </div>
                </div>
                {record.special_notes && (
                  <p className="mt-2 line-clamp-1 text-xs text-neutral-500">
                    특이: {record.special_notes}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 상태 관리 */}
      <StatusAction
        table="pets"
        recordId={id}
        record={pet as Record<string, unknown>}
        entityLabel="반려견"
      />
    </div>
  )
}
