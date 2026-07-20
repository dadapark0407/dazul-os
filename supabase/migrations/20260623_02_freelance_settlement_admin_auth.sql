-- =============================================================
-- DAZUL OS — 프리랜서 정산 관리자 인증 (2/2)
-- 1. freelance_settlement_admins 테이블 — 개인 UUID 화이트리스트
-- 2. is_settlement_admin() 교체 — staff_profiles 참조 완전 제거
-- 3. freelance_* 5개 테이블 RLS 관리자 정책 재생성
--
-- 보안 원칙:
--   - 공용 계정 UUID는 이 테이블에 절대 넣지 않는다
--   - 개인 이메일 매직링크로 로그인한 UUID만 수동 INSERT
--   - is_settlement_admin은 staff_profiles/is_store_admin과 완전 분리
-- =============================================================

-- ─────────────────────────────────────────
-- 1. freelance_settlement_admins 테이블
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS freelance_settlement_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note       text,                          -- 누구인지 메모 (예: '원장 홍길동')
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE freelance_settlement_admins ENABLE ROW LEVEL SECURITY;

-- 관리자 본인만 본인 행 조회 가능 (목록 조회는 RPC 경유)
DROP POLICY IF EXISTS "fsa_select_own" ON freelance_settlement_admins;
CREATE POLICY "fsa_select_own" ON freelance_settlement_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE는 RLS로 막고 DB 레벨(Supabase 대시보드)에서만 관리
-- (새 관리자 추가는 서비스 운영자가 직접 SQL로)

-- ─────────────────────────────────────────
-- 2. is_settlement_admin() 교체
--    staff_profiles 참조 완전 제거
--    freelance_settlement_admins 테이블만 조회
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_settlement_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM freelance_settlement_admins
    WHERE user_id = uid
  )
$$;

-- ─────────────────────────────────────────
-- 3. freelance_* 5개 테이블 RLS 관리자 정책 재생성
--    20260622_freelance_settlement.sql 의 is_store_admin 버전을 덮어씀
-- ─────────────────────────────────────────

-- freelance_groomers
DROP POLICY IF EXISTS "fg_admin_all" ON freelance_groomers;
CREATE POLICY "fg_admin_all" ON freelance_groomers
  FOR ALL TO authenticated
  USING    (is_settlement_admin(auth.uid()))
  WITH CHECK (is_settlement_admin(auth.uid()));

-- freelance_settlements
DROP POLICY IF EXISTS "fs_admin_all" ON freelance_settlements;
CREATE POLICY "fs_admin_all" ON freelance_settlements
  FOR ALL TO authenticated
  USING    (is_settlement_admin(auth.uid()))
  WITH CHECK (is_settlement_admin(auth.uid()));

-- freelance_sales
DROP POLICY IF EXISTS "fsa_admin_unbound" ON freelance_sales;
CREATE POLICY "fsa_admin_unbound" ON freelance_sales
  FOR ALL TO authenticated
  USING    (is_settlement_admin(auth.uid()))
  WITH CHECK (is_settlement_admin(auth.uid()));

-- freelance_settlement_items
DROP POLICY IF EXISTS "fsi_admin_all" ON freelance_settlement_items;
CREATE POLICY "fsi_admin_all" ON freelance_settlement_items
  FOR ALL TO authenticated
  USING    (is_settlement_admin(auth.uid()))
  WITH CHECK (is_settlement_admin(auth.uid()));

-- freelance_sale_logs
DROP POLICY IF EXISTS "fsl_admin_all" ON freelance_sale_logs;
CREATE POLICY "fsl_admin_all" ON freelance_sale_logs
  FOR ALL TO authenticated
  USING    (is_settlement_admin(auth.uid()))
  WITH CHECK (is_settlement_admin(auth.uid()));

-- ─────────────────────────────────────────
-- 4. 관리자 UUID 등록 절차 (자리표시자)
--
-- [1단계] 개인 이메일로 /admin/settlement/login 에서 매직링크 로그인
--
-- [2단계] Supabase 대시보드 → Authentication → Users → 본인 이메일 행 → UUID 복사
--         또는 로그인 후 아래 쿼리로 조회:
--           SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 10;
--
-- [3단계] 아래 INSERT 실행 (Supabase SQL 에디터):
--           INSERT INTO freelance_settlement_admins (user_id, note)
--           VALUES ('<여기에-개인-UUID-붙여넣기>', '원장 홍길동');
--
-- [확인]
--           SELECT u.email, a.note, a.created_at
--           FROM freelance_settlement_admins a
--           JOIN auth.users u ON u.id = a.user_id;
--
-- ※ 공용 계정(직원 공동 사용) UUID는 절대 넣지 않는다
-- ─────────────────────────────────────────
