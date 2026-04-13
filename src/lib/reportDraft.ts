// =============================================================
// DAZUL OS — 리포트 초안 생성기 (rule-based)
//
// 방문 기록 데이터를 기반으로 보호자 공유용 리포트 초안을 생성합니다.
// DAZUL 브랜드 톤: 차분하고, 프리미엄하며, 따뜻한 케어 느낌.
//
// TODO: AI API 연동 시 이 함수를 래퍼로 유지하고 내부 로직을 AI 호출로 교체
// TODO: message_templates 테이블 연동 시 인사말/맺음말 커스터마이징
// =============================================================

export type ReportDraftInput = {
  petName?: string | null
  guardianName?: string | null
  breed?: string | null
  visitDate?: string | null
  serviceType?: string | null

  // 건강 상태
  skinStatus?: string | null
  coatStatus?: string | null
  conditionStatus?: string | null
  stressStatus?: string | null

  // 케어 기록
  careSummary?: string | null
  careActions?: string | null
  careNotes?: string | null
  nextCareGuide?: string | null

  // 추가
  specialNotes?: string | null
  nextVisitRecommendation?: string | null
  note?: string | null
}

export type ReportDraftResult = {
  /** 전체 리포트 텍스트 */
  fullText: string
  /** 섹션별 분리 (향후 템플릿 편집에 활용) */
  sections: {
    greeting: string
    groomingSummary: string
    conditionReport: string
    behaviorNotes: string
    homecareGuide: string
    nextVisit: string
    closing: string
  }
}

function formatKoreanDate(value?: string | null): string {
  if (!value) return '오늘'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '오늘'
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}월 ${day}일`
}

/**
 * 방문 기록 데이터로 리포트 초안 생성
 *
 * 규칙 기반 — AI 없이 자연스러운 한국어 리포트를 구성합니다.
 * 빈 필드는 자동으로 건너뛰고, 있는 데이터만으로 문장을 구성합니다.
 */
export function generateReportDraft(input: ReportDraftInput): ReportDraftResult {
  const pet = input.petName || '아이'
  const guardian = input.guardianName ? `${input.guardianName} 보호자님` : '보호자님'
  const dateStr = formatKoreanDate(input.visitDate)
  const service = input.serviceType || '관리'

  // ─── 인사말 ───
  const greeting = `안녕하세요, ${guardian}. 다줄입니다.\n${dateStr} ${pet}의 ${service} 방문 리포트를 전달드립니다.`

  // ─── 그루밍 요약 ───
  const groomingParts: string[] = []

  if (input.careSummary) {
    groomingParts.push(`오늘 ${pet}는 ${input.careSummary} 관리를 받았습니다.`)
  } else if (input.serviceType) {
    groomingParts.push(`오늘 ${pet}는 ${input.serviceType} 서비스를 받았습니다.`)
  }

  if (input.careActions) {
    groomingParts.push(`진행 내용: ${input.careActions}`)
  }

  if (input.careNotes) {
    groomingParts.push(`특이 조치: ${input.careNotes}`)
  }

  const groomingSummary = groomingParts.length > 0
    ? groomingParts.join('\n')
    : `오늘 ${pet}의 ${service}이 잘 마무리되었습니다.`

  // ─── 피부/모질 상태 ───
  const conditionParts: string[] = []

  if (input.skinStatus) {
    conditionParts.push(`피부: ${input.skinStatus}`)
  }
  if (input.coatStatus) {
    conditionParts.push(`모질: ${input.coatStatus}`)
  }
  if (input.conditionStatus) {
    conditionParts.push(`오늘 컨디션: ${input.conditionStatus}`)
  }

  let conditionReport = ''
  if (conditionParts.length > 0) {
    conditionReport = `[건강 상태]\n${conditionParts.join('\n')}`
  }

  // ─── 행동/스트레스 노트 ───
  const behaviorParts: string[] = []

  if (input.stressStatus) {
    const stressNote = buildStressNote(pet, input.stressStatus)
    if (stressNote) behaviorParts.push(stressNote)
  }
  if (input.specialNotes) {
    behaviorParts.push(`참고사항: ${input.specialNotes}`)
  }

  const behaviorNotes = behaviorParts.length > 0
    ? `[행동 관찰]\n${behaviorParts.join('\n')}`
    : ''

  // ─── 홈케어 가이드 ───
  const homecareParts: string[] = []

  if (input.nextCareGuide) {
    homecareParts.push(input.nextCareGuide)
  }

  // 피부 상태 기반 자동 추천
  if (input.skinStatus && hasDrySkinKeyword(input.skinStatus)) {
    homecareParts.push('집에서 보습 관리를 꾸준히 해주시면 피부 상태 개선에 도움이 됩니다.')
  }

  if (input.coatStatus && hasTangledCoatKeyword(input.coatStatus)) {
    homecareParts.push('빗질을 자주 해주시면 모질 관리에 좋습니다. 부드러운 슬리커 브러시를 추천드립니다.')
  }

  const homecareGuide = homecareParts.length > 0
    ? `[홈케어 안내]\n${homecareParts.join('\n')}`
    : ''

  // ─── 다음 방문 ───
  let nextVisit = ''
  if (input.nextVisitRecommendation) {
    nextVisit = `[다음 방문]\n${input.nextVisitRecommendation}`
  }

  // ─── 맺음말 ───
  const closing = `${pet}가 오늘도 건강하고 예쁘게 관리받았습니다.\n궁금한 점이 있으시면 언제든 편하게 연락 주세요.\n감사합니다. 다줄 드림 🐾`

  // ─── 전체 텍스트 조립 ───
  const allSections = [
    greeting,
    '',
    groomingSummary,
    conditionReport,
    behaviorNotes,
    homecareGuide,
    nextVisit,
    '',
    closing,
  ].filter((s) => s !== '')

  const fullText = allSections.join('\n\n')

  return {
    fullText,
    sections: {
      greeting,
      groomingSummary,
      conditionReport,
      behaviorNotes,
      homecareGuide,
      nextVisit,
      closing,
    },
  }
}

// ─── 내부 헬퍼 ───

function buildStressNote(pet: string, stress: string): string {
  const lower = stress.toLowerCase()
  if (lower.includes('낮음') || lower.includes('안정')) {
    return `${pet}는 오늘 매우 안정적인 모습을 보여주었습니다.`
  }
  if (lower.includes('보통')) {
    return `${pet}는 전반적으로 안정적이었으며, 특별한 불편함 없이 관리를 받았습니다.`
  }
  if (lower.includes('높음')) {
    return `${pet}가 오늘 다소 긴장한 모습을 보였지만, 안전하게 관리를 마쳤습니다. 집에서 충분히 휴식해 주세요.`
  }
  if (lower.includes('초반 긴장') || lower.includes('긴장 후 안정')) {
    return `${pet}가 초반에는 다소 긴장했지만, 관리가 진행되면서 점차 안정되었습니다.`
  }
  return `스트레스 수준: ${stress}`
}

function hasDrySkinKeyword(skinStatus: string): boolean {
  const keywords = ['건조', '각질', '거칠', '당김', '벗겨']
  return keywords.some((k) => skinStatus.includes(k))
}

function hasTangledCoatKeyword(coatStatus: string): boolean {
  const keywords = ['엉킴', '뭉침', '매트', '꼬임']
  return keywords.some((k) => coatStatus.includes(k))
}
