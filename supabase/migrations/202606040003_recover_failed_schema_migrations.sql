-- Migration: recover failed schema migrations against the currently deployed schema
-- ─────────────────────────────────────────────────────────────────────────────
-- The deployed database already has legacy tables such as:
--   profiles, farmers, planting_cycles, seed_varieties,
--   no_burn_applications, field_inspections
-- but not the newer members/no_burn_requests/inspections tables assumed by some
-- earlier migrations. Keep this migration idempotent and data-preserving.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- 1) Create farm_activity_logs with a valid owner FK in the current schema.
-- App writes/reads farm_activity_logs.member_id from the same runtime member/farmer
-- identity used by planting_cycles.member_id. Prefer the existing FK target of
-- planting_cycles.member_id when it points at farmers/profiles, then fall back to
-- farmers before profiles for partially constrained legacy databases.
do $$
declare
  owner_table text;
  owner_id_type text;
  cycle_id_type text;
begin
  if to_regclass('public.farm_activity_logs') is null then
    if to_regclass('public.planting_cycles') is not null then
      select c.confrelid::regclass::text
        into owner_table
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any(c.conkey)
      where c.conrelid = 'public.planting_cycles'::regclass
        and c.contype = 'f'
        and a.attname = 'member_id'
        and c.confrelid in (to_regclass('public.farmers'), to_regclass('public.profiles'))
      order by case c.confrelid::regclass::text
        when 'public.farmers' then 1
        when 'public.profiles' then 2
        else 3
      end
      limit 1;
    end if;

    if owner_table is null and to_regclass('public.farmers') is not null then
      owner_table := 'public.farmers';
    elsif owner_table is null and to_regclass('public.profiles') is not null then
      owner_table := 'public.profiles';
    end if;

    if owner_table is null then
      raise notice 'Skipping public.farm_activity_logs: neither public.farmers nor public.profiles exists';
    elsif to_regclass('public.planting_cycles') is null then
      raise notice 'Skipping public.farm_activity_logs: public.planting_cycles does not exist';
    else
      select format_type(a.atttypid, a.atttypmod)
        into owner_id_type
      from pg_attribute a
      where a.attrelid = owner_table::regclass
        and a.attname = 'id'
        and not a.attisdropped;

      select format_type(a.atttypid, a.atttypmod)
        into cycle_id_type
      from pg_attribute a
      where a.attrelid = 'public.planting_cycles'::regclass
        and a.attname = 'id'
        and not a.attisdropped;

      if owner_id_type is null or cycle_id_type is null then
        raise notice 'Skipping public.farm_activity_logs: required id column is missing';
      else
        execute format($create$
          create table if not exists public.farm_activity_logs (
            id                  uuid primary key default gen_random_uuid(),
            planting_cycle_id   %s not null references public.planting_cycles(id) on delete cascade,
            member_id           %s not null references %s(id) on delete cascade,
            plot_id             uuid,
            activity_type       text not null check (activity_type in (
              'water', 'fertilize', 'growth_check', 'pest_found',
              'disease_found', 'heavy_rain', 'other', 'plant', 'check',
              'pest_check', 'harvest'
            )),
            note                text,
            plant_height_cm     numeric(6,1),
            growth_stage        text,
            pest_name           text,
            severity            text check (severity in ('low','medium','high') or severity is null),
            gps_lat             numeric(10,7),
            gps_lng             numeric(10,7),
            alert_sent          boolean not null default false,
            recorded_at         timestamptz not null default now(),
            created_at          timestamptz not null default now()
          )
        $create$, cycle_id_type, owner_id_type, owner_table);
      end if;
    end if;
  end if;
end $$;

-- If the table already existed from a partial/manual recovery, add only missing
-- compatible columns and a non-destructive owner FK.
do $$
declare
  owner_table text;
  owner_id_type text;
  cycle_id_type text;
