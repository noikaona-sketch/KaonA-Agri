-- Migration: member_groups + member_group_members
-- กลุ่มสมาชิก (optional — มีหรือไม่มีก็ได้)

create table if not exists public.member_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.members(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.member_groups(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  added_by uuid not null references public.members(id),
  created_at timestamptz not null default now(),
  unique (group_id, member_id)
);

-- updated_at trigger
create trigger trg_member_groups_updated_at
before update on public.member_groups
for each row execute function public.set_updated_at();

-- indexes
create index if not exists idx_member_groups_created_by
  on public.member_groups(created_by)
  where deleted_at is null;

create index if not exists idx_member_group_members_group
  on public.member_group_members(group_id);

create index if not exists idx_member_group_members_member
  on public.member_group_members(member_id);

-- RLS
alter table public.member_groups enable row level security;
alter table public.member_group_members enable row level security;

-- groups: admin/staff/field เห็นทั้งหมด, farmer/leader เห็นเฉพาะกลุ่มตัวเอง
create policy member_groups_select
on public.member_groups for select
using (
  deleted_at is null
  and (
    public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
    or public.current_member_has_role('leader')
    or exists (
      select 1 from public.member_group_members mgm
      where mgm.group_id = id
        and mgm.member_id = public.current_member_id()
    )
  )
);

-- groups: admin/staff สร้างได้
create policy member_groups_insert
on public.member_groups for insert
with check (
  public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('leader')
);

-- groups: admin/staff แก้ไขได้
create policy member_groups_update
on public.member_groups for update
using (
  public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or created_by = public.current_member_id()
);

-- group members: เห็นตามสิทธิ์กลุ่ม
create policy member_group_members_select
on public.member_group_members for select
using (
  public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('leader')
  or member_id = public.current_member_id()
);

-- group members: admin/staff/leader เพิ่มสมาชิกในกลุ่มได้
create policy member_group_members_insert
on public.member_group_members for insert
with check (
  public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('leader')
);

-- group members: admin/staff/leader ลบออกจากกลุ่มได้
create policy member_group_members_delete
on public.member_group_members for delete
using (
  public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('leader')
);
