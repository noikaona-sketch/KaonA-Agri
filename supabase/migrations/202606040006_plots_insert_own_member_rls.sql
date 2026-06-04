-- Fix member plot inserts without broadening plots RLS.
-- Members may insert only their own plot and must stamp created_by as themselves.

alter table public.plots enable row level security;

drop policy if exists plots_insert_own_member on public.plots;

create policy plots_insert_own_member
  on public.plots
  as restrictive
  for insert
  to authenticated
  with check (
    member_id = public.current_member_id()
    and created_by = public.current_member_id()
  );
