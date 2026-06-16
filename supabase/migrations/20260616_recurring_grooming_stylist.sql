-- =============================================================
-- DAZUL OS — 루틴 예약: 미용 담당 선생님 컬럼 추가
-- 실행: Supabase 대시보드 > SQL Editor
-- =============================================================
-- 미용·가위컷·스포팅 회차에 한해 자동 생성 예약에 배정할 담당 미용사.

ALTER TABLE recurring_schedules
  ADD COLUMN IF NOT EXISTS grooming_stylist_id uuid REFERENCES staff(id) ON DELETE SET NULL;
