-- Migration: field_visit_logs
-- บันทึกการเยี่ยมแปลง/พบสมาชิกโดยทีมภาคสนาม

create table if not exists public.field_visit_logs (
  id              uuid        primary key default gen_random_uuid(),
  member_id       uuid        not null references public.members(id) on delete cascade,
  staff_member_id uuid        not null references public.members(id) on delete cascade,
  plot_id         uuid        references public.plots(id) on delete set null,
  planting_season_id uuid     references public.planting_seasons(id) on delete set null,

  -- วัตถุประสงค์
  visit_purpose   text        not null check (visit_purpose in (
    'follow_up',      -- ติดตามการปลูก
    'no_burn_advice', -- แนะนำไม่เผา
    'soil_check',     -- ตรวจสภาพดิน
    'pest_advice',    -- แนะนำศัตรูพืช
    'registration',   -- ลงทะเบียนสมาชิก
    'problem_solve',  -- แก้ปัญหา
    'other'           -- อื่นๆ
  )),
  visit_purpose_note text,    -- รายละเอียดถ้าเป็น other

  -- สิ่งที่พบและบันทึก
  note            text,       -- สรุปสิ่งที่พูดคุย
  follow_up       text,       -- สิ่งที่ต้องติดตามต่อ

  -- GPS ณ จุดที่พบ
  gps_lat         numeric(10,7),
  gps_lng         numeric(10,7),
  gps_accuracy    numeric(8,2),

  visited_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_field_visit_member
  on public.field_visit_logs(member_id, visited_at desc);

create index if not exists idx_field_visit_staff
  on public.field_visit_logs(staff_member_id, visited_at desc);

create index if not exists idx_field_visit_gps
  on public.field_visit_logs(gps_lat, gps_lng)
  where gps_lat is not null and gps_lng is not null;

-- Photos ใช้ photos table เดิม (photo_type = 'field_visit')
do $$ begin
  alter table public.photos drop constraint if exists chk_photos_photo_type;
  alter table public.photos add constraint chk_photos_photo_type
    check (photo_type is null or photo_type in (
      'plot','no_burn','inspection','id_card','other',
      'soil_cert','soil_lab','field_visit'
    ));
exception when others then null;
end $$;

-- เพิ่ม field_visit_log_id ใน photos
alter table public.photos
  add column if not exists field_visit_log_id uuid
    references public.field_visit_logs(id) on delete set null;

-- RLS
alter table public.field_visit_logs enable row level security;

drop policy if exists fvl_staff_own on public.field_visit_logs;
create policy fvl_staff_own on public.field_visit_logs
  for all using (
    staff_member_id in (
      select id from public.members where auth_user_id = auth.uid()
    )
  );

drop policy if exists fvl_admin_all on public.field_visit_logs;
create policy fvl_admin_all on public.field_visit_logs
  for all using (public.current_member_is_admin_or_staff());
