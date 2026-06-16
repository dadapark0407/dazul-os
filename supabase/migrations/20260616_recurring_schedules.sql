-- =============================================================
-- DAZUL OS — 반복(루틴) 예약 스케줄 테이블
-- 실행: Supabase 대시보드 > SQL Editor에서 전체 복사 후 Run
-- =============================================================
-- 고정 방문 고객의 방문 주기/요일/시간/케어 패턴을 저장.
-- 월별 "루틴 예약 생성"으로 appointments에 일괄 생성하는 데 사용.

CREATE TABLE IF NOT EXISTS recurring_schedules (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id             uuid        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  pet_id                uuid        NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  guardian_id           uuid        NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  frequency_weeks       integer     NOT NULL CHECK (frequency_weeks IN (1, 2, 3, 4, 5, 6)),
  preferred_day_of_week integer     NOT NULL CHECK (preferred_day_of_week BETWEEN 0 AND 6),
  preferred_time        time        NOT NULL,
  service_pattern       text[]      NOT NULL,
  current_pattern_index integer     NOT NULL DEFAULT 0,
  is_active             boolean     NOT NULL DEFAULT true,
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE recurring_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branch_isolation" ON recurring_schedules;
CREATE POLICY "branch_isolation" ON recurring_schedules
  FOR ALL USING (branch_id = '00000000-0000-0000-0000-000000000001');

CREATE INDEX IF NOT EXISTS idx_recurring_pet_id ON recurring_schedules(pet_id);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_schedules(is_active)
  WHERE is_active = true;
