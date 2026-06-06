-- บันทึกการวิเคราะห์รูปแปลงด้วย AI
create table if not exists public.crop_photo_analyses (
  id                uuid        primary key default gen_random_uuid(),
  member_id         uuid        not null references public.members(id) on delete cascade,
  planting_cycle_id uuid        references public.planting_cycles(id) on delete set null,
  plot_id           uuid        references public.plots(id)           on delete set null,

  -- รูปภาพ
  storage_path      text        not null,

  -- context ที่สมาชิกเลือก
  activity_context  text,   -- 'watering','pest_found','general','fertilizing','growth_check'

  -- ข้อมูลรอบปลูก ณ เวลาที่ถ่าย (snapshot)
  crop_name         text,
  age_days          int,    -- อายุข้าวโพด ณ วันที่ถ่าย
  planted_at        date,

  -- ผล AI
  ai_grade          text,   -- 'great','good','warning','alert'
  ai_summary        text,   -- ประโยคสรุปสั้น (ใช้แสดงใน card)
  ai_full_response  text,   -- response เต็มจาก AI

  -- metadata
  analyzed_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists idx_cpa_member   on public.crop_photo_analyses(member_id, analyzed_at desc);
create index if not exists idx_cpa_cycle    on public.crop_photo_analyses(planting_cycle_id, analyzed_at desc);

alter table public.crop_photo_analyses enable row level security;

drop policy if exists "member can insert own" on public.crop_photo_analyses;
create policy "member can insert own" on public.crop_photo_analyses
  for insert with check (member_id = current_member_id());

drop policy if exists "member can read own" on public.crop_photo_analyses;
create policy "member can read own" on public.crop_photo_analyses
  for select using (member_id = current_member_id());

drop policy if exists "admin can read all" on public.crop_photo_analyses;
create policy "admin can read all" on public.crop_photo_analyses
  for select using (public.current_member_is_admin_or_staff());

