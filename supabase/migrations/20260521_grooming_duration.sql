-- =============================================================
-- DAZUL OS — 미용 소요시간 컬럼 추가
-- =============================================================
-- 케어 기록 작성 시 실제 소요된 미용 시간을 기록.
-- 다음 예약 입력 시 같은 반려견의 최근 소요시간을 기본값으로 사용.
-- =============================================================

ALTER TABLE visit_records
  ADD COLUMN IF NOT EXISTS grooming_duration_minutes INTEGER;

COMMENT ON COLUMN visit_records.grooming_duration_minutes IS
  '미용 소요시간(분). 케어 기록 작성 시 입력. 다음 예약 시 기본 소요시간으로 사용.';
