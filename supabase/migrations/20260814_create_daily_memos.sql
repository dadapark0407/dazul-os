create table daily_memos (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null default '00000000-0000-0000-0000-000000000001',
  memo_date date not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index daily_memos_date_idx on daily_memos (branch_id, memo_date);
alter table daily_memos enable row level security;
create policy "authenticated full access" on daily_memos
  for all to authenticated using (true) with check (true);
