// =============================================================
// DAZUL OS — 예약 자연어 파서
// 정규식 기반. AI 호출 없음.
// =============================================================


// ─── 타입 정의 ───

export type ParsedAppointment = {
  time: string              // "HH:MM" 24시간 형식
  date: string | null       // YYYY-MM-DD — null = 현재 캘린더 날짜 사용
  petName: string
  breed: string | null
  service: string | null    // 서비스 키워드 (미용/목욕/스파 등)
  duration: number          // 분 단위
  staffName: string | null  // null = 미용사 미지정
  note: string | null
  raw: string               // 원본 입력
  isNewCustomer: boolean    // "신규" 키워드 감지 시 true
  unassigned: boolean       // "지정없음/미지정/미배정" 키워드 명시 여부
}

export type ParsedStaffOff = {
  staffName: string
  offType: 'lunch' | 'dayoff'
  startTime: string | null  // "HH:MM" — 점심일 때만 채워짐
}

export type ParseResult =
  | { type: 'appointment'; data: ParsedAppointment }
  | { type: 'staff_off'; data: ParsedStaffOff }
  | { type: 'error'; message: string }

/** 한 줄에 여러 예약이 들어올 수 있는 멀티 파싱 결과 */
export type ParseLineResult =
  | { type: 'appointments'; data: ParsedAppointment[] }
  | { type: 'staff_off'; data: ParsedStaffOff }
  | { type: 'error'; message: string }


// ─── 서비스 키워드 ───

const SERVICE_KEYWORDS = [
  // 단일 서비스
  '미용',
  '목욕',
  '스파',
  '위생',
  '위생미용',
  '부분미용',
  '전체미용',
  '클리핑',
  '가위컷',
  '스포팅',
  '얼굴컷',
  '얼컷',
  '부분얼컷',
  '발컷',
  '발바닥컷',
  // 복합 서비스 ('+'로 연결, 공백으로 구분된 입력도 매칭)
  '목욕+얼굴컷',
  '목욕+얼컷',
  '미용+목욕',
  '위생+목욕',
] as const

// "지정없음" 계열 — 미용사 미배정으로 강제
const UNASSIGNED_KEYWORDS = ['지정없음', '미지정', '미배정'] as const


// ─── 알려진 품종 (긴 단어 우선 매칭) ───

const KNOWN_BREEDS = [
  '프렌치불독',
  '웰시코기',
  '보더콜리',
  '사모예드',
  '래브라도',
  '페키니즈',
  '진돗개',
  '비숑',
  '푸들',
  '말티즈',
  '포메',
  '골든',
  '시츄',
  '요키',
  '슈나',
  '코카',
  '닥스',
  '허스키',
  '치와와',
  '불독',
  '시바',
] as const


// ─── 시간 파싱 ───
// "10시" / "오후 2시" / "3시반" / "2시 30분" / "14:30" 지원

function parseTime(
  input: string,
): { time: string; matched: string } | null {
  // 1) 24시간 콜론 형식: "14:30"
  const colon = input.match(/(\d{1,2}):(\d{2})/)
  if (colon) {
    const h = parseInt(colon[1], 10)
    const m = parseInt(colon[2], 10)
    if (h <= 23 && m <= 59) {
      return { time: pad2(h) + ':' + pad2(m), matched: colon[0] }
    }
  }

  // 2) 한국어: "오전/오후 N시 [반|M분]"
  // 주의: `시` 뒤에 `간`이 오면 시간 표기가 아닌 소요시간 표기 ("2시간")이므로 제외
  const ko = input.match(
    /(오전|오후)?\s*(\d{1,2})\s*시(?!간)(?:\s*(반|(\d{1,2})\s*분))?/,
  )
  if (ko) {
    const meridiem = ko[1]                      // "오전" | "오후" | undefined
    let h = parseInt(ko[2], 10)
    let m = 0

    if (ko[3] === '반') {
      m = 30
    } else if (ko[4]) {
      m = parseInt(ko[4], 10)
    }

    // 오전/오후 적용
    if (meridiem === '오후' && h < 12) {
      h += 12
    } else if (meridiem === '오전' && h === 12) {
      h = 0
    } else if (!meridiem) {
      // 추정: 1~8시는 오후 (13~20), 9~12시는 오전 유지
      if (h >= 1 && h <= 8) h += 12
    }

    if (h > 23 || m > 59) return null

    return { time: pad2(h) + ':' + pad2(m), matched: ko[0] }
  }

  return null
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}


