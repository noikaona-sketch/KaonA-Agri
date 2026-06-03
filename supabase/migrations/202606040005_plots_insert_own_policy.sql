-- Audit public.plots INSERT behavior without widening access via parallel
-- permissive policies.
--
-- PostgreSQL combines permissive policies for the same command with OR
-- semantics. The original plots_crud_own_or_admin_staff policy already covers
-- INSERT with the required ownership checks, so this migration removes the
-- previously proposed standalone INSERT policy and keeps one consolidated
-- policy for plots.
--
-- Required INSERT rule for member-created plots:
--   member_id = public.current_member_id()
--   and created_by = public.current_member_id()
-- Admin/staff access remains unchanged from the existing CRUD policy.

drop policy if exists plots_insert_own_authenticated on public.plots;
drop policy if exists plots_crud_own_or_admin_staff on public.plots;

create policy plots_crud_own_or_admin_staff
on public.plots for all
using (public.can_access_member(member_id))
with check (
  public.can_access_member(member_id)
  and (created_by = public.current_member_id() or public.current_member_is_admin_or_staff())
);
