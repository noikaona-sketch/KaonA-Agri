-- Issue #15: Auth session bootstrap + role loading helpers
-- Provides deterministic effective-role resolution from DB after Supabase session is established.

create or replace function public.role_priority(role_name text)
returns int
language sql
immutable
as $$
  select case role_name
    when 'admin' then 1
    when 'staff' then 2
    when 'inspector' then 3
    when 'leader' then 4
    when 'truck_owner' then 5
    when 'farmer' then 6
    when 'service_account' then 7
    else 999
  end;
$$;

create or replace function public.current_member_effective_role()
returns text
language sql
stable
as $$
  select mr.role
  from public.member_roles mr
  join public.members m on m.id = mr.member_id
  where m.auth_user_id = auth.uid()
  order by
    mr.is_primary desc,
    public.role_priority(mr.role),
    mr.created_at,
    mr.id
  limit 1;
$$;

create or replace function public.bootstrap_auth_session()
returns table (
  member_id uuid,
  auth_user_id uuid,
  line_user_id text,
  status text,
  effective_role text,
  roles text[]
)
language sql
stable
as $$
  with me as (
    select m.id, m.auth_user_id, m.line_user_id, m.status
    from public.members m
    where m.auth_user_id = auth.uid()
    limit 1
  ), role_rows as (
    select mr.member_id, mr.role, mr.is_primary, mr.created_at, mr.id
    from public.member_roles mr
    join me on me.id = mr.member_id
  )
  select
    me.id as member_id,
    me.auth_user_id,
    me.line_user_id,
    me.status,
    (
      select rr.role
      from role_rows rr
      order by rr.is_primary desc, public.role_priority(rr.role), rr.created_at, rr.id
      limit 1
    ) as effective_role,
    coalesce(
      (
        select array_agg(rr.role order by public.role_priority(rr.role), rr.created_at, rr.id)
        from role_rows rr
      ),
      array[]::text[]
    ) as roles
  from me;
$$;