// ─── 소요시간 파싱 ───
// "2시간" / "1.5시간" / "1시간 30분" / "1시간반" / "3h" / "30분"

function parseDuration(
  input: string,
): { duration: number; matched: string } | null {
  // "N시간 [반|M분]" / "N.M시간"
  const hourMin = input.match(
    /(\d+(?:\.\d+)?)\s*시간(?:\s*(반|(\d+)\s*분))?/,
  )
  if (hourMin) {
    const hours = parseFloat(hourMin[1])
    let extra = 0
    if (hourMin[2] === '반') extra = 30
    else if (hourMin[3]) extra = parseInt(hourMin[3], 10)
    return {
      duration: Math.round(hours * 60 + extra),
      matched: hourMin[0],
    }
  }

  // "Nh" / "N.5h"
  const hAbbr = input.match(/(\d+(?:\.\d+)?)\s*h\b/i)
  if (hAbbr) {
    return {
      duration: Math.round(parseFloat(hAbbr[1]) * 60),
      matched: hAbbr[0],
    }
  }

  // "N분" 단독
  const minOnly = input.match(/(\d+)\s*분/)
  if (minOnly) {
    return { duration: parseInt(minOnly[1], 10), matched: minOnly[0] }
  }

  return null
}


// ─── 메모 (괄호) 분리 ───

function extractNote(input: string): { note: string | null; rest: string } {
  // 반각 () 또는 전각 （）
  const m = input.match(/[(（]([^)）]*)[)）]/)
  if (!m) return { note: null, rest: input }
  return {
    note: m[1].trim(),
    rest: input.replace(m[0], ' ').trim(),
  }
}


// ─── 서비스별 기본 소요시간 ───

function defaultDuration(service: string | null): number {
  if (!service) return 120
  if (service.includes('미용')) return 180
  if (service.includes('목욕')) return 90
  return 120
}


