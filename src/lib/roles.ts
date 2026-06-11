// =============================================================
// DAZUL OS — Role definitions and helpers
// 역할 기반 접근 제어를 위한 기초 유틸리티
//
// 현재 상태: 인증 미적용 — 모든 함수가 허용 또는 기본값 반환
// Supabase Auth + staff_profiles 테이블 연동 시 실제 검증 로직 추가 예정
// =============================================================

/**
 * 직급 계층 (숫자가 클수록 높은 권한)
 *
 * owner         — 원장. 모든 기능 + 설정 + 스태프 관리 (전 매장)
 * director      — 부원장. 대부분 기능 + 일부 설정
 * lead_designer — 실장. 매장 운영 총괄
 * manager       — 팀장. 운영 기능 (기록, 제품, 팔로업 등)
 * designer      — 디자이너. 기본 기록 작성 + 조회
 * intern        — 인턴. 제한적 조회
 */
export const ROLES = {
  owner: 50,
  director: 40,
  lead_designer: 30,
  manager: 25,
  designer: 20,
  intern: 10,
} as const

export type Role = keyof typeof ROLES

/** 직급 한글명 매핑 */
export const ROLE_LABELS: Record<Role, string> = {
  owner: '원장',
  director: '부원장',
  lead_designer: '실장',
  manager: '팀장',
  designer: '디자이너',
  intern: '인턴',
} as const

/** 직급 키 목록 (권한 높은 순) — UI에서 순회할 때 사용 */
export const ROLE_KEYS = (Object.keys(ROLES) as Role[]).sort(
  (a, b) => ROLES[b] - ROLES[a]
)

/**
 * 주어진 직급이 최소 요구 직급 이상인지 확인
 *
 * @example
 * hasMinRole('manager', 'designer')   // true — manager(25) ≥ designer(20)
 * hasMinRole('intern', 'manager')     // false — intern(10) < manager(25)
 * hasMinRole(null, 'designer')        // false — 직급 없음
 */
export function hasMinRole(
  userRole: string | null | undefined,
  minRole: Role
): boolean {
  if (!userRole) return false
  const level = ROLES[userRole as Role]
  if (level === undefined) return false
  return level >= ROLES[minRole]
}

/**
 * 직급이 유효한 Role 타입인지 확인
 */
export function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && value in ROLES
}

// =============================================================
// 페이지별 최소 직급 매핑 (향후 미들웨어 또는 레이아웃에서 사용)
// =============================================================

/**
 * 관리 페이지별 최소 접근 직급
 *
 * TODO: Supabase Auth 연동 후 admin layout에서 이 맵으로 접근 제어 적용
 * TODO: 미들웨어(middleware.ts)에서 서버 사이드 검증 추가
 */
export const ADMIN_ROUTE_MIN_ROLE: Record<string, Role> = {
  '/admin': 'designer',
  '/admin/pets': 'designer',
  '/admin/guardians': 'designer',
  '/admin/records': 'designer',
  '/admin/products': 'manager',
  '/admin/followups': 'designer',
  '/admin/templates': 'manager',
  '/admin/staff': 'owner',
  '/admin/settings': 'director',
}

// =============================================================
// Staff profile 조회 헬퍼 (향후 사용)
// =============================================================

import { supabase } from '@/lib/supabase'

export type StaffProfile = {
  id: string
  user_id?: string | null
  name: string | null
  role: string | null
  is_active?: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

/**
 * user_id로 스태프 프로필 조회
 *
 * TODO: Supabase Auth 연동 후 현재 로그인 유저의 프로필을 가져오는 데 사용
 * 현재는 테이블이 없으면 null 반환
 */
export async function getStaffProfileByUserId(
  userId: string
): Promise<StaffProfile | null> {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null
  return data as StaffProfile
}

/**
 * 현재 로그인 유저의 직급 확인
 *
 * TODO: Supabase Auth 연동 시 구현
 * 현재는 항상 'owner' 반환 (개발 중 모든 접근 허용)
 */
export async function getCurrentUserRole(): Promise<Role> {
  // TODO: 실제 구현
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) throw new Error('Not authenticated')
  // const profile = await getStaffProfileByUserId(user.id)
  // if (!profile?.role || !isValidRole(profile.role)) throw new Error('No valid role')
  // return profile.role

  return 'owner' // 개발 중 기본값
}
