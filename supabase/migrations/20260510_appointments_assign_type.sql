-- appointments에 자동/수동 배정 구분 컬럼 추가
-- 'fixed': 사용자가 명시적으로 지정 (또는 자동 배정 실패로 미배정)
-- 'random': 자동 배정 알고리즘으로 선택된 미용사

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS assign_type TEXT NOT NULL DEFAULT 'fixed';

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_assign_type_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_assign_type_check
    CHECK (assign_type IN ('fixed', 'random'));

COMMENT ON COLUMN appointments.assign_type IS
  '미용사 배정 방식. fixed=수동 지정 또는 미배정. random=autoAssignGroomer로 자동 선택.';
