-- =============================================================
-- 롤백: 공개 리포트 RPC 전환 (20261003_01, 20261003_02)
--
-- [A] 정책만 되돌리기 — 3단계(정책 삭제) 후 문제가 생겼을 때. 코드는 그대로 둬도 됨.
-- [B] 함수까지 제거 — 코드도 RPC 이전 버전으로 되돌린 "후"에만 실행.
--     (RPC 코드가 배포된 상태에서 함수를 지우면 리포트가 404)
-- =============================================================

-- ─── [A] anon SELECT 정책 복구 (삭제 전과 동일한 정의) ───
drop policy if exists anon_read_guardians_by_token on public.guardians;
create policy anon_read_guardians_by_token on public.guardians
  for select to anon
  using (share_token is not null);

drop policy if exists anon_read_pets_by_guardian_token on public.pets;
create policy anon_read_pets_by_guardian_token on public.pets
  for select to anon
  using (guardian_id in (select guardians.id from public.guardians where guardians.share_token is not null));

drop policy if exists anon_read_visit_records_by_token on public.visit_records;
create policy anon_read_visit_records_by_token on public.visit_records
  for select to anon
  using (guardian_id in (select guardians.id from public.guardians where guardians.share_token is not null));

-- ─── [B] 함수 제거 (코드 롤백 후에만) ───
-- drop function if exists public.get_report_by_token(text);
-- drop function if exists public.is_valid_report_token(text);
