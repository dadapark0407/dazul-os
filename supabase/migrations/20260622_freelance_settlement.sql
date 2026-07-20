-- =============================================================
-- DAZUL OS — 프리랜서 정산 모듈 v3.6
-- spec: docs/freelance-settlement-spec.md
--
-- 생성 순서: groomers → settlements → sales → settlement_items → sale_logs
-- 헬퍼 함수 먼저 생성 후 RLS 적용
-- =============================================================

-- ─────────────────────────────────────────
-- 0. 헬퍼 함수
-- ─────────────────────────────────────────

-- 매장 관리자 판별: staff_profiles에 활성 레코드 있는 유저
CREATE OR REPLACE FUNCTION is_store_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_profiles
    WHERE user_id = uid AND is_active = true
  )
$$;

-- 현재 로그인 유저의 groomer_id 반환 (없으면 NULL)
CREATE OR REPLACE FUNCTION current_groomer_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM freelance_groomers
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$;

-- ─────────────────────────────────────────
-- 1. freelance_groomers
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS freelance_groomers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id),          -- 첫 매직링크 로그인 시 email 매칭으로 세팅
  branch_id        uuid NOT NULL REFERENCES branches(id),   -- 지점 연결 (NOT NULL — 멀티지점 일관성)
  name             text NOT NULL,
  email            text NOT NULL,                           -- 인증·연결 키(매직링크). 등록 시 필수
  phone            text,                                    -- 연락처(선택)
  allow_self_input boolean NOT NULL DEFAULT true,           -- false로 설정 시 해당 미용사 입력 차단
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 이메일 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS freelance_groomers_email_idx ON freelance_groomers (email);

ALTER TABLE freelance_groomers ENABLE ROW LEVEL SECURITY;

-- 매장: 전체 조회/수정
DROP POLICY IF EXISTS "fg_admin_all" ON freelance_groomers;
CREATE POLICY "fg_admin_all" ON freelance_groomers
  FOR ALL TO authenticated
  USING (is_store_admin(auth.uid()))
  WITH CHECK (is_store_admin(auth.uid()));

-- 미용사: 본인 행 조회
DROP POLICY IF EXISTS "fg_groomer_select_own" ON freelance_groomers;
CREATE POLICY "fg_groomer_select_own" ON freelance_groomers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 첫 로그인 시 본인 user_id 세팅 (email 매칭 + user_id가 아직 null인 행만)
DROP POLICY IF EXISTS "fg_groomer_claim" ON freelance_groomers;
CREATE POLICY "fg_groomer_claim" ON freelance_groomers
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'email') = email
    AND user_id IS NULL
  )
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────
-- 2. freelance_settlements
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS freelance_settlements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  groomer_id            uuid NOT NULL REFERENCES freelance_groomers(id),
  period_from           date NOT NULL,
  period_to             date NOT NULL,
  total_amount          integer,
  supply_amount         integer,
  commission_rate       numeric NOT NULL DEFAULT 0.60,      -- 생성 시점 스냅샷
  before_tax_amount     integer,
  withholding_amount    integer,                            -- 양수 저장, 화면엔 음수 "차감액"
  payout_amount         integer,
  status                text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','groomer_confirmed','store_confirmed','paid','disputed')),
  dispute_reason        text,
  payment_method        text,                               -- 수동 지급 기록(결제 아님). 예: bank_transfer
  payment_reference     text,                              -- 거래번호/메모(수동 입력)
  groomer_confirmed_by  uuid,
  groomer_confirmed_at  timestamptz,
  store_confirmed_by    uuid,
  store_confirmed_at    timestamptz,
  paid_at               timestamptz,
  reopened_by           uuid,
  reopen_reason         text,
  reopened_at           timestamptz,
  created_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE freelance_settlements ENABLE ROW LEVEL SECURITY;

-- 매장: 전체
DROP POLICY IF EXISTS "fs_admin_all" ON freelance_settlements;
CREATE POLICY "fs_admin_all" ON freelance_settlements
  FOR ALL TO authenticated
  USING (is_store_admin(auth.uid()))
  WITH CHECK (is_store_admin(auth.uid()));

