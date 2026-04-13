// =============================================================
// DAZUL OS — Staff profile types
//
// staff_profiles 테이블 기준
// Supabase에 테이블이 아직 없어도 타입 정의는 안전
// =============================================================

export type StaffProfile = {
  id: string
  user_id?: string | null
  name: string | null
  role: string | null
  is_active?: boolean | null
  created_at?: string | null
  updated_at?: string | null
}
