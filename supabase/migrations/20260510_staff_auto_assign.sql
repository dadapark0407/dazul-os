-- staff에 자동 배정 대상 여부 추가
-- true: autoAssignGroomer가 후보로 고려 (기본)
-- false: 자동 배정 대상에서 제외 (관리자가 수동으로만 배정)

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS auto_assign BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN staff.auto_assign IS
  'autoAssignGroomer 자동 배정 후보 포함 여부. false면 후보에서 제외.';