begin
  if to_regclass('public.farm_activity_logs') is not null then
    if to_regclass('public.planting_cycles') is not null then
      select c.confrelid::regclass::text
        into owner_table
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any(c.conkey)
      where c.conrelid = 'public.planting_cycles'::regclass
        and c.contype = 'f'
        and a.attname = 'member_id'
        and c.confrelid in (to_regclass('public.farmers'), to_regclass('public.profiles'))
      order by case c.confrelid::regclass::text
        when 'public.farmers' then 1
        when 'public.profiles' then 2
        else 3
      end
      limit 1;
    end if;

    if owner_table is null and to_regclass('public.farmers') is not null then
      owner_table := 'public.farmers';
    elsif owner_table is null and to_regclass('public.profiles') is not null then
      owner_table := 'public.profiles';
    end if;

    if to_regclass('public.planting_cycles') is not null then
      select format_type(a.atttypid, a.atttypmod)
        into cycle_id_type
      from pg_attribute a
      where a.attrelid = 'public.planting_cycles'::regclass
        and a.attname = 'id'
        and not a.attisdropped;

      if cycle_id_type is not null then
        execute format('alter table public.farm_activity_logs add column if not exists planting_cycle_id %s', cycle_id_type);
      end if;
    end if;

    if owner_table is not null then
      select format_type(a.atttypid, a.atttypmod)
        into owner_id_type
      from pg_attribute a
      where a.attrelid = owner_table::regclass
        and a.attname = 'id'
        and not a.attisdropped;

      if owner_id_type is not null then
        execute format('alter table public.farm_activity_logs add column if not exists member_id %s', owner_id_type);

        if exists (
          select 1
          from pg_attribute a
          where a.attrelid = 'public.farm_activity_logs'::regclass
            and a.attname = 'member_id'
            and format_type(a.atttypid, a.atttypmod) = owner_id_type
            and not a.attisdropped
        ) and not exists (
          select 1
          from pg_constraint
          where conrelid = 'public.farm_activity_logs'::regclass
            and conname = 'farm_activity_logs_member_id_current_schema_fkey'
        ) then
          execute format(
            'alter table public.farm_activity_logs add constraint farm_activity_logs_member_id_current_schema_fkey foreign key (member_id) references %s(id) on delete cascade not valid',
            owner_table
          );
        end if;
      end if;
    end if;

    alter table public.farm_activity_logs
      add column if not exists plot_id uuid,
      add column if not exists activity_type text,
      add column if not exists note text,
      add column if not exists plant_height_cm numeric(6,1),
      add column if not exists growth_stage text,
      add column if not exists pest_name text,
      add column if not exists severity text,
      add column if not exists gps_lat numeric(10,7),
      add column if not exists gps_lng numeric(10,7),
      add column if not exists alert_sent boolean not null default false,
      add column if not exists recorded_at timestamptz not null default now(),
      add column if not exists created_at timestamptz not null default now();
  end if;
end $$;

do $$
begin
  if to_regclass('public.farm_activity_logs') is not null then
    create index if not exists idx_farm_activity_cycle
      on public.farm_activity_logs(planting_cycle_id, recorded_at desc);

    create index if not exists idx_farm_activity_member
      on public.farm_activity_logs(member_id, recorded_at desc);

    create index if not exists idx_farm_activity_alert_pending
      on public.farm_activity_logs(activity_type, alert_sent)
      where activity_type in ('pest_found','disease_found') and alert_sent = false;
  end if;
end $$;

-- 2) Add timing to the existing no_burn_applications table (not no_burn_requests).
do $$
begin
  if to_regclass('public.no_burn_applications') is not null then
    alter table public.no_burn_applications
      add column if not exists timing text
        check (timing in ('before_planting', 'after_planting') or timing is null)
        default 'after_planting';

    comment on column public.no_burn_applications.timing is
      'before_planting = pledge before crop is in ground; after_planting = already planted';
  end if;
end $$;

do $$
begin
  if to_regclass('public.no_burn_applications') is not null then
    create index if not exists idx_no_burn_applications_timing
      on public.no_burn_applications(timing)
      where timing is not null;
  end if;
end $$;

