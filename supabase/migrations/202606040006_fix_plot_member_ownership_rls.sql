-- Fix recurring plot ownership visibility/insert issues.
--
-- Invariant:
--   * Farmer sessions insert only plots owned by their resolved members.id.
--   * Farmer sessions select only their own non-deleted plots.
--   * Admin/staff/service_account sessions keep cross-member plot access.
--   * RLS remains enabled; service_role is not required on the client.
--
-- This replaces the previous broad FOR ALL plot policy with command-specific
-- policies so INSERT checks are explicit and SELECT does not accidentally depend
-- on UPDATE/DELETE semantics.

alter table public.plots enable row level security;

drop policy if exists plots_read_auth on public.plots;
drop policy if exists plots_crud_own_or_admin_staff on public.plots;
drop policy if exists plots_select_own_or_admin_staff on public.plots;
drop policy if exists plots_insert_own_or_admin_staff on public.plots;
drop policy if exists plots_update_own_or_admin_staff on public.plots;
drop policy if exists plots_delete_own_or_admin_staff on public.plots;

create policy plots_select_own_or_admin_staff
on public.plots
for select
using (
  deleted_at is null
  and (
    member_id = public.current_member_id()
    or public.current_member_is_admin_or_staff()
  )
);

create policy plots_insert_own_or_admin_staff
on public.plots
for insert
with check (
  (
    member_id = public.current_member_id()
    and created_by = public.current_member_id()
  )
  or public.current_member_is_admin_or_staff()
);

create policy plots_update_own_or_admin_staff
on public.plots
for update
using (
  member_id = public.current_member_id()
  or public.current_member_is_admin_or_staff()
)
with check (
  member_id = public.current_member_id()
  or public.current_member_is_admin_or_staff()
);

create policy plots_delete_own_or_admin_staff
on public.plots
for delete
using (
  member_id = public.current_member_id()
  or public.current_member_is_admin_or_staff()
);
