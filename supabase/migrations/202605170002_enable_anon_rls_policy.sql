-- Enable anonymous sign-ins ใน Supabase Dashboard:
-- Authentication → Settings → Anonymous sign-ins → Enable

-- RLS policy: ให้ anon user อ่าน/แก้ member ของตัวเองผ่าน auth_user_id
-- (ทำงานเมื่อ client มี valid session จาก setSession)

-- members: read own row
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'members' and policyname = 'members_read_own_by_auth_user'
  ) then
    execute $p$
      create policy members_read_own_by_auth_user
        on public.members for select
        using (auth_user_id = auth.uid())
    $p$;
  end if;
end $$;

-- members: update own row
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'members' and policyname = 'members_update_own_by_auth_user'
  ) then
    execute $p$
      create policy members_update_own_by_auth_user
        on public.members for update
        using  (auth_user_id = auth.uid())
        with check (auth_user_id = auth.uid())
    $p$;
  end if;
end $$;
