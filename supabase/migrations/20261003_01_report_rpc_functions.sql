-- =============================================================
-- [배포 1단계] 공개 리포트 RPC 함수 생성
--
-- 공개 리포트(/report/[token])는 anon 키로 테이블을 직접 읽지 않고
-- 아래 함수만 호출한다. 함수는 토큰에 해당하는 보호자 1명의 데이터만 반환.
--
-- 이 파일만 실행해도 기존 동작에는 영향 없음 (정책은 그대로).
-- =============================================================

-- ─── 리포트 데이터 ───
-- 반환: 토큰이 유효하지 않으면 NULL
--   {
--     "guardian": { "name": text },
--     "pets":     [ { id, name, breed } ],             -- 현재 이 보호자의 반려견 (삭제 제외)
--     "records":  [ { id, pet_id, pet_name, ... } ]    -- 위 반려견들의 케어 기록 (pet_id 기준, 삭제 제외)
--   }
-- 연락처·메모 등 리포트에 표시하지 않는 필드는 반환하지 않는다.
create or replace function public.get_report_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with g as (
    select gu.id, gu.name
    from public.guardians gu
    where coalesce(p_token, '') <> ''
      and gu.share_token = p_token
    limit 1
  ),
  p as (
    select pe.id, pe.name, pe.breed
    from public.pets pe
    join g on pe.guardian_id = g.id
    where pe.deleted_at is null
  )
  select case when exists (select 1 from g) then
    jsonb_build_object(
      'guardian', (select jsonb_build_object('name', g.name) from g),
      'pets', coalesce(
        (select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'breed', p.breed) order by p.name) from p),
        '[]'::jsonb
      ),
      'records', coalesce(
        (select jsonb_agg(
          jsonb_build_object(
            'id', vr.id,
            'pet_id', vr.pet_id,
            'pet_name', vr.pet_name,
            'visit_date', vr.visit_date,
            'weight', vr.weight,
            'service', vr.service,
            'service_type', vr.service_type,
            'spa_level', vr.spa_level,
            'skin_status', vr.skin_status,
            'coat_status', vr.coat_status,
            'condition_status', vr.condition_status,
            'care_actions', vr.care_actions,
            'next_care_guide', vr.next_care_guide,
            'next_visit_date', vr.next_visit_date,
            'next_visit_recommendation', vr.next_visit_recommendation,
            'comment', vr.comment
          )
          order by vr.visit_date desc, vr.id desc
        )
        from public.visit_records vr
        where vr.pet_id in (select p.id from p)
          and vr.deleted_at is null),
        '[]'::jsonb
      )
    )
  end
$$;

-- ─── 토큰 유효성 (번역 API에서 비로그인 요청 인증용) ───
create or replace function public.is_valid_report_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guardians gu
    where coalesce(p_token, '') <> ''
      and gu.share_token = p_token
  )
$$;

-- ─── 권한: anon·authenticated 에 execute 만 ───
-- Postgres 기본값은 PUBLIC 에 execute 를 주므로 먼저 전부 회수 후 필요한 역할에만 부여.
-- authenticated: 로그인한 스태프가 같은 브라우저에서 리포트를 열어도 권한 오류가 없도록.
revoke all on function public.get_report_by_token(text) from public, anon, authenticated;
revoke all on function public.is_valid_report_token(text) from public, anon, authenticated;
grant execute on function public.get_report_by_token(text) to anon, authenticated;
grant execute on function public.is_valid_report_token(text) to anon, authenticated;
