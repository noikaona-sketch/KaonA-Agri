-- Follow-up: force plots.status constraint to match the app enum exactly.
-- This is intentionally separate from 202606040010 so staging/production that
-- already applied the earlier migration also receive the corrected constraint.

alter table public.plots drop constraint if exists chk_plots_status;

update public.plots
set status = case
  when status = 'active' then 'approved'
  when status in ('pending', 'pending_approval', 'pending_review') then 'pending_review'
  when status = 'verified' then 'verified'
  when status = 'approved' then 'approved'
  when status = 'rejected' then 'rejected'
  when status in ('cancelled', 'hidden') then 'cancelled'
  when status = 'inactive' then 'inactive'
  else 'pending_review'
end;

alter table public.plots
  alter column status set default 'pending_review';

alter table public.plots
  add constraint chk_plots_status
  check (status in ('pending_review','verified','approved','rejected','cancelled','inactive'));
