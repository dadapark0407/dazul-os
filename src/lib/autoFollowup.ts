// =============================================================
// DAZUL OS — 자동 팔로업 생성 엔진 (rule-based)
//
// 방문 기록 데이터를 분석하여 적절한 후속 관리 항목을 자동 생성합니다.
//
// TODO: AI 연동 시 규칙 엔진을 AI 판단으로 보완/교체
// TODO: settings 테이블 연동 시 규칙 커스터마이징 지원
// =============================================================

import { supabase } from '@/lib/supabase'

// ─── 입력 타입 ───

export type FollowupRuleInput = {
  visitRecordId: string
  petId?: string | null
  guardianId?: string | null
  visitDate?: string | null
  serviceType?: string | null
  skinStatus?: string | null
  coatStatus?: string | null
  conditionStatus?: string | null
  stressStatus?: string | null
  specialNotes?: string | null
  nextVisitRecommendation?: string | null
  careNotes?: string | null
}

// ─── 생성할 팔로업 정의 ───

export type FollowupCandidate = {
  type: string
  dueDays: number
  note: string
}

// ─── 설정 헬퍼 (localStorage 기반, 향후 DB 전환) ───

const STORAGE_KEY = 'dazul_auto_followup_enabled'

export function isAutoFollowupEnabled(): boolean {
  if (typeof window === 'undefined') return true // SSR 기본 활성
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === null) return true // 기본 활성
  return stored === 'true'
}

export function setAutoFollowupEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, String(enabled))
}

// ─── 규칙 엔진 ───

/**
 * 방문 기록 데이터를 분석하여 생성할 팔로업 목록을 반환
 *
 * 규칙:
 * 1. 기본 재방문: 모든 방문 → 4주 뒤
 * 2. 피부 이슈: 건조/민감/각질/붉음/알러지 키워드 → 2주 뒤 피부 체크
 * 3. 높은 스트레스/예민: → 1주 뒤 컨디션 체크
 * 4. 모질 문제: 엉킴/뭉침/손상 → 3주 뒤 모질 체크
 * 5. 다음 방문 추천이 있으면: 기본 재방문 대신 추천 내용 사용
 */
export function analyzeFollowups(input: FollowupRuleInput): FollowupCandidate[] {
  const candidates: FollowupCandidate[] = []
  const skin = (input.skinStatus ?? '').toLowerCase()
  const coat = (input.coatStatus ?? '').toLowerCase()
  const condition = (input.conditionStatus ?? '').toLowerCase()
  const stress = (input.stressStatus ?? '').toLowerCase()
  const special = (input.specialNotes ?? '').toLowerCase()
  const careNotes = (input.careNotes ?? '').toLowerCase()
  const service = (input.serviceType ?? '').toLowerCase()

  // ─── 1. 피부 이슈 팔로업 (우선 체크) ───
  const skinKeywords = ['건조', '민감', '각질', '붉음', '붉은', '알러지', '알레르기', '습진', '벗겨', '가려움', '염증']
  const hasSkinIssue = skinKeywords.some((k) => skin.includes(k) || special.includes(k) || careNotes.includes(k))

  if (hasSkinIssue) {
    candidates.push({
      type: '피부 체크',
      dueDays: 14,
      note: `피부 상태 재확인 필요 (${input.skinStatus ?? '피부 이슈 감지'})`,
    })
  }

  // ─── 2. 높은 스트레스 / 예민 컨디션 ───
  const highStress = stress.includes('높음') || stress.includes('매우')
  const sensitiveCondition = condition.includes('예민') || condition.includes('피곤')

  if (highStress || sensitiveCondition) {
    candidates.push({
      type: '컨디션 체크',
      dueDays: 7,
      note: highStress
        ? '이전 방문 시 스트레스가 높았습니다. 상태 확인이 필요합니다.'
        : '이전 방문 시 예민/피곤한 상태였습니다. 컨디션 재확인 필요합니다.',
    })
  }

  // ─── 3. 모질 문제 ───
  const coatKeywords = ['엉킴', '뭉침', '매트', '꼬임', '손상', '끊어', '갈라']
  const hasCoatIssue = coatKeywords.some((k) => coat.includes(k) || careNotes.includes(k))

  if (hasCoatIssue) {
    candidates.push({
      type: '모질 체크',
      dueDays: 21,
      note: `모질 상태 재확인 필요 (${input.coatStatus ?? '모질 이슈 감지'})`,
    })
  }

  // ─── 4. 기본 재방문 ───
  // 다음 방문 추천이 있으면 그 내용을 사용, 없으면 서비스 기반 기본값
  if (input.nextVisitRecommendation) {
    const days = extractDaysFromRecommendation(input.nextVisitRecommendation)
    candidates.push({
      type: '재방문',
      dueDays: days,
      note: input.nextVisitRecommendation,
    })
  } else {
    // 서비스 유형 기반 기본 주기
    const defaultDays = getDefaultRevisitDays(service)
    candidates.push({
      type: '재방문',
      dueDays: defaultDays,
      note: `정기 ${input.serviceType ?? '관리'} 재방문 안내`,
    })
  }

  return candidates
}

