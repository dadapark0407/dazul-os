import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { buildSiteUrl } from '@/lib/siteUrl'
import StatusAction from '@/components/admin/StatusAction'
import CopyTextButton from '@/components/CopyTextButton'
import GuardianPetTabs from '@/components/admin/GuardianPetTabs'
import DeleteEntityButton from '@/components/admin/DeleteEntityButton'

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

  // 반려견 ID 목록으로 방문 기록 전체 조회 (케어 히스토리 테이블용)
  const petIds = pets.map((p) => p.id as string).filter(Boolean)
  let records: Array<Record<string, unknown>> = []

  if (petIds.length > 0) {
    const { data: recordsData } = await supabase
      .from('visit_records')
      .select('*')
      .in('pet_id', petIds)
      .order('visit_date', { ascending: false })

    records = recordsData ?? []
  }

  // 제품 카테고리 매핑 (케어 히스토리 테이블에서 제품 분류용)
  const [{ data: productRows }, { data: catRows }] = await Promise.all([
    supabase.from('products').select('name, category_id'),
    supabase.from('product_categories').select('id, name'),
  ])
  const categoryIdToName: Record<string, string> = {}
  for (const c of catRows ?? []) {
    if (c?.id && c?.name) categoryIdToName[String(c.id)] = String(c.name)
  }
  const productCategoryMap: Record<string, string> = {}
  for (const p of productRows ?? []) {
    if (p?.name && p?.category_id && categoryIdToName[String(p.category_id)]) {
      productCategoryMap[String(p.name)] = categoryIdToName[String(p.category_id)]
    }
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
          <DeleteEntityButton
            table="guardians"
            recordId={id}
            title="보호자 삭제"
            warningText="이 보호자를 삭제하면 연결된 모든 반려견 정보도 함께 삭제됩니다. 계속하시겠습니까?"
            redirectPath="/admin/guardians"
          />
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

        {/* 보호자 공유 링크 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            보호자 공유 링크
          </h2>
          {guardian.share_token ? (
            <>
              <p className="break-all rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                {buildSiteUrl(`/report/${guardian.share_token}`)}
              </p>
              <div className="mt-3">
                <CopyTextButton text={buildSiteUrl(`/report/${guardian.share_token}`)} />
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                이 링크를 보호자에게 공유하면 모든 방문 기록을 볼 수 있습니다.
              </p>
            </>
          ) : (
            <p className="py-2 text-sm text-neutral-400">
              공유 토큰이 없습니다. 보호자 정보를 저장하면 자동 생성됩니다.
            </p>
          )}
        </section>

      </div>

      {/* 반려견 케어 히스토리 (탭) */}
      <GuardianPetTabs
        pets={pets}
        records={records}
        productCategoryMap={productCategoryMap}
        guardianId={id}
        branchId={typeof guardian.branch_id === 'string' ? guardian.branch_id : null}
      />

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
