-- Issue #10: Supabase RLS policies + updated_at triggers

create or replace function public.is_admin_or_service_account()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.member_roles mr
    where mr.member_id = auth.uid()
      and mr.role in ('admin', 'service_account')
  );
$$;

create or replace function public.can_access_member(target_member_id uuid)
returns boolean
language sql
stable
as $$
  select
    target_member_id = auth.uid()
    or public.is_admin_or_service_account();
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_members_set_updated_at on public.members;
create trigger trg_members_set_updated_at
before update on public.members
for each row
execute function public.set_updated_at();

drop trigger if exists trg_approvals_set_updated_at on public.approvals;
create trigger trg_approvals_set_updated_at
before update on public.approvals
for each row
execute function public.set_updated_at();

drop trigger if exists trg_plots_set_updated_at on public.plots;
create trigger trg_plots_set_updated_at
before update on public.plots
for each row
execute function public.set_updated_at();

drop trigger if exists trg_planting_cycles_set_updated_at on public.planting_cycles;
create trigger trg_planting_cycles_set_updated_at
before update on public.planting_cycles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_seed_orders_set_updated_at on public.seed_orders;
create trigger trg_seed_orders_set_updated_at
before update on public.seed_orders
for each row
execute function public.set_updated_at();

drop trigger if exists trg_no_burn_requests_set_updated_at on public.no_burn_requests;
create trigger trg_no_burn_requests_set_updated_at
before update on public.no_burn_requests
for each row
execute function public.set_updated_at();

drop trigger if exists trg_inspections_set_updated_at on public.inspections;
create trigger trg_inspections_set_updated_at
before update on public.inspections
for each row
execute function public.set_updated_at();

alter table public.members enable row level security;
alter table public.member_roles enable row level security;
alter table public.approvals enable row level security;
alter table public.plots enable row level security;
alter table public.planting_cycles enable row level security;
alter table public.seed_orders enable row level security;
alter table public.no_burn_requests enable row level security;
alter table public.inspections enable row level security;
alter table public.photos enable row level security;
alter table public.notifications enable row level security;

create policy members_select_own_or_admin
on public.members
for select
using (public.can_access_member(id));

create policy members_update_own_or_admin
on public.members
for update
using (public.can_access_member(id))
with check (public.can_access_member(id));

create policy member_roles_select_own_or_admin
on public.member_roles
for select
using (public.can_access_member(member_id));

create policy approvals_select_in_scope
on public.approvals
for select
using (
  public.can_access_member(member_id)
  or public.can_access_member(requested_by)
  or (reviewed_by is not null and public.can_access_member(reviewed_by))
);

create policy approvals_insert_requester_or_admin
on public.approvals
for insert
with check (
  requested_by = auth.uid()
  or public.is_admin_or_service_account()
);

create policy approvals_update_reviewer_or_admin
on public.approvals
for update
using (
  requested_by = auth.uid()
  or reviewed_by = auth.uid()
  or public.is_admin_or_service_account()
)
with check (
  requested_by = auth.uid()
  or reviewed_by = auth.uid()
  or public.is_admin_or_service_account()
);

create policy plots_crud_own_or_admin
on public.plots
for all
using (public.can_access_member(member_id))
with check (
  public.can_access_member(member_id)
  and (created_by = auth.uid() or public.is_admin_or_service_account())
);

create policy planting_cycles_crud_own_or_admin
on public.planting_cycles
for all
using (public.can_access_member(member_id))
with check (
  public.can_access_member(member_id)
  and (created_by = auth.uid() or public.is_admin_or_service_account())
);

create policy seed_orders_crud_own_or_admin
on public.seed_orders
for all
using (
  public.can_access_member(member_id)
  or (reviewed_by is not null and reviewed_by = auth.uid())
)
with check (
  public.can_access_member(member_id)
  or public.is_admin_or_service_account()
);

create policy no_burn_requests_crud_own_or_admin
on public.no_burn_requests
for all
using (
  public.can_access_member(member_id)
  or (reviewed_by is not null and reviewed_by = auth.uid())
)
with check (
  public.can_access_member(member_id)
  or public.is_admin_or_service_account()
);

create policy inspections_read_assigned_or_admin
on public.inspections
for select
using (
  inspector_member_id = auth.uid()
  or public.is_admin_or_service_account()
);

create policy inspections_modify_assigned_or_admin
on public.inspections
for all
using (
  inspector_member_id = auth.uid()
  or public.is_admin_or_service_account()
)
with check (
  inspector_member_id = auth.uid()
  or public.is_admin_or_service_account()
);

create policy photos_crud_own_or_admin
on public.photos
for all
using (
  public.can_access_member(member_id)
  or uploaded_by = auth.uid()
)
with check (
  public.can_access_member(member_id)
  and (uploaded_by = auth.uid() or public.is_admin_or_service_account())
);

create policy notifications_read_own_or_admin
on public.notifications
for select
using (public.can_access_member(member_id));

create policy notifications_insert_admin
on public.notifications
for insert
with check (public.is_admin_or_service_account());

create policy notifications_update_own_or_admin
on public.notifications
for update
using (public.can_access_member(member_id))
with check (public.can_access_member(member_id));