-- 미용사: 본인 groomer_id 행 조회
DROP POLICY IF EXISTS "fs_groomer_select_own" ON freelance_settlements;
CREATE POLICY "fs_groomer_select_own" ON freelance_settlements
  FOR SELECT TO authenticated
  USING (groomer_id = current_groomer_id());

-- 미용사: 본인 정산 상태 전환 (confirm/dispute — RPC 경유, 여기선 UPDATE 허용)
DROP POLICY IF EXISTS "fs_groomer_update_own" ON freelance_settlements;
CREATE POLICY "fs_groomer_update_own" ON freelance_settlements
  FOR UPDATE TO authenticated
  USING (
    groomer_id = current_groomer_id()
    AND status IN ('draft', 'groomer_confirmed')   -- confirm/dispute 가능 상태
  )
  WITH CHECK (groomer_id = current_groomer_id());

-- ─────────────────────────────────────────
-- 3. freelance_sales
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS freelance_sales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  groomer_id      uuid NOT NULL REFERENCES freelance_groomers(id),
  settlement_id   uuid REFERENCES freelance_settlements(id),  -- 바인딩 = 잠금. "정산됨" = IS NOT NULL
  date            date NOT NULL,
  breed           text,
  pet_name        text,
  amount          integer NOT NULL CHECK (amount >= 0),
  service_type    text CHECK (service_type IN ('grooming','bath','spa','care','other')),
  source          text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','dazul')),                  -- 미래: dazul OS native 구분
  memo            text,
  status          text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','approved','rejected')), -- settled 없음, settlement_id로 파생
  reject_reason   text,
  approved_by     uuid,
  approved_at     timestamptz,
  created_by      uuid,
  updated_by      uuid,
  deleted_at      timestamptz,                             -- soft delete
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS freelance_sales_groomer_date_idx
  ON freelance_sales (groomer_id, date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS freelance_sales_settlement_idx
  ON freelance_sales (settlement_id)
  WHERE settlement_id IS NOT NULL;

ALTER TABLE freelance_sales ENABLE ROW LEVEL SECURITY;

-- 매장: settlement_id IS NULL인 행 전체 CRUD
--       (바인딩된 행은 RPC로만 수정 — 직접 UPDATE 차단)
DROP POLICY IF EXISTS "fsa_admin_unbound" ON freelance_sales;
CREATE POLICY "fsa_admin_unbound" ON freelance_sales
  FOR ALL TO authenticated
  USING (is_store_admin(auth.uid()))
  WITH CHECK (is_store_admin(auth.uid()));

-- 미용사: 본인 행 조회 (deleted_at 포함, 화면에서 필터)
DROP POLICY IF EXISTS "fsa_groomer_select_own" ON freelance_sales;
CREATE POLICY "fsa_groomer_select_own" ON freelance_sales
  FOR SELECT TO authenticated
  USING (groomer_id = current_groomer_id());

-- 미용사: INSERT — allow_self_input=true인 본인만, submitted + manual 고정
DROP POLICY IF EXISTS "fsa_groomer_insert" ON freelance_sales;
CREATE POLICY "fsa_groomer_insert" ON freelance_sales
  FOR INSERT TO authenticated
  WITH CHECK (
    groomer_id = current_groomer_id()
    AND status = 'submitted'
    AND source = 'manual'
    AND settlement_id IS NULL
    AND EXISTS (
      SELECT 1 FROM freelance_groomers
      WHERE id = groomer_id AND allow_self_input = true
    )
  );

-- 미용사: UPDATE — submitted/rejected + 미바인딩 행만
DROP POLICY IF EXISTS "fsa_groomer_update" ON freelance_sales;
CREATE POLICY "fsa_groomer_update" ON freelance_sales
  FOR UPDATE TO authenticated
  USING (
    groomer_id = current_groomer_id()
    AND status IN ('submitted', 'rejected')
    AND settlement_id IS NULL
    AND deleted_at IS NULL
  )
  WITH CHECK (
    groomer_id = current_groomer_id()
    AND settlement_id IS NULL
  );

-- ─────────────────────────────────────────
-- 4. freelance_settlement_items (스냅샷 — 정산 생성 시 동결)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS freelance_settlement_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id       uuid NOT NULL REFERENCES freelance_settlements(id) ON DELETE CASCADE,
  sale_id             uuid NOT NULL REFERENCES freelance_sales(id),
  date_snapshot       date,
  pet_name_snapshot   text,
  breed_snapshot      text,
  amount_snapshot     integer,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fsi_settlement_idx ON freelance_settlement_items (settlement_id);

ALTER TABLE freelance_settlement_items ENABLE ROW LEVEL SECURITY;

-- 매장: 전체
DROP POLICY IF EXISTS "fsi_admin_all" ON freelance_settlement_items;
CREATE POLICY "fsi_admin_all" ON freelance_settlement_items
  FOR ALL TO authenticated
  USING (is_store_admin(auth.uid()))
  WITH CHECK (is_store_admin(auth.uid()));

-- 미용사: 본인 정산 항목 조회
DROP POLICY IF EXISTS "fsi_groomer_select" ON freelance_settlement_items;
CREATE POLICY "fsi_groomer_select" ON freelance_settlement_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM freelance_settlements fs
      WHERE fs.id = settlement_id
        AND fs.groomer_id = current_groomer_id()
    )
  );

