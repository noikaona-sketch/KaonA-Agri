-- UAT test results — บันทึกผลทดสอบต่อ test_id
create table if not exists public.uat_results (
  id         uuid primary key default gen_random_uuid(),
  test_id    text not null unique,   -- เช่น 'm1', 'int3'
  result     text not null default 'pending'
    check (result in ('pass','fail','skip','pending')),
  note       text,
  tested_by  text,                   -- ชื่อผู้ทดสอบ
  tested_at  timestamptz,
  updated_at timestamptz not null default now()
);

-- admin เท่านั้น
alter table public.uat_results enable row level security;
create policy uat_admin on public.uat_results for all
  using (public.current_member_has_role('admin'));
