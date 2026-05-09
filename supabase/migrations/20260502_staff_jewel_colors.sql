-- =============================================================
-- DAZUL OS — 미용사 시그니처 컬러 (보석 무드 8색 중 5개)
-- 실행: Supabase 대시보드 > SQL Editor
-- =============================================================

-- display_order 기준으로 5명에게 보석 컬러 할당
-- (이후 직원 관리 페이지에서 개별 변경 가능)

UPDATE staff SET signature_color = '#7B6B8E' WHERE display_order = 1; -- 아메시스트
UPDATE staff SET signature_color = '#5D8C7B' WHERE display_order = 2; -- 에메랄드
UPDATE staff SET signature_color = '#6886A0' WHERE display_order = 3; -- 사파이어
UPDATE staff SET signature_color = '#6B8A8E' WHERE display_order = 4; -- 아쿠아
UPDATE staff SET signature_color = '#B0706F' WHERE display_order = 5; -- 가넷

-- 확인 쿼리
-- SELECT display_order, name, signature_color FROM staff ORDER BY display_order;
