import { Suspense, type ComponentProps } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import ReportClient from './ReportClient'

type PageProps = { params: Promise<{ token: string }> }

type ReportPayload = {
  guardian: { name: string | null }
  pets: { id: string; name: string | null; breed: string | null }[]
  records: ComponentProps<typeof ReportClient>['records']
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function EmptyReport() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <div className="mx-auto max-w-[480px] text-center" style={{ padding: '96px 24px' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.4em', fontWeight: 300, color: '#8A8A7A' }}>
          SALON DE DAZUL
        </p>
        <div style={{ width: 32, height: 1, background: '#C9A96E', margin: '16px auto' }} />
        <p style={{ fontSize: 12, fontStyle: 'italic', letterSpacing: '0.2em', color: '#8A8A7A' }}>
          Wellness Care Journal
        </p>
        <p style={{ fontSize: 14, fontWeight: 300, letterSpacing: '0.05em', color: '#1A1A1A', marginTop: 48 }}>
          아직 등록된 케어 기록이 없습니다
        </p>
      </div>
    </div>
  )
}

export default async function ReportPage({ params }: PageProps) {
  const { token } = await params
  if (!token) notFound()

  const supabase = getSupabase()

  // 토큰에 해당하는 보호자 1명 + 현재 반려견 + 그 반려견들의 케어 기록(pet_id 기준, 최신순).
  // anon 키로 테이블을 직접 읽지 않고 security definer RPC 로만 조회한다.
  const { data: report } = await supabase.rpc('get_report_by_token', { p_token: token })
  if (!report) notFound()

  const { guardian, pets, records } = report as ReportPayload

  if (!records || records.length === 0) return <EmptyReport />

  // 제품 매핑
  // care_actions 는 "이름 (브랜드), 이름2 (브랜드2)" 형식
  // 이름으로 고객 안내 문구(ai_summary) + 카테고리를 조회
  const [{ data: productRows }, { data: catRows }] = await Promise.all([
    supabase.from('products').select('name, ai_summary, category_id'),
    supabase.from('product_categories').select('id, name'),
  ])

  const categoryIdToName: Record<string, string> = {}
  for (const c of catRows ?? []) {
    if (c?.id && c?.name) categoryIdToName[String(c.id)] = String(c.name)
  }

  const productSummaryMap: Record<string, string> = {}
  const productCategoryMap: Record<string, string> = {}
  for (const p of productRows ?? []) {
    if (!p?.name) continue
    const name = String(p.name)
    if (p.ai_summary) productSummaryMap[name] = String(p.ai_summary)
    if (p.category_id && categoryIdToName[String(p.category_id)]) {
      productCategoryMap[name] = categoryIdToName[String(p.category_id)]
    }
  }

  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FAFAF8' }} />}>
      <ReportClient
        guardianName={guardian.name}
        pets={(pets ?? []).map((p) => ({ id: p.id, name: p.name ?? '반려견', breed: p.breed }))}
        records={records}
        productSummaryMap={productSummaryMap}
        productCategoryMap={productCategoryMap}
      />
    </Suspense>
  )
}
