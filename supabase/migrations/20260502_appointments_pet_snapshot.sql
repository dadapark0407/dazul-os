-- =============================================================
-- DAZUL OS — appointments에 반려견 이름/품종 스냅샷 컬럼 추가
-- 실행: Supabase 대시보드 > SQL Editor
--
-- 목적:
--   - 신규 고객 예약 시 pet_id 없이도 이름/품종 표시 가능
--   - 기존 고객도 표시용으로 같이 저장 (관계 데이터 우선, 컬럼은 fallback)
-- =============================================================

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS pet_name  TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS pet_breed TEXT;

-- 확인:
-- SELECT id, pet_id, pet_name, pet_breed FROM appointments LIMIT 5;
