-- Issue #16: Complete MVP SQL schema hardening (constraints + indexes)
-- Notes:
-- - Does not replace prior migrations.
-- - Preserves existing RLS policies.

-- 1) Role integrity: one primary role per member max.
create unique index if not exists uq_member_roles_primary_per_member
on public.member_roles(member_id)
where is_primary = true;

-- 2) Common status/resource constraints.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_members_status'
      and conrelid = 'public.members'::regclass
  ) then
    alter table public.members
      add constraint chk_members_status
      check (status in ('pending','active','rejected','suspended'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_approvals_status'
      and conrelid = 'public.approvals'::regclass
  ) then
    alter table public.approvals
      add constraint chk_approvals_status
      check (status in ('pending','approved','rejected','cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_approvals_resource_type'
      and conrelid = 'public.approvals'::regclass
  ) then
    alter table public.approvals
      add constraint chk_approvals_resource_type
      check (resource_type in ('member','plot','planting_cycle','seed_order','no_burn_request','inspection'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_plots_status'
      and conrelid = 'public.plots'::regclass
  ) then
    alter table public.plots
      add constraint chk_plots_status
      check (status in ('active','inactive','archived'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_planting_cycles_status'
      and conrelid = 'public.planting_cycles'::regclass
  ) then
    alter table public.planting_cycles
      add constraint chk_planting_cycles_status
      check (status in ('planned','planted','harvested','cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_seed_orders_status'
      and conrelid = 'public.seed_orders'::regclass
  ) then
    alter table public.seed_orders
      add constraint chk_seed_orders_status
      check (status in ('requested','approved','rejected','fulfilled','cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_no_burn_requests_status'
      and conrelid = 'public.no_burn_requests'::regclass
  ) then
    alter table public.no_burn_requests
      add constraint chk_no_burn_requests_status
      check (status in ('submitted','under_review','approved','rejected','cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_inspections_result_status'
      and conrelid = 'public.inspections'::regclass
  ) then
    alter table public.inspections
      add constraint chk_inspections_result_status
      check (result_status in ('pending','pass','fail','needs_followup'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_notifications_channel'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint chk_notifications_channel
      check (channel in ('in_app','line_push','sms'));
  end if;
end $$;

-- 3) Geospatial sanity checks.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_plots_lat_lng_range'
      and conrelid = 'public.plots'::regclass
  ) then
    alter table public.plots
      add constraint chk_plots_lat_lng_range
      check (lat between -90 and 90 and lng between -180 and 180);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_photos_lat_lng_range'
      and conrelid = 'public.photos'::regclass
  ) then
    alter table public.photos
      add constraint chk_photos_lat_lng_range
      check (lat between -90 and 90 and lng between -180 and 180);
  end if;
end $$;

-- 4) Temporal consistency checks.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_planting_cycles_harvest_after_plant'
      and conrelid = 'public.planting_cycles'::regclass
  ) then
    alter table public.planting_cycles
      add constraint chk_planting_cycles_harvest_after_plant
      check (expected_harvest_at is null or planted_at is null or expected_harvest_at >= planted_at);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_inspections_visited_after_assigned'
      and conrelid = 'public.inspections'::regclass
  ) then
    alter table public.inspections
      add constraint chk_inspections_visited_after_assigned
      check (visited_at is null or assigned_at is null or visited_at >= assigned_at);
  end if;
end $$;

-- 5) Covering and workflow indexes.
create index if not exists idx_member_roles_role on public.member_roles(role);
create index if not exists idx_members_status on public.members(status);
create index if not exists idx_plots_status on public.plots(status);
create index if not exists idx_cycles_member_status on public.planting_cycles(member_id, status);
create index if not exists idx_seed_orders_member_status on public.seed_orders(member_id, status);
create index if not exists idx_no_burn_member_status on public.no_burn_requests(member_id, status);
create index if not exists idx_inspections_plot on public.inspections(plot_id);
create index if not exists idx_inspections_no_burn_request on public.inspections(no_burn_request_id);
create index if not exists idx_photos_plot on public.photos(plot_id);
create index if not exists idx_photos_no_burn_request on public.photos(no_burn_request_id);
create index if not exists idx_photos_inspection on public.photos(inspection_id);
create index if not exists idx_notifications_member_unread on public.notifications(member_id, read_at);
