-- Issue #2: Database ERD + Supabase Schema
-- Target: Supabase PostgreSQL

create extension if not exists "pgcrypto";

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  citizen_id_masked text not null,
  full_name text not null,
  phone text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_roles (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  role text not null check (role in ('farmer','leader','inspector','truck_owner','staff','admin','service_account')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (member_id, role)
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  requested_by uuid not null references public.members(id),
  reviewed_by uuid references public.members(id),
  resource_type text not null,
  resource_id uuid,
  status text not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plots (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  name text not null,
  area_rai numeric(12,2) not null check (area_rai > 0),
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  accuracy numeric(10,2),
  status text not null default 'active',
  created_by uuid not null references public.members(id),
  role_used text not null,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planting_cycles (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  crop_name text not null,
  season_year int not null,
  planted_at date,
  expected_harvest_at date,
  status text not null default 'planned',
  created_by uuid not null references public.members(id),
  role_used text not null,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seed_orders (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  planting_cycle_id uuid references public.planting_cycles(id) on delete set null,
  seed_type text not null,
  quantity_kg numeric(12,2) not null check (quantity_kg > 0),
  status text not null default 'requested',
  reviewed_by uuid references public.members(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.no_burn_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  planting_cycle_id uuid references public.planting_cycles(id) on delete set null,
  status text not null default 'submitted',
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.members(id),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  no_burn_request_id uuid references public.no_burn_requests(id) on delete set null,
  plot_id uuid references public.plots(id) on delete set null,
  inspector_member_id uuid not null references public.members(id),
  assigned_at timestamptz,
  visited_at timestamptz,
  result_status text not null default 'pending',
  result_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  plot_id uuid references public.plots(id) on delete set null,
  no_burn_request_id uuid references public.no_burn_requests(id) on delete set null,
  inspection_id uuid references public.inspections(id) on delete set null,
  storage_path text not null,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  accuracy numeric(10,2),
  captured_at timestamptz not null,
  uploaded_by uuid not null references public.members(id),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  channel text not null default 'in_app',
  title text not null,
  body text not null,
  related_resource_type text,
  related_resource_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_member_roles_member_id on public.member_roles(member_id);
create index if not exists idx_plots_member_id on public.plots(member_id);
create index if not exists idx_cycles_plot_id on public.planting_cycles(plot_id);
create index if not exists idx_seed_orders_member_id on public.seed_orders(member_id);
create index if not exists idx_no_burn_member_id on public.no_burn_requests(member_id);
create index if not exists idx_inspections_inspector on public.inspections(inspector_member_id);
create index if not exists idx_photos_member_id on public.photos(member_id);
create index if not exists idx_notifications_member_id on public.notifications(member_id);
