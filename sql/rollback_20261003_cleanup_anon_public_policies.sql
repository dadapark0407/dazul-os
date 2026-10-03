-- =============================================================
-- 롤백: anon / public 정책 정리 (20261003_03)
-- 삭제한 정책을 원래 정의 그대로 복구하고, 새로 만든 정책을 삭제한다.
-- =============================================================

begin;

-- ─── 삭제했던 anon 정책 복구 ───
create policy allow_all_staff on public.staff
  for all to anon using (true) with check (true);
create policy allow_all_branches on public.branches
  for all to anon using (true) with check (true);
create policy anon_select_branches on public.branches
  for select to anon using (true);
create policy allow_all_grooming_sessions on public.grooming_sessions
  for all to anon using (true) with check (true);
create policy allow_all_ai_comments on public.ai_comments
  for all to anon using (true) with check (true);
create policy allow_all_session_health_checks on public.session_health_checks
  for all to anon using (true) with check (true);
create policy allow_all_session_notes on public.session_notes
  for all to anon using (true) with check (true);
create policy allow_all_session_products on public.session_products
  for all to anon using (true) with check (true);

-- ─── 삭제했던 public 정책 복구 ───
create policy "Allow admin full access report_tokens" on public.report_tokens
  for all to public using (true) with check (true);
create policy "Allow public read report_tokens" on public.report_tokens
  for select to public using (is_active = true);
create policy public_select_report_tokens on public.report_tokens
  for select to public using (true);
create policy "Allow all record_fields" on public.record_fields
  for all to public using (true) with check (true);
create policy "Allow all record_templates" on public.record_templates
  for all to public using (true) with check (true);
create policy "Allow all record_values" on public.record_values
  for all to public using (true) with check (true);
create policy "Allow all product_categories" on public.product_categories
  for all to public using (true) with check (true);
create policy public_select_salon_settings on public.salon_settings
  for select to public using (true);
create policy branch_isolation on public.recurring_schedules
  for all to public using (branch_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- ─── 새로 만든 정책 삭제 ───
drop policy if exists auth_all_report_tokens on public.report_tokens;
drop policy if exists auth_select_salon_settings on public.salon_settings;
drop policy if exists auth_branch_isolation on public.recurring_schedules;
drop policy if exists anon_read_product_categories on public.product_categories;

commit;
