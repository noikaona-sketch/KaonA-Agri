create table if not exists public.provider_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  request_type text not null,
  title text not null,
  requester_name text not null,
  phone text not null,
  area text not null,
  note text,
  service_type text,
  provider_team_name text,
  equipment_summary text,
  availability_note text,
  status text not null default 'pending',
  reviewer_reason text,
  reviewed_by uuid references public.members(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_provider_requests_type
    check (request_type in ('service_team')),
  constraint chk_provider_requests_status
    check (status in ('pending','approved','rejected'))
);

create index if not exists idx_provider_requests_status_created_at
  on public.provider_requests(status, created_at asc);

create index if not exists idx_provider_requests_member_created_at
  on public.provider_requests(member_id, created_at desc);

alter table public.provider_requests enable row level security;

drop policy if exists provider_requests_member_read_own on public.provider_requests;
create policy provider_requests_member_read_own
  on public.provider_requests
  for select
  using (
    member_id in (
      select m.id from public.members m where m.auth_user_id = auth.uid()
    )
  );

drop policy if exists provider_requests_member_insert_own on public.provider_requests;
create policy provider_requests_member_insert_own
  on public.provider_requests
  for insert
  with check (
    member_id in (
      select m.id from public.members m where m.auth_user_id = auth.uid()
    )
  );

drop policy if exists provider_requests_admin_all on public.provider_requests;
create policy provider_requests_admin_all
  on public.provider_requests
  for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff'))
  with check (public.current_member_has_role('admin') or public.current_member_has_role('staff'));
