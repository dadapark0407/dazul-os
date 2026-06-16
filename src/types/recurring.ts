// =============================================================
// DAZUL OS — 반복(루틴) 예약 스케줄 타입
// =============================================================

export type RecurringSchedule = {
  id: string
  branch_id: string
  pet_id: string
  guardian_id: string
  frequency_weeks: 1 | 2 | 3 | 4 | 5 | 6
  /** 0=일 ~ 6=토 (getDay 기준) */
  preferred_day_of_week: number
  /** "HH:MM:SS" (Postgres time) */
  preferred_time: string
  service_pattern: string[]
  current_pattern_index: number
  is_active: boolean
  /** 미용·가위컷·스포팅 회차에 배정할 담당 미용사 (staff.id). null = 지정 없음 */
  grooming_stylist_id: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
}
