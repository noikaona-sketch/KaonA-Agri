-- Migration: add updated_at/updated_by to field_visit_logs for admin edit
alter table public.field_visit_logs
  add column if not exists updated_at  timestamptz,
  add column if not exists updated_by  uuid references public.members(id) on delete set null;

-- Admin PATCH policy
drop policy if exists fvl_admin_patch on public.field_visit_logs;
create policy fvl_admin_patch on public.field_visit_logs
  for update using (public.current_member_is_admin_or_staff());
