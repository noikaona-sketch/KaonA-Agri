-- Ensure approved LINE members can create their own plot rows through normal
-- authenticated Supabase sessions while keeping RLS enabled.
--
-- The application now sends member_id and created_by from the verified
-- members.auth_user_id -> auth.uid() mapping instead of accepting either value
-- from the browser form payload. This policy documents and enforces that
-- relationship at the database boundary for direct inserts.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'plots'
      and policyname = 'plots_insert_own_authenticated'
  ) then
    create policy plots_insert_own_authenticated
      on public.plots
      for insert
      to authenticated
      with check (
        member_id = public.current_member_id()
        and created_by = public.current_member_id()
      );
  end if;
end $$;
