-- =============================================================
-- DAZUL OS — 동적 방문 기록 템플릿 시스템
-- 실행: Supabase SQL Editor에서 실행
-- =============================================================

-- 1. 기록 템플릿 (어떤 양식인지)
create table if not exists record_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. 템플릿 필드 (양식에 어떤 항목이 있는지)
create table if not exists record_fields (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references record_templates(id) on delete cascade,
  label text not null,
  field_key text not null,
  field_type text not null default 'text',
    -- text, textarea, select, multi, number, boolean
  options jsonb default '[]'::jsonb,
    -- select/multi 타입에서 사용할 선택지: ["옵션1", "옵션2"]
  placeholder text,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  unique (template_id, field_key)
);

-- 3. 기록 값 (방문 기록에 저장된 동적 필드 값)
create table if not exists record_values (
  id uuid primary key default gen_random_uuid(),
  visit_record_id uuid not null references visit_records(id) on delete cascade,
  field_id uuid not null references record_fields(id) on delete cascade,
  value_text text,
  value_json jsonb,
  created_at timestamp with time zone default now(),

  unique (visit_record_id, field_id)
);

-- 인덱스
create index if not exists idx_record_fields_template
  on record_fields (template_id, sort_order);

create index if not exists idx_record_values_visit
  on record_values (visit_record_id);

create index if not exists idx_record_values_field
  on record_values (field_id);

-- 기본 템플릿 시드 (선택)
insert into record_templates (name, description, is_default, sort_order)
values ('기본 방문 기록', '일반 그루밍 방문에 사용하는 기본 양식', true, 0)
on conflict do nothing;
