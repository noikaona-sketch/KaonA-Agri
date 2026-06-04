-- Plot admin workflow and safe unassigned plot ownership.
-- - Admin/field staff can create unassigned plots.
-- - Farmer self-created plots still require own member_id + created_by.
-- - Approval status is constrained to the new review flow while legacy values remain readable.

alter table public.plots
  alter column member_id drop not null,
  alter column created_by drop not null,
  alter column lat drop default,
  alter column lng drop default;

alter table public.plots drop constraint if exists chk_plots_status;
alter table public.plots
  add constraint chk_plots_status
  check (status in ('pending_review','verified','approved','rejected','active','inactive'));

create index if not exists idx_plots_member_id on public.plots(member_id);
create index if not exists idx_plots_pending_review
  on public.plots(created_at desc)
  where deleted_at is null and status in ('pending_review','verified');

alter table public.plots enable row level security;

drop policy if exists plots_crud_own_or_admin_staff on public.plots;
drop policy if exists plots_insert_own_member on public.plots;
drop policy if exists plots_read_auth on public.plots;

-- Farmers can read and maintain only their assigned own plots.
-- Admin/staff can review all plots, including unassigned plots.
create policy plots_select_own_or_admin_staff
  on public.plots for select
  to authenticated
  using (
    (member_id is not null and member_id = public.current_member_id())
    or public.current_member_is_admin_or_staff()
  );

create policy plots_insert_own_member
  on public.plots for insert
  to authenticated
  with check (
    member_id = public.current_member_id()
    and created_by = public.current_member_id()
    and status = 'pending_review'
  );

create policy plots_insert_admin_staff
  on public.plots for insert
  to authenticated
  with check (public.current_member_is_admin_or_staff());

create policy plots_update_own_non_approval
  on public.plots for update
  to authenticated
  using (member_id = public.current_member_id())
  with check (
    member_id = public.current_member_id()
    and created_by = public.current_member_id()
    and status = 'pending_review'
  );

create policy plots_update_admin_staff
  on public.plots for update
  to authenticated
  using (public.current_member_is_admin_or_staff())
  with check (public.current_member_is_admin_or_staff());

create policy plots_delete_admin_staff
  on public.plots for delete
  to authenticated
  using (public.current_member_is_admin_or_staff());
