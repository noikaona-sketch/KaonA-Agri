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
