-- Issue #29: Admin approval queue for member onboarding

create unique index if not exists uq_approvals_member_pending
on public.approvals(member_id, resource_type, resource_id)
where status = 'pending';


create or replace function public.create_member_onboarding_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.approvals (member_id, requested_by, resource_type, resource_id, status, note)
    values (new.id, new.id, 'member', new.id, 'pending', 'Member onboarding request')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_create_member_onboarding_approval on public.members;

create trigger trg_create_member_onboarding_approval
after insert on public.members
for each row
execute function public.create_member_onboarding_approval();

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
  v_reviewer_role text := 'admin/staff';
  v_target_member_id uuid;
  v_old_approval_status text;
  v_old_member_status text;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected';
  end if;

  select m.id into v_reviewer_member_id
  from public.members m
  where m.auth_user_id = auth.uid()
  limit 1;

  if v_reviewer_member_id is null then
    raise exception 'member context required';
  end if;

  if not exists (
    select 1 from public.member_roles
    where member_id = v_reviewer_member_id and role in ('admin', 'staff')
  ) then
    raise exception 'admin or staff role required';
  end if;

  select role into v_reviewer_role
  from public.member_roles
  where member_id = v_reviewer_member_id and role in ('admin', 'staff')
  order by case when role = 'admin' then 0 else 1 end
  limit 1;

  select a.member_id, a.status, m.status
    into v_target_member_id, v_old_approval_status, v_old_member_status
  from public.approvals a
  join public.members m on m.id = a.member_id
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

  insert into public.audit_logs (
    actor_member_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data
  )
  values (
    v_reviewer_member_id,
    coalesce(v_reviewer_role, 'admin/staff'),
    case when p_decision = 'approved' then 'member.approve' else 'member.reject' end,
    'member',
    v_target_member_id,
    jsonb_build_object('approval_status', v_old_approval_status, 'member_status', v_old_member_status),
    jsonb_build_object('approval_status', p_decision, 'member_status', p_decision)
  );
end;
$$;

grant execute on function public.review_member_onboarding(uuid, text) to authenticated;
