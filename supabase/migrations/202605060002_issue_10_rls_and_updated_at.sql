-- Issue #10: Supabase RLS policies + updated_at triggers
--
-- Auth mapping assumption for LINE LIFF + Supabase Auth:
-- 1) LINE LIFF identifies users via `members.line_user_id` (LINE identity reference).
-- 2) Supabase Auth identifies users via `auth.uid()`.
-- 3) Each authenticated user must be linked by setting `members.auth_user_id = auth.uid()`.
-- 4) Domain ownership checks in RLS use `members.id` resolved from `auth.uid()`.

alter table public.members
add column if not exists auth_user_id uuid;

create unique index if not exists uq_members_auth_user_id
on public.members(auth_user_id)
where auth_user_id is not null;

create or replace function public.current_member_id()
returns uuid
language sql
stable
as $$
  select m.id
  from public.members m
  where m.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_member_has_role(required_role text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.member_roles mr
    where mr.member_id = public.current_member_id()
      and mr.role = required_role
  );
$$;

create or replace function public.current_member_is_admin_or_staff()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.member_roles mr
    where mr.member_id = public.current_member_id()
      and mr.role in ('admin', 'staff', 'service_account')
  );
$$;

create or replace function public.can_access_member(target_member_id uuid)
returns boolean
language sql
stable
as $$
  select
    target_member_id = public.current_member_id()
    or public.current_member_is_admin_or_staff();
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
for each row execute function public.set_updated_at();

drop trigger if exists trg_approvals_set_updated_at on public.approvals;
create trigger trg_approvals_set_updated_at
before update on public.approvals
for each row execute function public.set_updated_at();

drop trigger if exists trg_plots_set_updated_at on public.plots;
create trigger trg_plots_set_updated_at
before update on public.plots
for each row execute function public.set_updated_at();

drop trigger if exists trg_planting_cycles_set_updated_at on public.planting_cycles;
create trigger trg_planting_cycles_set_updated_at
before update on public.planting_cycles
for each row execute function public.set_updated_at();

drop trigger if exists trg_seed_orders_set_updated_at on public.seed_orders;
create trigger trg_seed_orders_set_updated_at
before update on public.seed_orders
for each row execute function public.set_updated_at();

drop trigger if exists trg_no_burn_requests_set_updated_at on public.no_burn_requests;
create trigger trg_no_burn_requests_set_updated_at
before update on public.no_burn_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_inspections_set_updated_at on public.inspections;
create trigger trg_inspections_set_updated_at
before update on public.inspections
for each row execute function public.set_updated_at();

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

create policy members_select_own_or_admin_staff
on public.members for select
using (public.can_access_member(id));

create policy members_update_own_or_admin_staff
on public.members for update
using (public.can_access_member(id))
with check (public.can_access_member(id));

create policy member_roles_select_own_or_admin_staff
on public.member_roles for select
using (public.can_access_member(member_id));

create policy approvals_select_in_scope
on public.approvals for select
using (
  public.can_access_member(member_id)
  or public.can_access_member(requested_by)
  or (reviewed_by is not null and reviewed_by = public.current_member_id())
);

create policy approvals_insert_requester_or_admin_staff
on public.approvals for insert
with check (
  requested_by = public.current_member_id()
  or public.current_member_is_admin_or_staff()
);

create policy approvals_update_reviewer_or_admin_staff
on public.approvals for update
using (
  requested_by = public.current_member_id()
  or reviewed_by = public.current_member_id()
  or public.current_member_is_admin_or_staff()
)
with check (
  requested_by = public.current_member_id()
  or reviewed_by = public.current_member_id()
  or public.current_member_is_admin_or_staff()
);

create policy plots_crud_own_or_admin_staff
on public.plots for all
using (public.can_access_member(member_id))
with check (
  public.can_access_member(member_id)
  and (created_by = public.current_member_id() or public.current_member_is_admin_or_staff())
);

create policy planting_cycles_crud_own_or_admin_staff
on public.planting_cycles for all
using (public.can_access_member(member_id))
with check (
  public.can_access_member(member_id)
  and (created_by = public.current_member_id() or public.current_member_is_admin_or_staff())
);

create policy seed_orders_crud_own_or_admin_staff
on public.seed_orders for all
using (
  public.can_access_member(member_id)
  or (reviewed_by is not null and reviewed_by = public.current_member_id())
)
with check (
  public.can_access_member(member_id)
  or public.current_member_is_admin_or_staff()
);

create policy no_burn_requests_crud_own_or_admin_staff
on public.no_burn_requests for all
using (
  public.can_access_member(member_id)
  or (reviewed_by is not null and reviewed_by = public.current_member_id())
)
with check (
  public.can_access_member(member_id)
  or public.current_member_is_admin_or_staff()
);

create policy inspections_read_assigned_or_admin_staff
on public.inspections for select
using (
  inspector_member_id = public.current_member_id()
  or public.current_member_is_admin_or_staff()
);

create policy inspections_modify_assigned_or_admin_staff
on public.inspections for all
using (
  inspector_member_id = public.current_member_id()
  or public.current_member_is_admin_or_staff()
)
with check (
  inspector_member_id = public.current_member_id()
  or public.current_member_is_admin_or_staff()
);

create policy photos_crud_own_or_admin_staff
on public.photos for all
using (
  public.can_access_member(member_id)
  or uploaded_by = public.current_member_id()
)
with check (
  public.can_access_member(member_id)
  and (uploaded_by = public.current_member_id() or public.current_member_is_admin_or_staff())
);

create policy notifications_read_own_or_admin_staff
on public.notifications for select
using (public.can_access_member(member_id));

create policy notifications_insert_admin_staff
on public.notifications for insert
with check (public.current_member_is_admin_or_staff());

create policy notifications_update_own_or_admin_staff
on public.notifications for update
using (public.can_access_member(member_id))
with check (public.can_access_member(member_id));
