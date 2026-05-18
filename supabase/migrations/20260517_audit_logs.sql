-- =============================================================
-- DAZUL OS — 예약 변경 이력
-- =============================================================
-- appointments 테이블에 대한 모든 쓰기 작업(생성/수정/취소/삭제)을
-- 누가 언제 어떤 내용으로 처리했는지 기록한다.
-- staff_actor_name 스냅샷을 함께 저장해 staff 삭제 후에도 표시 가능.
-- =============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action          text NOT NULL CHECK (action IN ('created', 'updated', 'cancelled', 'deleted')),
  appointment_id  uuid NULL,  -- 삭제된 예약도 추적 가능하도록 FK 없이 저장
  staff_actor_id  uuid NULL REFERENCES staff(id) ON DELETE SET NULL,
  staff_actor_name text NOT NULL,
  description     text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 최신순 조회용 인덱스
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON audit_logs (created_at DESC);

-- 예약별 이력 추적용
CREATE INDEX IF NOT EXISTS audit_logs_appointment_idx
  ON audit_logs (appointment_id);

-- description 키워드 검색용 (강아지 이름 등)
CREATE INDEX IF NOT EXISTS audit_logs_description_idx
  ON audit_logs USING gin (description gin_trgm_ops);

-- gin_trgm_ops 확장 (이미 있으면 무시)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- RLS — 로그인 사용자만 읽기/쓰기 가능
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_read ON audit_logs;
CREATE POLICY audit_logs_read ON audit_logs
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS audit_logs_write ON audit_logs;
CREATE POLICY audit_logs_write ON audit_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
