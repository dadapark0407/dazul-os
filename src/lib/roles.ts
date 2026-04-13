// =============================================================
// DAZUL OS — Role definitions and helpers
// 역할 기반 접근 제어를 위한 기초 유틸리티
//
// 현재 상태: 인증 미적용 — 모든 함수가 허용 또는 기본값 반환
// Supabase Auth + staff_profiles 테이블 연동 시 실제 검증 로직 추가 예정
// =============================================================

/**
 * 역할 계층 (권한 높은 순)
 *
 * owner    — 대표 / 사업주. 모든 기능 접근 + 설정 변경 + 스태프 관리
 * director — 부원장 / 총괄. 대부분 기능 접근 + 일부 설정
 * manager  — 매니저. 운영 기능 접근 (기록, 제품, 팔로업 등)
 * staff    — 스태프. 기본 기록 작성 + 조회
 */
export const ROLES = ['owner', 'director', 'manager', 'staff'] as const
export type Role = (typeof ROLES)[number]

/** 역할 한글 라벨 */
export const ROLE_LABELS: Record<Role, string> = {
  owner: '대표',
  director: '부원장',
  manager: '매니저',
  staff: '스태프',
}

/** 역할 계층 레벨 (숫자가 클수록 높은 권한) */
const ROLE_LEVEL: Record<Role, number> = {
  owner: 40,
  director: 30,
  manager: 20,
  staff: 10,
}

/**
 * 주어진 역할이 최소 요구 역할 이상인지 확인
 *
 * @example
 * hasMinRole('manager', 'staff')   // true — manager ≥ staff
 * hasMinRole('staff', 'manager')   // false — staff < manager
 * hasMinRole(null, 'staff')        // false — 역할 없음
 */
export function hasMinRole(
  userRole: string | null | undefined,
  minRole: Role
): boolean {
  if (!userRole) return false
  const level = ROLE_LEVEL[userRole as Role]
  if (level === undefined) return false
  return level >= ROLE_LEVEL[minRole]
}

/**
 * 역할이 유효한 Role 타입인지 확인
 */
export function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.includes(value as Role)
}

// =============================================================
// 페이지별 최소 역할 매핑 (향후 미들웨어 또는 레이아웃에서 사용)
// =============================================================

/**
 * 관리 페이지별 최소 접근 역할
 *
 * TODO: Supabase Auth 연동 후 admin layout에서 이 맵으로 접근 제어 적용
 * TODO: 미들웨어(middleware.ts)에서 서버 사이드 검증 추가
 */
export const ADMIN_ROUTE_MIN_ROLE: Record<string, Role> = {
  '/admin': 'staff',
  '/admin/pets': 'staff',
  '/admin/guardians': 'staff',
  '/admin/records': 'staff',
  '/admin/products': 'manager',
  '/admin/followups': 'staff',
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
 * 현재 로그인 유저의 역할 확인
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
