-- Issue #16: Complete MVP SQL schema (soft delete + audit + status alignment)
-- Additive-only migration. Keeps previous migrations and RLS policies intact.

-- 1) Soft delete columns
alter table public.members add column if not exists deleted_at timestamptz;
alter table public.members add column if not exists deleted_by uuid references public.members(id);

alter table public.plots add column if not exists deleted_at timestamptz;
alter table public.plots add column if not exists deleted_by uuid references public.members(id);

alter table public.planting_cycles add column if not exists deleted_at timestamptz;
alter table public.planting_cycles add column if not exists deleted_by uuid references public.members(id);

alter table public.seed_orders add column if not exists deleted_at timestamptz;
alter table public.seed_orders add column if not exists deleted_by uuid references public.members(id);

alter table public.no_burn_requests add column if not exists deleted_at timestamptz;
alter table public.no_burn_requests add column if not exists deleted_by uuid references public.members(id);

alter table public.inspections add column if not exists deleted_at timestamptz;
alter table public.inspections add column if not exists deleted_by uuid references public.members(id);

alter table public.photos add column if not exists deleted_at timestamptz;
alter table public.photos add column if not exists deleted_by uuid references public.members(id);

-- 2) Audit logs table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_member_id uuid references public.members(id),
  actor_role text,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- 3) Photo metadata columns
alter table public.photos add column if not exists mime_type text;
alter table public.photos add column if not exists file_size_bytes bigint;
alter table public.photos add column if not exists photo_type text;

-- 4) Status and domain constraints alignment
alter table public.members drop constraint if exists chk_members_status;
alter table public.members
  add constraint chk_members_status
  check (status in ('pending','approved','rejected','suspended'));

alter table public.approvals drop constraint if exists chk_approvals_status;
alter table public.approvals
  add constraint chk_approvals_status
  check (status in ('pending','approved','rejected','cancelled'));

alter table public.approvals drop constraint if exists chk_approvals_resource_type;
alter table public.approvals
  add constraint chk_approvals_resource_type
  check (resource_type in ('member','plot','planting_cycle','seed_order','no_burn_request','inspection'));

alter table public.plots drop constraint if exists chk_plots_status;
alter table public.plots
  add constraint chk_plots_status
  check (status in ('active','inactive','pending_review'));

alter table public.planting_cycles drop constraint if exists chk_planting_cycles_status;
alter table public.planting_cycles
  add constraint chk_planting_cycles_status
  check (status in ('planned','growing','completed','cancelled'));

alter table public.seed_orders drop constraint if exists chk_seed_orders_status;
alter table public.seed_orders
  add constraint chk_seed_orders_status
  check (status in ('requested','under_review','approved','rejected','fulfilled','cancelled'));

alter table public.no_burn_requests drop constraint if exists chk_no_burn_requests_status;
alter table public.no_burn_requests
  add constraint chk_no_burn_requests_status
  check (status in ('submitted','under_review','approved','rejected','inspection_required','completed'));

alter table public.inspections drop constraint if exists chk_inspections_result_status;
alter table public.inspections
  add constraint chk_inspections_result_status
  check (result_status in ('pending','assigned','passed','failed','needs_update','completed'));

alter table public.notifications drop constraint if exists chk_notifications_channel;
alter table public.notifications
  add constraint chk_notifications_channel
  check (channel in ('in_app','line_push'));

alter table public.photos drop constraint if exists chk_photos_photo_type;
alter table public.photos
  add constraint chk_photos_photo_type
  check (photo_type is null or photo_type in ('plot','no_burn','inspection','id_card','other'));

-- 5) Existing integrity constraints retained/added
create unique index if not exists uq_member_roles_primary_per_member
on public.member_roles(member_id)
where is_primary = true;

alter table public.plots drop constraint if exists chk_plots_lat_lng_range;
alter table public.plots
  add constraint chk_plots_lat_lng_range
  check (lat between -90 and 90 and lng between -180 and 180);

alter table public.photos drop constraint if exists chk_photos_lat_lng_range;
alter table public.photos
  add constraint chk_photos_lat_lng_range
  check (lat between -90 and 90 and lng between -180 and 180);

alter table public.planting_cycles drop constraint if exists chk_planting_cycles_harvest_after_plant;
alter table public.planting_cycles
  add constraint chk_planting_cycles_harvest_after_plant
  check (expected_harvest_at is null or planted_at is null or expected_harvest_at >= planted_at);

alter table public.inspections drop constraint if exists chk_inspections_visited_after_assigned;
alter table public.inspections
  add constraint chk_inspections_visited_after_assigned
  check (visited_at is null or assigned_at is null or visited_at >= assigned_at);

-- 6) Useful indexes (status, soft-delete, audit)
create index if not exists idx_member_roles_role on public.member_roles(role);
create index if not exists idx_members_status on public.members(status);
create index if not exists idx_members_deleted_at on public.members(deleted_at);

create index if not exists idx_plots_status on public.plots(status);
create index if not exists idx_plots_deleted_at on public.plots(deleted_at);

create index if not exists idx_cycles_member_status on public.planting_cycles(member_id, status);
create index if not exists idx_cycles_deleted_at on public.planting_cycles(deleted_at);

create index if not exists idx_seed_orders_member_status on public.seed_orders(member_id, status);
create index if not exists idx_seed_orders_deleted_at on public.seed_orders(deleted_at);

create index if not exists idx_no_burn_member_status on public.no_burn_requests(member_id, status);
create index if not exists idx_no_burn_deleted_at on public.no_burn_requests(deleted_at);

create index if not exists idx_inspections_plot on public.inspections(plot_id);
create index if not exists idx_inspections_no_burn_request on public.inspections(no_burn_request_id);
create index if not exists idx_inspections_deleted_at on public.inspections(deleted_at);

create index if not exists idx_photos_plot on public.photos(plot_id);
create index if not exists idx_photos_no_burn_request on public.photos(no_burn_request_id);
create index if not exists idx_photos_inspection on public.photos(inspection_id);
create index if not exists idx_photos_photo_type on public.photos(photo_type);
create index if not exists idx_photos_deleted_at on public.photos(deleted_at);

create index if not exists idx_notifications_member_unread on public.notifications(member_id, read_at);

create index if not exists idx_audit_logs_resource on public.audit_logs(resource_type, resource_id);
create index if not exists idx_audit_logs_actor_created_at on public.audit_logs(actor_member_id, created_at);