-- 3) Add GPS columns to the existing field_inspections table (not inspections).
do $$
begin
  if to_regclass('public.field_inspections') is not null then
    alter table public.field_inspections
      add column if not exists gps_lat numeric(10,7),
      add column if not exists gps_lng numeric(10,7),
      add column if not exists gps_accuracy numeric(10,2),
      add column if not exists inspector_submitted_at timestamptz;

    comment on column public.field_inspections.gps_lat is
      'Inspector GPS latitude captured at time of field visit';
    comment on column public.field_inspections.gps_lng is
      'Inspector GPS longitude captured at time of field visit';
    comment on column public.field_inspections.inspector_submitted_at is
      'When the inspector submitted the result';
  end if;
end $$;

-- 4) Create crop_care_defaults if missing.
create table if not exists public.crop_care_defaults (
  id            uuid primary key default gen_random_uuid(),
  crop_type     text not null unique,
  care_schedule jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now()
);

comment on table public.crop_care_defaults is
  'Default crop care schedules used as fallback when a seed variety has no schedule';

insert into public.crop_care_defaults (crop_type, care_schedule)
select seed.crop_type, seed.care_schedule
from (values
  ('ข้าวโพด', '[
    {"day":0, "activity":"plant", "label":"วันปลูก", "icon":"🌱"},
    {"day":20, "activity":"pest_check", "label":"เฝ้าระวังหนอนกระทู้", "icon":"🐛", "warning_days":1},
    {"day":22, "activity":"fertilize", "label":"ปุ๋ยรอบ 1", "icon":"🌿", "warning_days":2},
    {"day":42, "activity":"fertilize", "label":"ปุ๋ยรอบ 2", "icon":"🌿", "warning_days":2},
    {"day":105, "activity":"harvest", "label":"เก็บเกี่ยว", "icon":"🌽", "warning_days":3}
  ]'::jsonb),
  ('ข้าว', '[
    {"day":0, "activity":"plant", "label":"วันปักดำ/หว่าน", "icon":"🌱"},
    {"day":15, "activity":"fertilize", "label":"ปุ๋ยรอบ 1", "icon":"🌿"},
    {"day":45, "activity":"fertilize", "label":"ปุ๋ยรอบ 2", "icon":"🌿"},
    {"day":110, "activity":"harvest", "label":"เก็บเกี่ยว", "icon":"✅"}
  ]'::jsonb)
) as seed(crop_type, care_schedule)
where not exists (
  select 1
  from public.crop_care_defaults existing
  where existing.crop_type = seed.crop_type
);

-- 5) Add care_schedule to seed_varieties.
do $$
begin
  if to_regclass('public.seed_varieties') is not null then
    alter table public.seed_varieties
      add column if not exists care_schedule jsonb default '[]'::jsonb;

    comment on column public.seed_varieties.care_schedule is
      'Crop care schedule [{day,activity,label,icon,note,warning_days}]';
  end if;
end $$;

-- 6) Add scheduled columns only after farm_activity_logs exists.
do $$
begin
  if to_regclass('public.farm_activity_logs') is not null then
    alter table public.farm_activity_logs
      add column if not exists scheduled_day int,
      add column if not exists reminder_due_at timestamptz,
      add column if not exists reminder_sent boolean not null default false,
      add column if not exists is_scheduled boolean not null default false;

    comment on column public.farm_activity_logs.reminder_due_at is
      'When the system should remind the farmer to perform this activity';
    comment on column public.farm_activity_logs.is_scheduled is
      'true when generated from a care_schedule template';
  end if;
end $$;

do $$
begin
  if to_regclass('public.farm_activity_logs') is not null then
    create index if not exists idx_farm_activity_reminder
      on public.farm_activity_logs(reminder_due_at, reminder_sent)
      where reminder_due_at is not null and reminder_sent = false;
  end if;
end $$;

do $$
begin
  if to_regclass('public.farm_activity_logs') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.farm_activity_logs'::regclass
         and conname = 'farm_activity_logs_cycle_scheduled_day_unique'
     )
     and not exists (
       select 1
       from public.farm_activity_logs
       where scheduled_day is not null
       group by planting_cycle_id, scheduled_day
       having count(*) > 1
     ) then
    alter table public.farm_activity_logs
      add constraint farm_activity_logs_cycle_scheduled_day_unique
      unique (planting_cycle_id, scheduled_day);
  end if;
end $$;
