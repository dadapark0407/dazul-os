import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import ReportClient from './ReportClient'

type PageProps = { params: Promise<{ token: string }> }

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export default async function ReportPage({ params }: PageProps) {
  const { token } = await params
  if (!token) notFound()

  const supabase = getSupabase()

  // 보호자 조회
  const { data: guardian } = await supabase
    .from('guardians').select('id, name').eq('share_token', token).maybeSingle()
  if (!guardian) notFound()

  // 반려견 목록
  const { data: pets } = await supabase
    .from('pets').select('id, name, breed').eq('guardian_id', guardian.id).order('name')

  // 전체 방문 기록 (최신순)
  const { data: records } = await supabase
    .from('visit_records')
    .select('id, pet_id, pet_name, visit_date, weight, service, service_type, spa_level, skin_status, coat_status, condition_status, care_actions, next_care_guide, next_visit_date, next_visit_recommendation, comment')
    .eq('guardian_id', guardian.id)
    .order('visit_date', { ascending: false })

  if (!records || records.length === 0) notFound()

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
