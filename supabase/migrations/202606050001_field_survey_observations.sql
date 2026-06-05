-- Migration: field_survey_observations
-- บันทึกการสำรวจภาคสนามโดย staff/inspector
-- ไม่จำเป็นต้องระบุสมาชิก — สำรวจพื้นที่อิสระ
-- ถ้าระบุ member_id/plot_id ได้ → link และ confirm ได้

create table if not exists public.field_survey_observations (
  id                uuid        primary key default gen_random_uuid(),

  -- ผู้บันทึก (staff/inspector)
  observer_id       uuid        not null references public.members(id) on delete restrict,

  -- optional link to member/plot/cycle (ถ้าระบุได้)
  member_id         uuid        references public.members(id)          on delete set null,
  plot_id           uuid        references public.plots(id)            on delete set null,
  planting_cycle_id uuid        references public.planting_cycles(id)  on delete set null,

  -- พิกัด GPS ณ จุดสำรวจ (required)
  lat               numeric(10,7) not null,
  lng               numeric(10,7) not null,
  accuracy          numeric(8,2),

  -- ข้อมูลพืช
  crop_type         text        not null default 'corn'
                    check (crop_type in ('corn','rice','cassava','sugarcane','other')),
  crop_type_note    text,                          -- ถ้า other
  estimated_age_days int,                          -- อายุโดยประมาณ (วัน)
  estimated_area_rai numeric(8,2),                 -- พื้นที่โดยประมาณ (ไร่)
  growth_stage      text        check (growth_stage in (
    'germination','seedling','vegetative','tasseling',
    'silking','grain_fill','maturity','harvest_ready','other'
  )),

  -- สถานะพืช
  plant_condition   text        check (plant_condition in (
    'healthy','stressed','pest_damage','disease','drought','flood','other'
  )),
  condition_note    text,

  -- บันทึกทั่วไป
  note              text,

  -- สถานะ confirmation
  -- unconfirmed = สำรวจอิสระ, confirmed = ยืนยันว่าเป็นของสมาชิก
  confirmation_status text not null default 'unconfirmed'
    check (confirmation_status in ('unconfirmed','confirmed','rejected')),
  confirmed_by      uuid        references public.members(id) on delete set null,
  confirmed_at      timestamptz,

  -- timestamps
  observed_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Indexes
create index if not exists idx_fso_observer   on public.field_survey_observations(observer_id, observed_at desc);
create index if not exists idx_fso_member     on public.field_survey_observations(member_id, observed_at desc);
create index if not exists idx_fso_plot       on public.field_survey_observations(plot_id);
create index if not exists idx_fso_gps        on public.field_survey_observations(lat, lng);
create index if not exists idx_fso_status     on public.field_survey_observations(confirmation_status);
create index if not exists idx_fso_observed   on public.field_survey_observations(observed_at desc);

-- Photos link: photos table already has a generic fk pattern
-- We'll store survey photos via storage path in a survey_photos junction
create table if not exists public.field_survey_photos (
  id              uuid        primary key default gen_random_uuid(),
  observation_id  uuid        not null references public.field_survey_observations(id) on delete cascade,
  storage_path    text        not null,
  caption         text,
  lat             numeric(10,7),
  lng             numeric(10,7),
  taken_at        timestamptz,
  uploaded_by     uuid        not null references public.members(id) on delete restrict,
  created_at      timestamptz not null default now()
);

create index if not exists idx_fsp_observation on public.field_survey_photos(observation_id);

-- RLS
alter table public.field_survey_observations enable row level security;
alter table public.field_survey_photos       enable row level security;

-- Staff/inspector can insert/select their own observations
create policy "staff can insert observations"
  on public.field_survey_observations for insert
  with check (observer_id = current_member_id());

create policy "staff can read observations"
  on public.field_survey_observations for select
  using (true);  -- all approved members can read (for map display)

create policy "observer can update own"
  on public.field_survey_observations for update
  using (observer_id = current_member_id());

-- Photos
create policy "staff can insert photos"
  on public.field_survey_photos for insert
  with check (uploaded_by = current_member_id());

create policy "anyone can read photos"
  on public.field_survey_photos for select
  using (true);
