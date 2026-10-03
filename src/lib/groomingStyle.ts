import { supabase } from '@/lib/supabase'

export type GroomingStyle = { face: string; body: string; legs: string; tail: string; sanitary: string }

export const EMPTY_GROOMING_STYLE: GroomingStyle = { face: '', body: '', legs: '', tail: '', sanitary: '' }

function toGroomingStyle(raw: unknown): GroomingStyle | null {
  if (!raw || typeof raw !== 'object') return null
  const gs = raw as Record<string, unknown>
  const s = (v: unknown) => (typeof v === 'string' ? v : '')
  const filled = { face: s(gs.face), body: s(gs.body), legs: s(gs.legs), tail: s(gs.tail), sanitary: s(gs.sanitary) }
  return Object.values(filled).some((v) => v.trim()) ? filled : null
}

/**
 * 반려견의 이전 미용 스타일 (삭제된 기록 제외).
 *   1순위: 스타일이 입력된 가장 최근 "전체미용" 기록 — 미용→목욕→미용이면 목욕을 건너뛰고 미용 기록 사용
 *   2순위: 미용 기록에 스타일이 없을 때만, 스타일이 입력된 가장 최근 목욕 등 다른 서비스 기록
 */
export async function fetchLatestGroomingStyle(petId: string): Promise<GroomingStyle | null> {
  const { data } = await supabase
    .from('visit_records')
    .select('grooming_style, service')
    .eq('pet_id', petId)
    .is('deleted_at', null)
    .not('grooming_style', 'is', null)
    .order('visit_date', { ascending: false })
    .limit(100)
  let fallback: GroomingStyle | null = null
  for (const row of data ?? []) {
    const gs = toGroomingStyle(row.grooming_style)
    if (!gs) continue
    if (row.service === '전체미용') return gs
    fallback ??= gs
  }
  return fallback
}
