// =============================================================
// DAZUL OS — 지점(branch) 헬퍼
//
// 현재는 단일 지점 운영이므로 환경변수 또는 DB에서 기본 지점 ID를 가져옵니다.
// 다중 지점 전환 시 이 파일만 수정하면 됩니다.
//
// TODO: 다중 지점 지원 시 사용자 세션에서 현재 지점을 읽도록 변경
// TODO: branch 선택 UI 추가 시 context provider로 전환
// =============================================================

import { supabase } from '@/lib/supabase'

let cachedBranchId: string | null = null

/**
 * 기본 지점 ID를 반환합니다.
 *
 * 우선순위:
 * 1. NEXT_PUBLIC_DEFAULT_BRANCH_ID 환경변수
 * 2. branches 테이블의 첫 번째 활성 레코드
 * 3. null (지점 테이블이 없거나 비어 있는 경우)
 */
export async function getDefaultBranchId(): Promise<string | null> {
  // 환경변수에 명시되어 있으면 즉시 반환
  const envBranch = process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID
  if (envBranch) return envBranch

  // 캐시 히트
  if (cachedBranchId) return cachedBranchId

  // DB에서 첫 번째 활성 지점 조회
  try {
    const { data } = await supabase
      .from('branches')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (data?.id) {
      cachedBranchId = data.id
      return cachedBranchId
    }
  } catch {
    // branches 테이블이 없을 수 있음 — 무시
  }

  return null
}
