-- Issue #29: Admin approval queue for member onboarding

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

  select m.id into v_member_id from public.members m where m.auth_user_id = v_auth_user_id limit 1;

  if v_member_id is not null then
    return v_member_id;
  end if;

  insert into public.members (auth_user_id, line_user_id, full_name, phone, citizen_id_masked, status)
  values (v_auth_user_id, p_line_user_id, p_full_name, p_phone, p_citizen_id_masked, 'pending')
  returning id into v_member_id;

  insert into public.member_roles (member_id, role, is_primary)
  values (v_member_id, 'farmer', true)
  on conflict (member_id, role) do nothing;

  insert into public.approvals (member_id, requested_by, resource_type, resource_id, status, note)
  values (v_member_id, v_member_id, 'member', v_member_id, 'pending', 'Member onboarding request')
  on conflict do nothing;

  return v_member_id;
end;
$$;

grant execute on function public.register_member_mvp(text, text, text, text) to authenticated;

create or replace function public.list_member_onboarding_queue()
returns table (
  approval_id uuid,
  member_id uuid,
  full_name text,
  phone text,
  citizen_id_masked text,
  requested_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select a.id, m.id, m.full_name, m.phone, m.citizen_id_masked, a.created_at
  from public.approvals a
  join public.members m on m.id = a.member_id
  join public.members reviewer on reviewer.auth_user_id = auth.uid()
  join public.member_roles reviewer_role on reviewer_role.member_id = reviewer.id and reviewer_role.role in ('admin', 'staff')
  where a.resource_type = 'member'
    and a.status = 'pending'
    and m.status = 'pending'
  order by a.created_at asc;
$$;

grant execute on function public.list_member_onboarding_queue() to authenticated;

create or replace function public.review_member_onboarding(
  p_approval_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer_member_id uuid;
  v_target_member_id uuid;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected';
  end if;

  select id into v_reviewer_member_id from public.members where auth_user_id = auth.uid() limit 1;

  if v_reviewer_member_id is null then
    raise exception 'member context required';
  end if;

  if not exists (
    select 1 from public.member_roles
    where member_id = v_reviewer_member_id and role in ('admin', 'staff')
  ) then
    raise exception 'admin or staff role required';
  end if;

  select a.member_id into v_target_member_id
  from public.approvals a
  where a.id = p_approval_id
    and a.resource_type = 'member'
    and a.status = 'pending'
  for update;

  if v_target_member_id is null then
    raise exception 'pending approval not found';
  end if;

  update public.approvals
  set status = p_decision,
      reviewed_by = v_reviewer_member_id,
      updated_at = now()
  where id = p_approval_id;

  update public.members
  set status = p_decision,
      updated_at = now()
  where id = v_target_member_id;
end;
$$;

grant execute on function public.review_member_onboarding(uuid, text) to authenticated;
