import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import StatusAction from '@/components/admin/StatusAction'

// TODO: 역할 기반 인증 추가 필요

type PageProps = {
  params: Promise<{ id: string }>
}

function str(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null
  const v = obj[key]
  return typeof v === 'string' ? v : null
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-100 py-3 last:border-b-0">
      <span className="shrink-0 text-sm font-medium text-neutral-500">{label}</span>
      <span className="text-right text-sm text-neutral-900">{value || '-'}</span>
    </div>
  )
}

/** is_active / active / archived_at 중 어떤 패턴이든 안전하게 판정 */
function resolveActiveState(record: Record<string, unknown>): boolean {
  if ('is_active' in record) return record.is_active !== false
  if ('active' in record) return record.active !== false
  if ('archived_at' in record) return record.archived_at == null
  return true
}

export default async function AdminProductDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !product) {
    notFound()
  }

  const isActive = resolveActiveState(product)

  // 카테고리명 해석: category_id → old category → 미분류
  let categoryDisplay = '미분류'
  const catId = str(product, 'category_id')
  if (catId) {
    const { data: cat } = await supabase
      .from('product_categories')
      .select('name')
      .eq('id', catId)
      .maybeSingle()
    if (cat?.name) {
      categoryDisplay = cat.name
    }
  }
  // category_id 조회가 결과 없으면 기존 category enum 사용
  if (categoryDisplay === '미분류') {
    const oldCategory = str(product, 'category')
    if (oldCategory) categoryDisplay = oldCategory
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <Link
              href="/admin/products"
              className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
            >
              ← 제품 목록
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900">
              {str(product, 'product_name') ?? '제품명 없음'}
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
            href={`/admin/products/${id}/edit`}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
          >
            수정하기
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            기본 정보
          </h2>
          <InfoRow label="제품명" value={str(product, 'product_name')} />
          <InfoRow label="브랜드" value={str(product, 'brand')} />
          <InfoRow label="카테고리" value={categoryDisplay} />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            상세 정보
          </h2>
          <InfoRow label="대상 피부 타입" value={str(product, 'target_skin_type')} />
          <InfoRow label="대상 모질 타입" value={str(product, 'target_coat_type')} />
          <InfoRow label="설명" value={str(product, 'description')} />
          <InfoRow label="AI 요약" value={str(product, 'ai_summary')} />
        </section>
      </div>

      {/* 상태 관리 */}
      <StatusAction
        table="products"
        recordId={id}
        record={product as Record<string, unknown>}
        entityLabel="제품"
      />
    </div>
  )
}
