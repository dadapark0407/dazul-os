-- =============================================================
-- DAZUL OS — product_categories 테이블 생성 + 시드 데이터
-- 실행: Supabase SQL Editor에서 직접 실행
-- =============================================================

-- 1. 카테고리 테이블 생성
create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  parent_id uuid references product_categories(id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. products 테이블에 category_id 추가 (기존 category text 컬럼 유지)
-- 이미 존재하면 무시됨
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'category_id'
  ) then
    alter table products add column category_id uuid references product_categories(id) on delete set null;
  end if;
end $$;

-- 3. 시드 데이터 — 그루밍 살롱 기본 카테고리
insert into product_categories (name, slug, sort_order) values
  ('샴푸', 'shampoo', 1),
  ('컨디셔너', 'conditioner', 2),
  ('팩', 'pack', 3),
  ('스파', 'spa', 4),
  ('스킨케어', 'skincare', 5),
  ('아로마', 'aroma', 6),
  ('위생관리', 'hygiene', 7),
  ('기타', 'etc', 99)
on conflict (slug) do nothing;

-- 4. (선택) 기존 category 텍스트 → category_id 마이그레이션
-- products.category 값이 product_categories.name과 일치하면 매핑
update products p
set category_id = pc.id
from product_categories pc
where p.category = pc.name
  and p.category_id is null;
