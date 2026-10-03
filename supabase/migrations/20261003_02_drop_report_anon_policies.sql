-- =============================================================
-- [배포 3단계] 공개 리포트용 anon SELECT 정책 삭제
--
-- 반드시 RPC 를 쓰는 코드가 배포된 "후"에 실행.
-- 실행 후 anon 키로는 guardians / pets / visit_records 를 직접 읽을 수 없다.
-- 어드민·직원 화면은 authenticated 정책(auth_all 등)으로 계속 조회됨.
-- =============================================================

drop policy if exists anon_read_guardians_by_token on public.guardians;
drop policy if exists anon_read_pets_by_guardian_token on public.pets;
drop policy if exists anon_read_visit_records_by_token on public.visit_records;
