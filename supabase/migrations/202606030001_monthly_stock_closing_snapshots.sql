-- Monthly stock closing snapshots for admin review before final close.

create table if not exists public.stock_closing_snapshots (
  id uuid primary key default gen_random_uuid(),
  closing_no text not null unique,
  period_year int not null,
  period_month int not null check (period_month between 1 and 12),
  period_start date not null,
  period_end date not null,
  warehouse_id uuid references public.warehouses(id) on delete restrict,
  scope text not null default 'warehouse' check (scope in ('warehouse','all')),
  status text not null default 'review' check (status in ('review','closed')),
  line_count int not null default 0,
  total_opening_qty numeric(14,2) not null default 0,
  total_receive_qty numeric(14,2) not null default 0,
  total_out_qty numeric(14,2) not null default 0,
  total_transfer_in_qty numeric(14,2) not null default 0,
  total_transfer_out_qty numeric(14,2) not null default 0,
  total_reserved_qty numeric(14,2) not null default 0,
  total_ending_qty numeric(14,2) not null default 0,
  reviewed_by uuid references public.members(id),
  reviewed_at timestamptz not null default now(),
  closed_by uuid references public.members(id),
  closed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_closing_scope_warehouse check (
    (scope = 'all' and warehouse_id is null) or
    (scope = 'warehouse' and warehouse_id is not null)
  )
);

create unique index if not exists uq_stock_closing_all_period
  on public.stock_closing_snapshots(period_year, period_month)
  where scope = 'all';
create unique index if not exists uq_stock_closing_warehouse_period
  on public.stock_closing_snapshots(period_year, period_month, warehouse_id)
  where scope = 'warehouse';
create index if not exists idx_stock_closing_period_end_status
  on public.stock_closing_snapshots(period_end, status);

create trigger trg_stock_closing_snapshots_updated_at
  before update on public.stock_closing_snapshots
  for each row execute function public.set_updated_at();

create table if not exists public.stock_closing_lines (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.stock_closing_snapshots(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  variety_id uuid references public.seed_varieties(id) on delete restrict,
  product_name text not null,
  unit text not null default 'ชิ้น',
  opening_qty numeric(12,2) not null default 0,
  receive_qty numeric(12,2) not null default 0,
  out_qty numeric(12,2) not null default 0,
  transfer_in_qty numeric(12,2) not null default 0,
  transfer_out_qty numeric(12,2) not null default 0,
  adjustment_qty numeric(12,2) not null default 0,
  reserved_qty numeric(12,2) not null default 0,
  ending_qty numeric(12,2) not null default 0,
  system_qty_on_hand numeric(12,2),
  variance_qty numeric(12,2),
  movement_count int not null default 0,
  note text,
  created_at timestamptz not null default now(),
  constraint stock_closing_line_product_or_variety check (
    (product_id is not null and variety_id is null) or
    (product_id is null and variety_id is not null)
  )
);

create unique index if not exists uq_stock_closing_line_product
  on public.stock_closing_lines(snapshot_id, warehouse_id, product_id)
  where product_id is not null;
create unique index if not exists uq_stock_closing_line_variety
  on public.stock_closing_lines(snapshot_id, warehouse_id, variety_id)
  where variety_id is not null;
create index if not exists idx_stock_closing_lines_snapshot
  on public.stock_closing_lines(snapshot_id);
create index if not exists idx_stock_closing_lines_warehouse
  on public.stock_closing_lines(warehouse_id);

alter table public.stock_closing_snapshots enable row level security;
alter table public.stock_closing_lines enable row level security;

create policy stock_closing_snapshots_read on public.stock_closing_snapshots
  for select using (true);
create policy stock_closing_snapshots_admin on public.stock_closing_snapshots
  for all using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

create policy stock_closing_lines_read on public.stock_closing_lines
  for select using (true);
create policy stock_closing_lines_admin on public.stock_closing_lines
  for all using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

create sequence if not exists public.stock_closing_snapshot_seq start 1;
