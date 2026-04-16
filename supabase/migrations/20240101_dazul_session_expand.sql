-- =============================================================
-- DAZUL OS — 세션 기록 스키마 확장 마이그레이션
-- 실행: Supabase SQL Editor에서 전체 복사 후 실행
--
-- 주의: 이 프로젝트는 sessions 테이블이 아닌 visit_records 테이블을 사용합니다.
-- =============================================================


-- ─── 1. visit_records 컬럼 확장 ───

ALTER TABLE visit_records
  ADD COLUMN IF NOT EXISTS spa_level text
    CHECK (spa_level IN ('basic', 'essential', 'signature', 'prestige')),
  ADD COLUMN IF NOT EXISTS main_service text
    CHECK (main_service IN ('bath', 'full_grooming')),
  ADD COLUMN IF NOT EXISTS next_visit_date date,
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS weight numeric(5,2),
  ADD COLUMN IF NOT EXISTS session_type text,
  ADD COLUMN IF NOT EXISTS add_services jsonb DEFAULT '[]'::jsonb;


-- ─── 2. visit_records 건강 체크 컬럼 확장 ───
-- (기존 skin_status, coat_status, condition_status, stress_status 유지)

ALTER TABLE visit_records
  ADD COLUMN IF NOT EXISTS tangles_status text,
  ADD COLUMN IF NOT EXISTS eyes_status text,
  ADD COLUMN IF NOT EXISTS ears_status text,
  ADD COLUMN IF NOT EXISTS teeth_status text
    CHECK (teeth_status IN ('clean', 'needs_care')),
  ADD COLUMN IF NOT EXISTS nail_status text
    CHECK (nail_status IN ('good', 'needs_care')),
  ADD COLUMN IF NOT EXISTS care_tips jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS health_summary text;


-- ─── 3. session_photos 테이블 ───

CREATE TABLE IF NOT EXISTS session_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_record_id uuid NOT NULL REFERENCES visit_records(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE session_photos ENABLE ROW LEVEL SECURITY;

-- service_role 전체 권한 (서버 사이드)
CREATE POLICY "service_role_all_session_photos"
  ON session_photos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- authenticated 전체 권한 (로그인 사용자)
CREATE POLICY "auth_all_session_photos"
  ON session_photos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- anon SELECT 허용 (보호자 리포트에서 사진 표시용)
CREATE POLICY "anon_select_session_photos"
  ON session_photos
  FOR SELECT
  TO anon
  USING (true);


-- ─── 4. report_tokens 테이블 확장 ───
-- (이미 존재하므로 컬럼만 추가)

ALTER TABLE report_tokens
  ADD COLUMN IF NOT EXISTS visit_record_id uuid REFERENCES visit_records(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '90 days');


-- ─── 5. v_report_full 뷰 ───

CREATE OR REPLACE VIEW v_report_full AS
SELECT
  vr.id AS visit_record_id,
  vr.visit_date,
  vr.pet_name,
  vr.guardian_name,
  vr.staff_name,
  vr.service_type,
  vr.main_service,
  vr.spa_level,
  vr.weight,
  vr.skin_status,
  vr.coat_status,
  vr.condition_status,
  vr.stress_status,
  vr.tangles_status,
  vr.eyes_status,
  vr.ears_status,
  vr.teeth_status,
  vr.nail_status,
  vr.health_summary,
  vr.care_summary,
  vr.care_actions,
  vr.care_notes,
  vr.care_tips,
  vr.next_care_guide,
  vr.next_visit_date,
  vr.next_visit_recommendation,
  vr.special_notes,
  vr.note,
  vr.comment,
  vr.created_at AS record_created_at,

  -- 반려견 정보
  p.id AS pet_id,
  p.name AS pet_db_name,
  p.breed,
  p.gender,
  p.birthdate,

  -- 보호자 정보
  g.id AS guardian_id,
  g.name AS guardian_db_name,
  g.phone AS guardian_phone,
  g.share_token,

  -- 사진 (JSON 배열)
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', sp.id,
        'public_url', sp.public_url,
        'storage_path', sp.storage_path,
        'sort_order', sp.sort_order
      ) ORDER BY sp.sort_order
    )
    FROM session_photos sp
    WHERE sp.visit_record_id = vr.id),
    '[]'::jsonb
  ) AS photos,

  -- 리포트 토큰
  rt.token AS report_token,
  rt.expires_at AS report_expires_at

FROM visit_records vr
LEFT JOIN pets p ON p.id = vr.pet_id
LEFT JOIN guardians g ON g.id = vr.guardian_id
LEFT JOIN report_tokens rt ON rt.visit_record_id = vr.id AND rt.is_active = true;


-- ─── 완료 ───
-- 실행 후 Supabase 대시보드에서 visit_records 테이블의 새 컬럼 확인
