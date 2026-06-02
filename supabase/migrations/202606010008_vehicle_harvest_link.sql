-- Migration: เชื่อม harvest_bookings → provider_vehicle
-- เพื่อให้สรุปคุณภาพข้าวโพดต่อรถคันได้

-- ─── 1. เพิ่ม columns ใน harvest_bookings ────────────────────────────────────
alter table public.harvest_bookings
  add column if not exists provider_vehicle_id uuid,
  add column if not exists provider_id         uuid;

-- FK ไปหา service_providers (สร้างใน migration ก่อนหน้า)
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'harvest_bookings_provider_vehicle_id_fkey'
  ) then
    alter table public.harvest_bookings
      add constraint harvest_bookings_provider_vehicle_id_fkey
        foreign key (provider_vehicle_id) references public.provider_vehicles(id) on delete set null;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'harvest_bookings_provider_id_fkey'
  ) then
    alter table public.harvest_bookings
      add constraint harvest_bookings_provider_id_fkey
        foreign key (provider_id) references public.service_providers(id) on delete set null;
  end if;
end $$;

-- ─── 2. Rating: เพิ่ม link ถึง vehicle ระดับคัน ──────────────────────────────
alter table public.service_provider_ratings
  add column if not exists provider_vehicle_id uuid,
  add column if not exists service_booking_id  uuid;

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'ratings_provider_vehicle_id_fkey'
  ) then
    alter table public.service_provider_ratings
      add constraint ratings_provider_vehicle_id_fkey
        foreign key (provider_vehicle_id) references public.provider_vehicles(id) on delete set null;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'ratings_service_booking_id_fkey'
  ) then
    alter table public.service_provider_ratings
      add constraint ratings_service_booking_id_fkey
        foreign key (service_booking_id) references public.service_bookings(id) on delete set null;
  end if;
end $$;

-- ─── 3. Indexes ────────────────────────────────────────────────────────────────
create index if not exists idx_harvest_bookings_vehicle
  on public.harvest_bookings(provider_vehicle_id)
  where provider_vehicle_id is not null;

create index if not exists idx_ratings_vehicle
  on public.service_provider_ratings(provider_vehicle_id)
  where provider_vehicle_id is not null;

-- ─── 4. View: vehicle_harvest_summary ─────────────────────────────────────────
create or replace view public.vehicle_harvest_summary as
select
  pv.id                                        as vehicle_id,
  pv.provider_id,
  pv.vehicle_type,
  pv.brand,
  pv.plate_number,
  sp.team_name                                 as provider_name,
  sp.phone                                     as provider_phone,
  count(hb.id)                                 as total_jobs,
  count(hb.id) filter (where hb.status = 'completed') as completed_jobs,
  sum(hb.actual_received_kg) filter (where hb.status = 'completed') as total_kg,
  count(*) filter (where hb.quality_grade = 'A') as grade_a_count,
  count(*) filter (where hb.quality_grade = 'B') as grade_b_count,
  count(*) filter (where hb.quality_grade = 'C') as grade_c_count,
  count(*) filter (where hb.quality_grade = 'reject') as grade_reject_count,
  round(avg(hb.quality_moisture) filter (where hb.quality_moisture is not null), 2) as avg_moisture,
  round(
    count(*) filter (where hb.quality_grade = 'A')::numeric
    / nullif(count(*) filter (where hb.quality_grade is not null), 0) * 100
  , 1)                                          as grade_a_pct,
  round(avg(r.score_total), 2)                  as avg_rating,
  round(avg(r.score_punctuality), 2)            as avg_punctuality,
  round(avg(r.score_quality), 2)                as avg_quality,
  round(avg(r.score_loss), 2)                   as avg_loss,
  count(r.id)                                   as rating_count,
  max(hb.actual_completed_at)                   as last_job_at
from public.provider_vehicles pv
join public.service_providers sp on sp.id = pv.provider_id
left join public.harvest_bookings hb on hb.provider_vehicle_id = pv.id
left join public.service_provider_ratings r on r.provider_vehicle_id = pv.id
group by pv.id, pv.provider_id, pv.vehicle_type, pv.brand,
         pv.plate_number, sp.team_name, sp.phone;

grant select on public.vehicle_harvest_summary to authenticated, service_role;
