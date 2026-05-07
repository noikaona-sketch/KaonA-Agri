-- Issue #27: Member registration MVP flow
-- Allow authenticated users without member records to register themselves as pending farmer.

create or replace function public.register_member_mvp(
  p_auth_user_id uuid,
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() <> p_auth_user_id then
    raise exception 'auth_user_id mismatch';
  end if;

  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'full_name is required';
  end if;

  if coalesce(trim(p_citizen_id_masked), '') = '' then
    raise exception 'citizen_id_masked is required';
  end if;

  select m.id into v_member_id
  from public.members m
  where m.auth_user_id = p_auth_user_id
  limit 1;

  if v_member_id is not null then
    return v_member_id;
  end if;

  insert into public.members (auth_user_id, line_user_id, full_name, phone, citizen_id_masked, status)
  values (p_auth_user_id, p_line_user_id, p_full_name, p_phone, p_citizen_id_masked, 'pending')
  returning id into v_member_id;

  insert into public.member_roles (member_id, role, is_primary)
  values (v_member_id, 'farmer', true)
  on conflict (member_id, role) do nothing;

  return v_member_id;
end;
$$;

grant execute on function public.register_member_mvp(uuid, text, text, text, text) to authenticated;
