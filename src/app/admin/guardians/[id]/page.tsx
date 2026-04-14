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

// 안전한 필드 접근
function str(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null
  const v = obj[key]
  return typeof v === 'string' ? v : null
}

/** active / is_active / archived_at 중 어떤 패턴이든 안전하게 판정 */
function resolveActiveState(record: Record<string, unknown>): boolean {
  if ('active' in record) return record.active !== false
  if ('is_active' in record) return record.is_active !== false
  if ('archived_at' in record) return record.archived_at == null
  return true
}

export default async function AdminGuardianDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 보호자 정보
  const { data: guardian, error: guardianError } = await supabase
    .from('guardians')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (guardianError || !guardian) {
    notFound()
  }

  const isActive = resolveActiveState(guardian)

  // 반려견 목록
  const { data: petsData } = await supabase
    .from('pets')
    .select('*')
    .eq('guardian_id', id)
    .order('name')

  const pets = (petsData ?? []) as Array<Record<string, unknown>>

  // 반려견 ID 목록으로 방문 기록 가져오기
  const petIds = pets.map((p) => p.id as string).filter(Boolean)
  let records: Array<Record<string, unknown>> = []

  if (petIds.length > 0) {
    const { data: recordsData } = await supabase
      .from('visit_records')
      .select('id, visit_date, service_type, pet_id')
      .in('pet_id', petIds)
      .order('visit_date', { ascending: false })
      .limit(20)

    records = recordsData ?? []
  }

  // pet 이름 매핑
  const petNameMap: Record<string, string> = {}
  for (const p of pets) {
    const pid = p.id as string
    const pname = str(p, 'name')
    if (pid) petNameMap[pid] = pname ?? '이름 없음'
  }

  const totalPets = pets.length
  const totalVisits = records.length

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <Link
              href="/admin/guardians"
              className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
            >
              ← 보호자 목록
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900">
              {str(guardian, 'name') ?? '이름 없음'}
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
            href={`/admin/guardians/${id}/edit`}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            수정하기
          </Link>
          <Link
            href={`/guardian/${id}`}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            통합 페이지 보기
          </Link>
          <Link
            href={`/admin/records/new?guardianId=${id}`}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
          >
            기록 작성
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 기본 정보 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            기본 정보
          </h2>
          <InfoRow label="이름" value={str(guardian, 'name')} />
          <InfoRow label="연락처" value={str(guardian, 'phone')} />
          <InfoRow label="메모" value={str(guardian, 'memo')} />
        </section>

        {/* 요약 카드 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            요약
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-neutral-50 p-4">
              <p className="text-xs text-neutral-500">반려견</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900">{totalPets}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 p-4">
              <p className="text-xs text-neutral-500">방문 기록</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900">{totalVisits}+</p>
            </div>
          </div>
        </section>

        {/* 반려견 목록 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            반려견
          </h2>
          {pets.length === 0 ? (
            <p className="py-4 text-sm text-neutral-400">등록된 반려견이 없습니다.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {pets.map((pet) => {
                const petId = pet.id as string
                return (
                  <Link
                    key={petId}
                    href={`/admin/pets/${petId}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition hover:bg-neutral-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {str(pet, 'name') ?? '이름 없음'}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {str(pet, 'breed') ?? '품종 미입력'}
                      </p>
                    </div>
                    <span className="text-xs text-neutral-400">→</span>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* 방문 기록 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">최근 방문 기록</h2>
          <span className="text-sm text-neutral-500">최근 20건</span>
        </div>

        {records.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-neutral-300 py-10 text-center">
            <p className="text-sm text-neutral-500">방문 기록이 아직 없습니다.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="px-3 py-2 font-semibold">방문일</th>
                  <th className="px-3 py-2 font-semibold">반려견</th>
                  <th className="px-3 py-2 font-semibold">서비스</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const rid = r.id as string
                  const petId = r.pet_id as string
                  return (
                    <tr
                      key={rid}
                      className="border-b border-neutral-100 transition hover:bg-neutral-50"
                    >
                      <td className="px-3 py-3 text-neutral-700">
                        <Link
                          href={`/admin/records/${rid}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {formatDate(str(r, 'visit_date'))}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        {petId ? (
                          <Link
                            href={`/admin/pets/${petId}`}
                            className="font-medium text-neutral-900 underline-offset-4 hover:underline"
                          >
                            {petNameMap[petId] ?? '-'}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-3 text-neutral-500">
                        {str(r, 'service_type') ?? '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 상태 관리 */}
      <StatusAction
        table="guardians"
        recordId={id}
        record={guardian as Record<string, unknown>}
        entityLabel="보호자"
      />
    </div>
  )
}
