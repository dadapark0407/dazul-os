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

  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FAFAF8' }} />}>
      <ReportClient
        guardianName={guardian.name}
        pets={(pets ?? []).map((p) => ({ id: p.id, name: p.name ?? '반려견', breed: p.breed }))}
        records={records}
      />
    </Suspense>
  )
}