// ─── 날짜 파싱 ───
// "내일" / "모레" / "5월 1일" / "5/1" / "10일" 지원

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function parseDate(input: string): { date: string | null; rest: string } {
  // 1) 내일
  const tomorrowRe = /(^|\s)내일(\s|$)/
  if (tomorrowRe.test(input)) {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return { date: ymd(d), rest: input.replace(tomorrowRe, ' ') }
  }

  // 2) 모레
  const dayAfterRe = /(^|\s)모레(\s|$)/
  if (dayAfterRe.test(input)) {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return { date: ymd(d), rest: input.replace(dayAfterRe, ' ') }
  }

  // 3) "5월 1일" / "5월1일"
  const ko = input.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/)
  if (ko) {
    const m = parseInt(ko[1], 10)
    const day = parseInt(ko[2], 10)
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      const year = new Date().getFullYear()
      return {
        date: `${year}-${pad2(m)}-${pad2(day)}`,
        rest: input.replace(ko[0], ' '),
      }
    }
  }

  // 4) "5/1" — 양쪽 토큰 경계 (소요시간 등 다른 숫자 토큰과 충돌 방지)
  const slash = input.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?=\s|$)/)
  if (slash) {
    const m = parseInt(slash[1], 10)
    const day = parseInt(slash[2], 10)
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      const year = new Date().getFullYear()
      return {
        date: `${year}-${pad2(m)}-${pad2(day)}`,
        rest: input.replace(slash[0], ' '),
      }
    }
  }

  // 5) "N일" — 이번 달 N일 (양쪽 경계 필수)
  const dayOnly = input.match(/(?:^|\s)(\d{1,2})\s*일(?=\s|$)/)
  if (dayOnly) {
    const day = parseInt(dayOnly[1], 10)
    if (day >= 1 && day <= 31) {
      const now = new Date()
      return {
        date: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(day)}`,
        rest: input.replace(dayOnly[0], ' '),
      }
    }
  }

  return { date: null, rest: input }
}


// ─── "신규" 플래그 ───

function extractIsNew(input: string): { isNew: boolean; rest: string } {
  const re = /(^|\s)신규(\s|$)/
  if (re.test(input)) {
    return { isNew: true, rest: input.replace(re, ' ') }
  }
  return { isNew: false, rest: input }
}


// ─── "지정없음" / "미지정" / "미배정" ───

function extractUnassigned(input: string): { unassigned: boolean; rest: string } {
  const sorted = [...UNASSIGNED_KEYWORDS].sort((a, b) => b.length - a.length)
  for (const kw of sorted) {
    const re = new RegExp(`(^|\\s)${escapeRegExp(kw)}(\\s|$)`)
    if (re.test(input)) {
      return { unassigned: true, rest: input.replace(re, ' ') }
    }
  }
  return { unassigned: false, rest: input }
}


// ─── 체중 / 나이 추출 → note 합침 ───
// "3키로", "3kg", "3.5키로", "3.5kg", "4살", "4세", "4개월"

// ─── 전화번호 추출 → note 합침 ───
// "010-1234-5678" / "010 1234 5678" / "010.1234.5678" / "01012345678"
// 반환 시 항상 "010-1234-5678" 형태로 정규화

function extractPhone(input: string): { phone: string | null; rest: string } {
  // (?<!\d) ... (?!\d): 더 긴 숫자열 안에 잡히지 않도록 양쪽 boundary
  const re = /(?<!\d)(01\d)[\s.-]?(\d{3,4})[\s.-]?(\d{4})(?!\d)/
  const m = input.match(re)
  if (!m) return { phone: null, rest: input }
  const formatted = `${m[1]}-${m[2]}-${m[3]}`
  return { phone: formatted, rest: input.replace(m[0], ' ') }
}


function extractWeightAge(
  input: string,
): { fragments: string[]; rest: string } {
  const fragments: string[] = []
  let rest = input

  // 체중
  const weight = rest.match(/(\d+(?:\.\d+)?)\s*(키로|kg)/i)
  if (weight) {
    fragments.push(`${weight[1]}${weight[2]}`)
    rest = rest.replace(weight[0], ' ')
  }

  // 나이
  const age = rest.match(/(\d+)\s*(개월|살|세)/)
  if (age) {
    fragments.push(`${age[1]}${age[2]}`)
    rest = rest.replace(age[0], ' ')
  }

  return { fragments, rest }
}


// ─── 서비스 키워드 매칭 ───
// 토큰 경계(공백/문자열 경계)를 검사 → '미용사A' 안의 '미용'은 매칭 안 됨

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractService(input: string): { service: string | null; rest: string } {
  // 긴 키워드 먼저 (복합 키워드 + 부분/전체 우선)
  const sorted = [...SERVICE_KEYWORDS].sort((a, b) => b.length - a.length)
  for (const kw of sorted) {
    const re = serviceRegex(kw)
    if (re.test(input)) {
      // 매칭된 부분(앞뒤 경계 포함)을 공백 한 칸으로 치환
      return { service: kw, rest: input.replace(re, ' ') }
    }
  }
  return { service: null, rest: input }
}

/**
 * 서비스 키워드 매칭용 regex 생성.
 * - 단일 키워드: 토큰 경계(공백/문자열 경계)로 둘러싸인 형태만 매칭
 * - 복합 키워드 ("a+b"): '+' 또는 공백으로 구분된 형태 모두 매칭
 *   예: '목욕+얼굴컷' → "목욕+얼굴컷" 또는 "목욕 얼굴컷" 모두 OK
 */
function serviceRegex(kw: string): RegExp {
  if (kw.includes('+')) {
    const parts = kw.split('+').map(escapeRegExp)
    const middle = '(?:\\+|\\s+)'
    return new RegExp(`(^|\\s)${parts.join(middle)}(\\s|$)`)
  }
  return new RegExp(`(^|\\s)${escapeRegExp(kw)}(\\s|$)`)
}


// ─── 미용사 매칭 (대소문자 무시) ───
//
// 우선순위:
//  1) 전체 이름 매칭 (예: "김수진")
//  2) 이름(성 제외) 매칭 (예: "수진" → "김수진")
//     단, 같은 이름을 가진 미용사가 2명 이상이면 동명이인 → 매칭 실패(미지정)
//
// 동명이인 등으로 매칭 실패한 경우에도 입력에서 토큰은 제거하여
// 반려견 이름으로 잘못 흡수되는 것을 방지한다.

type StaffMatch = {
  fullName: string | null  // 결정된 풀네임. ambiguous일 때 null.
  matched: string | null   // 입력에서 매칭된 부분 문자열. null = 매칭 없음.
  ambiguous: boolean       // 동명이인으로 풀네임을 결정 못한 경우
}

function findStaffMatch(input: string, staffList: string[]): StaffMatch {
  const names = staffList.filter(Boolean)

  // 1) 전체 이름 매칭 (긴 이름 우선)
  const sortedFull = [...names].sort((a, b) => b.length - a.length)
  for (const name of sortedFull) {
    const re = new RegExp(escapeRegExp(name), 'i')
    const m = input.match(re)
    if (m) {
      return { fullName: name, matched: m[0], ambiguous: false }
    }
  }

  // 2) 이름(성 제외) 매칭. 한글 성씨는 1자라고 가정 → name.slice(1)
  const givenMap = new Map<string, string[]>()
  for (const full of names) {
    if (full.length < 2) continue
    const given = full.slice(1)
    const list = givenMap.get(given) ?? []
    list.push(full)
    givenMap.set(given, list)
  }

  const sortedGivens = [...givenMap.keys()].sort((a, b) => b.length - a.length)
  for (const given of sortedGivens) {
    const re = new RegExp(escapeRegExp(given), 'i')
    const m = input.match(re)
    if (!m) continue
    const fulls = givenMap.get(given)!
    if (fulls.length === 1) {
      return { fullName: fulls[0], matched: m[0], ambiguous: false }
    }
    // 동명이인 → 매칭 실패. 토큰은 소비.
    return { fullName: null, matched: m[0], ambiguous: true }
  }

  return { fullName: null, matched: null, ambiguous: false }
}

function extractStaff(
  input: string,
  staffList: string[],
): { staffName: string | null; rest: string } {
  const match = findStaffMatch(input, staffList)
  if (!match.matched) {
    return { staffName: null, rest: input }
  }
  return {
    staffName: match.fullName,  // ambiguous면 null → 미지정 처리
    rest: input.replace(match.matched, ' '),
  }
}


// ─── 품종 매칭 ───

function extractBreed(input: string): { breed: string | null; rest: string } {
  for (const breed of KNOWN_BREEDS) {
    if (input.includes(breed)) {
      return { breed, rest: input.replace(breed, ' ') }
    }
  }
  return { breed: null, rest: input }
}


// ─── 점심 / 휴무 감지 ───

function tryStaffOff(
  input: string,
  staffList: string[],
): ParsedStaffOff | null {
  // 풀네임 또는 이름(성 제외)으로 매칭. 동명이인이면 fullName=null → 점심/휴무로 처리할 수 없음.
  const match = findStaffMatch(input, staffList)
  if (!match.fullName || !match.matched) return null
  const staffName = match.fullName

  // 휴무가 점심보다 우선
  if (/휴무/.test(input)) {
    return { staffName, offType: 'dayoff', startTime: null }
  }

  if (/점심/.test(input)) {
    // 점심 시작 시간 추출 (이름·키워드 제거 후 시간 파싱)
    const cleaned = input
      .replace(match.matched, ' ')
      .replace(/점심/g, ' ')
    const t = parseTime(cleaned)
    return {
      staffName,
      offType: 'lunch',
      startTime: t ? t.time : null,
    }
  }

  return null
}


// ─── 멀티 파싱 헬퍼 ───

/** 단일 토큰이 미지정 키워드인지(정확 일치). */
function isUnassignedKeyword(token: string): boolean {
  return (UNASSIGNED_KEYWORDS as readonly string[]).includes(token)
}

/**
 * 단일 토큰이 미용사 이름(풀네임 또는 성 제외)인지 검사.
 * - isStaff=true, name=<full>: 결정됨
 * - isStaff=true, name=null: 동명이인 등 모호 (토큰만 소비, 미지정 fallback)
 * - isStaff=false: 미용사 아님
 */
function matchStaffToken(
  token: string,
  staffList: string[],
): { isStaff: boolean; name: string | null } {
  const names = staffList.filter(Boolean)
  const lowerToken = token.toLowerCase()

  // 풀네임 정확 일치
  const exactFull = names.find((s) => s.toLowerCase() === lowerToken)
  if (exactFull) return { isStaff: true, name: exactFull }

  // 성 제외 (한국 성씨 1자 가정)
  const candidates = names.filter(
    (s) => s.length >= 2 && s.slice(1).toLowerCase() === lowerToken,
  )
  if (candidates.length === 1) return { isStaff: true, name: candidates[0] }
  if (candidates.length >= 2) return { isStaff: true, name: null }

  return { isStaff: false, name: null }
}

type SplitGroup = {
  pet: string[]
  service: string | null
  staff: string | null
  unassigned: boolean
}

/**
 * 남은 토큰 배열을 그룹별로 분리.
 *
 * 토큰 종류:
 *  - service: pendingService로 보관
 *  - 미지정 키워드: 현재 그룹의 unassigned=true 후 그룹 종료. 그룹 시작 전이면 preGroup.
 *  - staff 토큰: 현재 그룹의 staff 지정 후 그룹 종료. 그룹 시작 전이면 preGroup.
 *  - 그 외: 펫/품종 토큰으로 누적.
 *
 * preGroup(전체에 적용되는 staff/unassigned)은 자체 modifier가 없는 그룹에만 적용.
 */
function splitGroups(
  rest: string,
  staffList: string[],
): SplitGroup[] {
  const tokens = rest.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const groups: SplitGroup[] = []
  let currentPet: string[] = []
  let pendingService: string | null = null
  let preGroupStaff: string | null = null
  let preGroupUnassigned = false

  function finalize(staff: string | null, unassigned: boolean) {
    if (currentPet.length > 0 || pendingService) {
      groups.push({
        pet: currentPet,
        service: pendingService,
        staff,
        unassigned,
      })
    }
    currentPet = []
    pendingService = null
  }

  for (let i = 0; i < tokens.length; i++) {
    // 1) service 우선 매칭 (2-token 복합 포함)
    const serviceMatch = tryMatchServiceAtToken(tokens, i)
    if (serviceMatch) {
      if (pendingService) {
        // 연속 service (드문 케이스) — 빈 펫 그룹으로 먼저 종료
        finalize(null, false)
      }
      pendingService = serviceMatch.service
      i += serviceMatch.length - 1
      continue
    }

    const token = tokens[i]

    // 2) 미지정
    if (isUnassignedKeyword(token)) {
      if (currentPet.length === 0 && !pendingService) {
        // 그룹 시작 전 → preGroup
        preGroupUnassigned = true
      } else {
        finalize(null, true)
      }
      continue
    }

    // 3) 미용사
    const sm = matchStaffToken(token, staffList)
    if (sm.isStaff) {
      if (currentPet.length === 0 && !pendingService) {
        // 그룹 시작 전 → preGroup (단, preGroupUnassigned가 이미 true면 무시)
        if (sm.name && !preGroupUnassigned) {
          preGroupStaff = sm.name
        }
        // ambiguous면 토큰만 소비
      } else {
        // ambiguous 미용사면 staff=null (autoAssign 후보)로 그룹 종료
        finalize(sm.name, false)
      }
      continue
    }

    // 4) 펫/품종 토큰
    currentPet.push(token)
  }

  // 마지막 잔여 (service 또는 staff 종료 없이 끝난 경우)
  if (currentPet.length > 0 || pendingService) {
    finalize(null, false)
  }

  // preGroup 적용 — 자체 modifier 없는 그룹에만
  if (preGroupUnassigned || preGroupStaff) {
    for (const g of groups) {
      if (g.staff || g.unassigned) continue
      if (preGroupUnassigned) g.unassigned = true
      else if (preGroupStaff) g.staff = preGroupStaff
    }
  }

  return groups
}

/**
 * 위치 i의 토큰이 서비스 키워드인지 검사.
 * 2-token 복합 서비스("목욕 얼굴컷")가 SERVICE_KEYWORDS에 존재하면 우선.
 */
function tryMatchServiceAtToken(
  tokens: string[],
  i: number,
): { service: string; length: number } | null {
  if (i + 1 < tokens.length) {
    const combo = `${tokens[i]}+${tokens[i + 1]}`
    if ((SERVICE_KEYWORDS as readonly string[]).includes(combo)) {
      return { service: combo, length: 2 }
    }
  }
  if ((SERVICE_KEYWORDS as readonly string[]).includes(tokens[i])) {
    return { service: tokens[i], length: 1 }
  }
  return null
}

/** 펫 토큰 배열에서 품종 분리 (exact token match). */
function extractBreedFromTokens(
  tokens: string[],
): { petName: string; breed: string | null } {
  for (const breed of KNOWN_BREEDS) {
    const idx = tokens.indexOf(breed)
    if (idx >= 0) {
      const remaining = [...tokens.slice(0, idx), ...tokens.slice(idx + 1)]
      return { petName: remaining.join(' ').trim(), breed }
    }
  }
  return { petName: tokens.join(' ').trim(), breed: null }
}


// ─── 메인 파서 (멀티) ───

/**
 * 한 줄에 여러 예약을 파싱.
 * - 시간/날짜/미용사/메모/소요시간/신규/지정없음은 전역(공통)
 * - 펫이름·품종·서비스는 그룹 단위로 분리되어 예약마다 다름
 * - 단일 예약 입력은 길이 1짜리 배열로 반환
 */
export function parseBookingLine(
  input: string,
  staffList: string[],
): ParseLineResult {
  const trimmed = (input ?? '').trim()
  if (!trimmed) {
    return { type: 'error', message: '입력값이 비어있습니다' }
  }

  // 1) 점심/휴무 우선
  const off = tryStaffOff(trimmed, staffList)
  if (off) return { type: 'staff_off', data: off }

  // 2) 괄호 메모
  const { note: parenNote, rest: afterNote } = extractNote(trimmed)
  let rest = afterNote

  // 3) 날짜
  const dateRes = parseDate(rest)
  rest = dateRes.rest

  // 4) 시간 (첫 번째만, 전역 적용)
  const timeRes = parseTime(rest)
  if (!timeRes) {
    return {
      type: 'error',
      message:
        '시간을 인식하지 못했습니다 (예: "10시", "오후 2시", "3시반", "14:30")',
    }
  }
  rest = rest.replace(timeRes.matched, ' ')

  // 5) 소요시간 (전역; 명시되지 않으면 그룹별 service 기본값)
  const durRes = parseDuration(rest)
  if (durRes) rest = rest.replace(durRes.matched, ' ')

  // 6) "신규" (전역)
  const newRes = extractIsNew(rest)
  rest = newRes.rest

  // 7) 체중·나이·전화번호 (전역 메모로 합침)
  //    staff/unassigned는 그룹별 처리로 이동 — 여기선 추출하지 않음.
  const waRes = extractWeightAge(rest)
  rest = waRes.rest
  const phoneRes = extractPhone(rest)
  rest = phoneRes.rest

  const noteParts: string[] = []
  if (waRes.fragments.length > 0) noteParts.push(waRes.fragments.join(' '))
  if (phoneRes.phone) noteParts.push(phoneRes.phone)
  if (parenNote) noteParts.push(parenNote)
  const note = noteParts.length ? noteParts.join(' | ') : null

  // 8) 남은 텍스트를 pet+service+staff/unassigned 그룹으로 분리
  const groups = splitGroups(rest, staffList)

  // 그룹이 없고 신규 플래그도 없으면 에러
  if (groups.length === 0) {
    if (newRes.isNew) {
      groups.push({
        pet: [],
        service: null,
        staff: null,
        unassigned: false,
      })
    } else {
      return { type: 'error', message: '반려견 이름을 찾지 못했습니다' }
    }
  }

  // 각 그룹을 ParsedAppointment로 변환
  const appointments: ParsedAppointment[] = []
  for (const g of groups) {
    const { petName, breed } = extractBreedFromTokens(g.pet)
    let resolvedPetName = petName
    if (!resolvedPetName) {
      if (newRes.isNew) {
        resolvedPetName = '신규'
      } else {
        // 펫 이름이 없는 그룹은 건너뜀 (서비스만 단독)
        continue
      }
    }
    appointments.push({
      time: timeRes.time,
      date: dateRes.date,
      petName: resolvedPetName,
      breed,
      service: g.service,
      duration: durRes ? durRes.duration : defaultDuration(g.service),
      staffName: g.unassigned ? null : g.staff,
      note,
      raw: input,
      isNewCustomer: newRes.isNew,
      unassigned: g.unassigned,
    })
  }

  if (appointments.length === 0) {
    return { type: 'error', message: '반려견 이름을 찾지 못했습니다' }
  }

  return { type: 'appointments', data: appointments }
}


// ─── 메인 파서 (단일 — backward compat) ───

/**
 * 기존 API 호환. 내부적으로 parseBookingLine을 호출하고 첫 그룹만 반환.
 * 단일 펫 입력은 그룹이 1개라서 결과가 동일하다.
 */
export function parseBookingInput(
  input: string,
  staffList: string[],
): ParseResult {
  const r = parseBookingLine(input, staffList)
  if (r.type === 'error') return r
  if (r.type === 'staff_off') return r
  // appointments → 첫 번째만
  return { type: 'appointment', data: r.data[0] }
}
