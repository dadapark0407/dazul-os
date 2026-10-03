-- =============================================================
-- anon / public 정책 정리
--
-- 원칙
--   · anon(비로그인)은 기본 차단
--   · authenticated(로그인)는 기존과 동일하게 동작
--   · 공개 리포트에 필요한 products / product_categories SELECT 만 anon 에 남김
--
-- public 역할 정책은 anon·authenticated 모두에 적용되므로, 로그인 사용자가
-- 그 정책에만 기대던 테이블은 authenticated 정책을 "먼저" 만든 뒤 public 정책을 삭제한다.
--
-- 한 트랜잭션으로 실행 — 중간에 오류가 나면 전부 취소된다.
-- 롤백: sql/rollback_20261003_cleanup_anon_public_policies.sql
-- =============================================================

begin;

-- ─── 1. 로그인 사용자 권한 보존 (public 정책에만 기대던 테이블) ───

-- report_tokens: 기존 public ALL(true) 로 로그인 사용자가 전체 조회·쓰기·삭제 가능했음
create policy auth_all_report_tokens on public.report_tokens
  for all to authenticated
  using (true) with check (true);

-- salon_settings: 로그인 사용자의 SELECT 가 public SELECT 에 기대고 있었음
-- (INSERT / UPDATE 는 기존 authenticated 정책 유지, DELETE 는 기존에도 없음)
create policy auth_select_salon_settings on public.salon_settings
  for select to authenticated
  using (true);

-- recurring_schedules: 기존 public 정책과 같은 조건 (WITH CHECK 생략 = USING 조건으로 쓰기 검사, 기존과 동일)
create policy auth_branch_isolation on public.recurring_schedules
  for all to authenticated
  using (branch_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- product_categories: 공개 리포트의 제품 분류 표시에 필요한 읽기만 anon 에 허용
create policy anon_read_product_categories on public.product_categories
  for select to anon
  using (true);

-- ─── 2. anon 전체 허용 정책 삭제 ───
drop policy if exists allow_all_staff on public.staff;
drop policy if exists allow_all_branches on public.branches;
drop policy if exists anon_select_branches on public.branches;
drop policy if exists allow_all_grooming_sessions on public.grooming_sessions;
drop policy if exists allow_all_ai_comments on public.ai_comments;
drop policy if exists allow_all_session_health_checks on public.session_health_checks;
drop policy if exists allow_all_session_notes on public.session_notes;
drop policy if exists allow_all_session_products on public.session_products;

-- ─── 3. public 정책 삭제 (authenticated 정책이 이미 있거나 1단계에서 생성) ───
drop policy if exists "Allow admin full access report_tokens" on public.report_tokens;
drop policy if exists "Allow public read report_tokens" on public.report_tokens;
drop policy if exists public_select_report_tokens on public.report_tokens;
drop policy if exists "Allow all record_fields" on public.record_fields;
drop policy if exists "Allow all record_templates" on public.record_templates;
drop policy if exists "Allow all record_values" on public.record_values;
drop policy if exists "Allow all product_categories" on public.product_categories;
drop policy if exists public_select_salon_settings on public.salon_settings;
drop policy if exists branch_isolation on public.recurring_schedules;

-- products: 변경 없음 (anon_read_products SELECT 만 있고 anon 쓰기 정책 없음)

commit;