-- ─────────────────────────────────────────
-- 5. freelance_sale_logs (변경 이력)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS freelance_sale_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     uuid NOT NULL REFERENCES freelance_sales(id),
  field       text NOT NULL,    -- amount / date / pet_name / breed / status 등
  old_value   text,
  new_value   text,
  changed_by  uuid,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fsl_sale_idx ON freelance_sale_logs (sale_id);

ALTER TABLE freelance_sale_logs ENABLE ROW LEVEL SECURITY;

-- 매장: 전체 조회/INSERT
DROP POLICY IF EXISTS "fsl_admin_all" ON freelance_sale_logs;
CREATE POLICY "fsl_admin_all" ON freelance_sale_logs
  FOR ALL TO authenticated
  USING (is_store_admin(auth.uid()))
  WITH CHECK (is_store_admin(auth.uid()));

-- 미용사: 본인 매출 로그 조회
DROP POLICY IF EXISTS "fsl_groomer_select" ON freelance_sale_logs;
CREATE POLICY "fsl_groomer_select" ON freelance_sale_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM freelance_sales fs
      WHERE fs.id = sale_id
        AND fs.groomer_id = current_groomer_id()
    )
  );

-- 미용사: 본인 매출 로그 INSERT (수정/재제출 시 클라이언트가 로그 적재)
DROP POLICY IF EXISTS "fsl_groomer_insert" ON freelance_sale_logs;
CREATE POLICY "fsl_groomer_insert" ON freelance_sale_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM freelance_sales fs
      WHERE fs.id = sale_id
        AND fs.groomer_id = current_groomer_id()
    )
  );

-- ─────────────────────────────────────────
-- 6. 시드 데이터 — 미용사 1명
--    TODO: email을 실제 미용사 이메일로 변경 후 실행
--          (branch_id는 첫 번째 활성 지점으로 자동 세팅)
-- ─────────────────────────────────────────

DO $$
DECLARE
  v_branch_id uuid;
BEGIN
  -- 기본 지점 조회
  SELECT id INTO v_branch_id
  FROM branches
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    RAISE NOTICE 'branches 테이블에 활성 지점이 없습니다. 시드를 건너뜁니다.';
    RETURN;
  END IF;

  -- 이미 존재하면 skip (멱등)
  IF NOT EXISTS (
    SELECT 1 FROM freelance_groomers WHERE email = 'groomer@dazul.co.kr'
  ) THEN
    INSERT INTO freelance_groomers (name, email, branch_id)
    VALUES ('프리랜서 미용사', 'groomer@dazul.co.kr', v_branch_id);

    RAISE NOTICE '시드 완료: groomer@dazul.co.kr (branch_id: %)', v_branch_id;
  ELSE
    RAISE NOTICE '시드 스킵: groomer@dazul.co.kr 이미 존재';
  END IF;
END $$;

-- ─────────────────────────────────────────
-- NOTE: 실제 이메일 변경 방법
--   UPDATE freelance_groomers
--   SET email = '실제이메일@example.com', name = '실제이름'
--   WHERE email = 'groomer@dazul.co.kr';
-- ─────────────────────────────────────────
