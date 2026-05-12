-- =============================================================
-- DAZUL OS — 고정(정기) 예약 테이블
-- =============================================================
-- 매주 같은 요일에 오는 고정 고객 목록.
-- 예약 자동 생성은 하지 않고, 사이드 패널에서 참고용으로만 사용.

CREATE TABLE IF NOT EXISTS recurring_appointments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id      UUID        REFERENCES pets(id) ON DELETE SET NULL,
  pet_name    TEXT        NOT NULL,
  pet_breed   TEXT,
  weekday     SMALLINT    NOT NULL CHECK (weekday >= 0 AND weekday <= 6), -- 0=일 ~ 6=토
  staff_id    UUID        REFERENCES staff(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_appointments_weekday
  ON recurring_appointments (weekday);

CREATE INDEX IF NOT EXISTS idx_recurring_appointments_staff
  ON recurring_appointments (staff_id);


-- RLS — 인증 사용자 전체 권한 (기존 admin_tables 패턴과 동일)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'recurring_appointments'
  ) THEN
    EXECUTE 'ALTER TABLE recurring_appointments ENABLE ROW LEVEL SECURITY';
    DROP POLICY IF EXISTS "auth_all_recurring_appointments" ON recurring_appointments;
    CREATE POLICY "auth_all_recurring_appointments"
      ON recurring_appointments
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
