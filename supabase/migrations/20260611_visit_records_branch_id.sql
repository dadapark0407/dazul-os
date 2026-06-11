-- =============================================================
-- DAZUL OS — 멀티 로케이션 1차: visit_records.branch_id 도입
--
-- 목적:
--   케어 기록(visit_records)을 매장 단위로 귀속시키고,
--   기존 운영 테이블의 NULL branch_id를 기본 지점으로 backfill.
--
-- ⚠️ 적용 순서: 이 마이그레이션을 먼저 적용한 뒤 앱 코드를 배포할 것.
--   (앱의 branch_id 필터가 NULL 행을 숨기지 않도록 backfill이 선행돼야 함)
--
-- 롤백:
--   alter table visit_records drop column if exists branch_id;
--   (backfill된 branch_id 값은 기존 NULL 복원 불필요 — 단일 매장 데이터라
--    전부 기본 지점이 맞는 값임. 컬럼 drop만으로 이전 상태와 동일하게 동작)
-- =============================================================

-- 0) 지점이 하나도 없으면 기본 지점(용산) 생성
insert into branches (id, name, is_active)
select gen_random_uuid(), '용산점', true
where not exists (select 1 from branches);

-- 1) visit_records에 branch_id 컬럼 추가
alter table visit_records
  add column if not exists branch_id uuid references branches(id);

-- 2) 기존 케어 기록 전부 기본(첫 활성) 지점으로 backfill
--    현재 단일 매장(용산) 운영이므로 모든 기존 행 = 기본 지점
update visit_records
set branch_id = (select id from branches where is_active limit 1)
where branch_id is null;

-- 3) 기존 운영 테이블의 NULL branch_id도 backfill
--    (조회에 branch_id 필터가 들어가면 NULL 행이 화면에서 사라지므로 필수)
update appointments
set branch_id = (select id from branches where is_active limit 1)
where branch_id is null;

update staff_off
set branch_id = (select id from branches where is_active limit 1)
where branch_id is null;

update staff
set branch_id = (select id from branches where is_active limit 1)
where branch_id is null;

update guardians
set branch_id = (select id from branches where is_active limit 1)
where branch_id is null;

update pets
set branch_id = (select id from branches where is_active limit 1)
where branch_id is null;

-- 4) 조회 인덱스 (매장별 기록 목록: branch + 방문일 역순)
create index if not exists idx_visit_records_branch_date
  on visit_records (branch_id, visit_date desc);

-- NOT NULL 제약은 보류:
--   anon(공유 리포트) 경로와 auth 미연동 상태에서 insert 실패 리스크가 있어
--   앱 코드가 모든 insert에 branch_id를 채우는 것을 검증한 뒤 별도 마이그레이션으로 추가.
