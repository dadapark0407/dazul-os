-- =============================================================
-- DAZUL OS — 프리랜서 정산 보안 수정 (1/2)
-- 1. claim_groomer_user_id() RPC — 미용사 첫 로그인 user_id 연결
-- 2. fg_groomer_claim 정책 삭제 — 클라이언트 직접 UPDATE 차단
--
-- is_settlement_admin() 및 관리자 RLS 정책 재생성은
-- 20260623_02_freelance_settlement_admin_auth.sql 참고
-- =============================================================

-- ─────────────────────────────────────────
-- 1. claim_groomer_user_id() RPC
--    - SECURITY DEFINER: 서버 신뢰 컨텍스트에서 실행
--    - SET search_path = public, pg_temp: 스키마 인젝션 차단
--    - user_id 컬럼만 UPDATE (다른 컬럼 변경 불가)
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION claim_groomer_user_id()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE freelance_groomers
  SET user_id = auth.uid()
  WHERE email    = (auth.jwt() ->> 'email')
    AND user_id  IS NULL
    AND is_active = true;
END $$;

REVOKE ALL ON FUNCTION claim_groomer_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_groomer_user_id() TO authenticated;

-- ─────────────────────────────────────────
-- 2. fg_groomer_claim 정책 삭제
--    미용사의 freelance_groomers 직접 UPDATE 권한 제거
--    (이후 미용사는 SELECT만 가능)
-- ─────────────────────────────────────────

DROP POLICY IF EXISTS "fg_groomer_claim" ON freelance_groomers;
