-- 시간 블락 기능: staff_off에 사유(reason) 컬럼 추가
-- off_type 신규 값 'time_block' 사용 (off_type은 TEXT라 제약 변경 불필요)
ALTER TABLE staff_off ADD COLUMN IF NOT EXISTS reason TEXT;

COMMENT ON COLUMN staff_off.reason IS
  '시간 블락 사유 (외부 미팅/교육/개인 사정 등). off_type=time_block에서 사용.';
