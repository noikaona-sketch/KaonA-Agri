-- Issue #27: Member registration MVP flow
-- Security notes:
-- 1) This function is SECURITY DEFINER to allow safe inserts for authenticated users who do not yet match existing RLS ownership checks.
-- 2) The function identity source is auth.uid(); client must not provide auth_user_id.
-- 3) line_user_id must come from verified LIFF/auth exchange metadata, not from a local fallback value.

create or replace function public.register_member_mvp(
  p_line_user_id text,
  p_full_name text,
  p_phone text,
  p_citizen_id_masked text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_auth_user_id uuid;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(trim(p_line_user_id), '') = '' then
    raise exception 'line_user_id is required';
  end if;

  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'full_name is required';
  end if;

  if coalesce(trim(p_citizen_id_masked), '') = '' then
    raise exception 'citizen_id_masked is required';
  end if;

  select m.id into v_member_id
  from public.members m
  where m.auth_user_id = v_auth_user_id
  limit 1;

  if v_member_id is not null then
    return v_member_id;
  end if;

  insert into public.members (auth_user_id, line_user_id, full_name, phone, citizen_id_masked, status)
  values (v_auth_user_id, p_line_user_id, p_full_name, p_phone, p_citizen_id_masked, 'pending')
  returning id into v_member_id;

  insert into public.member_roles (member_id, role, is_primary)
  values (v_member_id, 'farmer', true)
  on conflict (member_id, role) do nothing;

  return v_member_id;
end;
$$;

grant execute on function public.register_member_mvp(text, text, text, text) to authenticated;
