-- =============================================================
-- DAZUL OS — RLS (Row Level Security) 일괄 적용
-- =============================================================
-- 정책 모델:
--   - 관리자 전용 테이블: RLS ON, authenticated 전체 권한, anon 차단
--   - /report 공개 경로 사용 테이블: RLS ON, authenticated 전체 권한,
--     anon은 SELECT만 허용 (필요 시 share_token 조건으로 행 제한)
--
-- ⚠ 보완 권장 (Phase 2):
--   /report 라우트가 ANON 키로 guardians/pets/visit_records를 직접 SELECT 중.
--   anon SELECT 정책으로 WRITE는 막히지만 PII 행 스캔이 여전히 가능.
--   서버 라우트를 SERVICE_ROLE_KEY로 전환하거나
--   SECURITY DEFINER RPC 함수(get_report_by_token)로 캡슐화 권장.
-- =============================================================

-- 헬퍼: RLS 켜고 authenticated에 전체 권한 부여
DO $$
DECLARE
  t TEXT;
  admin_tables TEXT[] := ARRAY[
    'staff', 'appointments', 'staff_off', 'branches',
    'staff_profiles', 'salon_settings',
    'record_fields', 'record_templates', 'record_values',
    'followups', 'photos', 'report_tokens'
  ];
  public_read_tables TEXT[] := ARRAY[
    'guardians', 'pets', 'visit_records',
    'products', 'product_categories'
  ];
BEGIN
  -- 관리자 전용 테이블 ----------------------------
  FOREACH t IN ARRAY admin_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

      -- 기존 정책 정리 후 재생성 (멱등)
      EXECUTE format('DROP POLICY IF EXISTS "auth_all_%s" ON %I', t, t);
      EXECUTE format(
        'CREATE POLICY "auth_all_%s" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t, t
      );
    END IF;
  END LOOP;

  -- /report 공개 경로 테이블 ----------------------
  FOREACH t IN ARRAY public_read_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

      -- authenticated 전체
      EXECUTE format('DROP POLICY IF EXISTS "auth_all_%s" ON %I', t, t);
      EXECUTE format(
        'CREATE POLICY "auth_all_%s" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t, t
      );

      -- anon SELECT 허용 (정책 본문은 테이블별로 아래에서 별도 부여)
    END IF;
  END LOOP;
END $$;

-- ─── /report 공개 경로용 anon SELECT 정책 ───
-- guardians: share_token 보유 행만 anon에 노출
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name='guardians') THEN
    DROP POLICY IF EXISTS "anon_select_guardians_with_token" ON guardians;
    CREATE POLICY "anon_select_guardians_with_token" ON guardians
      FOR SELECT TO anon
      USING (share_token IS NOT NULL);
  END IF;
END $$;

-- pets: anon 전체 SELECT (guardian_id 조인 의존)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name='pets') THEN
    DROP POLICY IF EXISTS "anon_select_pets" ON pets;
    CREATE POLICY "anon_select_pets" ON pets
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- visit_records: anon 전체 SELECT (guardian_id 조인 의존)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name='visit_records') THEN
    DROP POLICY IF EXISTS "anon_select_visit_records" ON visit_records;
    CREATE POLICY "anon_select_visit_records" ON visit_records
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- products: anon SELECT (제품 카탈로그 — 민감도 낮음)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name='products') THEN
    DROP POLICY IF EXISTS "anon_select_products" ON products;
    CREATE POLICY "anon_select_products" ON products
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- product_categories: anon SELECT
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name='product_categories') THEN
    DROP POLICY IF EXISTS "anon_select_product_categories" ON product_categories;
    CREATE POLICY "anon_select_product_categories" ON product_categories
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;
