-- staff에 서비스별 우선 미용사 매핑 추가
-- 예: {"목욕": 1, "미용": 2} → 숫자가 낮을수록 우선

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS service_priority JSONB DEFAULT NULL;

COMMENT ON COLUMN staff.service_priority IS
  '서비스별 우선 미용사 매핑. 예: {"목욕": 1, "미용": 2}. 숫자가 낮을수록 우선.';
