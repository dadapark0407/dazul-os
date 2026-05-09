-- =============================================================
-- DAZUL OS — 예약 시스템 스키마
-- 실행: Supabase 대시보드 > SQL Editor에서 전체 복사 후 Run
-- =============================================================


-- ─── 1. staff 테이블 ───

CREATE TABLE IF NOT EXISTS staff (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID        REFERENCES branches(id) ON DELETE SET NULL,
  name             TEXT        NOT NULL,
  signature_color  TEXT        NOT NULL,
  display_order    INTEGER     NOT NULL,
  role             TEXT        DEFAULT 'groomer',
  is_active        BOOLEAN     DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─── 2. appointments 테이블 ───

CREATE TABLE IF NOT EXISTS appointments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    UUID        REFERENCES branches(id) ON DELETE SET NULL,
  pet_id       UUID        REFERENCES pets(id) ON DELETE SET NULL,
  guardian_id  UUID        REFERENCES guardians(id) ON DELETE SET NULL,
  staff_id     UUID        REFERENCES staff(id) ON DELETE SET NULL,
  start_at     TIMESTAMPTZ NOT NULL,
  duration_min INTEGER     NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'confirmed',
  note         TEXT,
  raw_input    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);


-- ─── 3. staff_off 테이블 ───

CREATE TABLE IF NOT EXISTS staff_off (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  UUID  REFERENCES branches(id) ON DELETE SET NULL,
  staff_id   UUID  REFERENCES staff(id) ON DELETE CASCADE,
  off_date   DATE  NOT NULL,
  off_type   TEXT  NOT NULL,
  start_time TIME,
  end_time   TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─── 4. 인덱스 ───

CREATE INDEX IF NOT EXISTS idx_appointments_date   ON appointments (start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_staff  ON appointments (staff_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_off_date      ON staff_off (off_date);
CREATE INDEX IF NOT EXISTS idx_staff_off_staff     ON staff_off (staff_id);


-- ─── 5. grooming_sessions.staff_id FK 연결 ───
-- 기존 staff_id 컬럼이 있고 아직 FK가 없는 경우에만 추가

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'grooming_sessions_staff_id_fkey'
  ) THEN
    ALTER TABLE grooming_sessions
    ADD CONSTRAINT grooming_sessions_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ─── 6. 미용사 5명 초기 데이터 ───
-- branches 테이블의 is_active = true 지점을 기준으로 삽입
-- 이미 같은 이름의 미용사가 있으면 SKIP

INSERT INTO staff (branch_id, name, signature_color, display_order, role)
SELECT
  b.id,
  s.name,
  s.color,
  s.sort_order,
  'groomer'
FROM branches b
CROSS JOIN (VALUES
  ('미용사A', '#534AB7', 1),
  ('미용사B', '#1D6A4E', 2),
  ('미용사C', '#1A5FA5', 3),
  ('미용사D', '#92560A', 4),
  ('미용사E', '#B23A3A', 5)
) AS s(name, color, sort_order)
WHERE b.is_active = true
ON CONFLICT DO NOTHING;


-- ─── 완료 ───
-- 실행 후 Supabase 대시보드 > Table Editor에서
-- staff / appointments / staff_off 테이블 생성 확인