// ─── 메인: 자동 팔로업 생성 실행 ───

export type AutoFollowupResult = {
  created: number
  skipped: number
  errors: string[]
}

/**
 * 방문 기록에 대한 자동 팔로업을 생성합니다.
 *
 * - 중복 방지: 같은 visit_record_id + type 조합이 이미 존재하면 건너뜀
 * - 설정 확인: isAutoFollowupEnabled() === false이면 실행하지 않음
 * - followups 테이블이 없으면 조용히 실패
 */
export async function createAutoFollowups(
  input: FollowupRuleInput
): Promise<AutoFollowupResult> {
  const result: AutoFollowupResult = { created: 0, skipped: 0, errors: [] }

  // 설정 확인
  if (!isAutoFollowupEnabled()) {
    return result
  }

  // 규칙 분석
  const candidates = analyzeFollowups(input)
  if (candidates.length === 0) return result

  // 기존 팔로업 확인 (중복 방지)
  const { data: existing, error: checkError } = await supabase
    .from('followups')
    .select('type')
    .eq('related_record_id', input.visitRecordId)

  if (checkError) {
    // followups 테이블이 없을 수 있음 — 조용히 반환
    console.warn('auto-followup: followups 테이블 접근 실패:', checkError.message)
    result.errors.push(checkError.message)
    return result
  }

  const existingTypes = new Set((existing ?? []).map((e) => e.type))

  // 기준 날짜
  const baseDate = input.visitDate ? new Date(input.visitDate) : new Date()

  for (const candidate of candidates) {
    // 중복 체크
    if (existingTypes.has(candidate.type)) {
      result.skipped++
      continue
    }

    const dueDate = new Date(baseDate)
    dueDate.setDate(dueDate.getDate() + candidate.dueDays)

    const payload = {
      pet_id: input.petId || null,
      guardian_id: input.guardianId || null,
      related_record_id: input.visitRecordId,
      type: candidate.type,
      status: 'pending',
      due_date: dueDate.toISOString().slice(0, 10),
      note: candidate.note,
    }

    const { error: insertError } = await supabase.from('followups').insert(payload)

    if (insertError) {
      console.warn('auto-followup insert error:', insertError.message)
      result.errors.push(`${candidate.type}: ${insertError.message}`)
    } else {
      result.created++
    }
  }

  return result
}

// ─── 내부 헬퍼 ───

/**
 * "3주 뒤" "2주 후" "한 달" 등의 한국어 추천 텍스트에서 일수를 추출
 */
function extractDaysFromRecommendation(text: string): number {
  // "N주" 패턴
  const weekMatch = text.match(/(\d+)\s*주/)
  if (weekMatch) return parseInt(weekMatch[1], 10) * 7

  // "N일" 패턴
  const dayMatch = text.match(/(\d+)\s*일/)
  if (dayMatch) return parseInt(dayMatch[1], 10)

  // "한 달" / "1개월"
  if (text.includes('한 달') || text.includes('1개월') || text.includes('한달')) return 30

  // "2개월"
  const monthMatch = text.match(/(\d+)\s*개월/)
  if (monthMatch) return parseInt(monthMatch[1], 10) * 30

  // 기본: 4주
  return 28
}

/**
 * 서비스 유형에 따른 기본 재방문 주기 (일)
 */
function getDefaultRevisitDays(service: string): number {
  if (service.includes('미용')) return 28 // 4주
  if (service.includes('목욕')) return 21 // 3주
  if (service.includes('스파') || service.includes('팩')) return 28 // 4주
  if (service.includes('위생')) return 14 // 2주
  return 28 // 기본 4주
}
