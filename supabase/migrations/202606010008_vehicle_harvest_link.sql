-- Migration: เชื่อม harvest_bookings → provider_vehicle
-- เพื่อให้สรุปคุณภาพข้าวโพดต่อรถคันได้

alter table public.harvest_bookings
  add column if not exists provider_vehicle_id uuid
    references public.provider_vehicles(id) on delete set null,
  add column if not exists provider_id uuid
    references public.service_providers(id) on delete set null;

-- Rating: เพิ่ม link ถึง vehicle ระดับคัน
alter table public.service_provider_ratings
  add column if not exists provider_vehicle_id uuid
    references public.provider_vehicles(id) on delete set null,
  add column if not exists service_booking_id uuid
    references public.service_bookings(id) on delete set null;

create index if not exists idx_harvest_bookings_vehicle
  on public.harvest_bookings(provider_vehicle_id)
  where provider_vehicle_id is not null;

create index if not exists idx_ratings_vehicle
  on public.service_provider_ratings(provider_vehicle_id)
  where provider_vehicle_id is not null;

-- View: vehicle_harvest_summary — สรุปต่อคันรถ
create or replace view public.vehicle_harvest_summary as
select
  pv.id                                        as vehicle_id,
  pv.provider_id,
  pv.vehicle_type,
  pv.brand,
  pv.plate_number,
  sp.team_name                                 as provider_name,
  sp.phone                                     as provider_phone,
  -- จำนวนงาน
  count(hb.id)                                 as total_jobs,
  count(hb.id) filter (where hb.status = 'completed') as completed_jobs,
  -- น้ำหนักรวม
  sum(hb.actual_received_kg) filter (where hb.status = 'completed') as total_kg,
  -- คุณภาพ
  count(*) filter (where hb.quality_grade = 'A') as grade_a_count,
  count(*) filter (where hb.quality_grade = 'B') as grade_b_count,
  count(*) filter (where hb.quality_grade = 'C') as grade_c_count,
  count(*) filter (where hb.quality_grade = 'reject') as grade_reject_count,
  round(avg(hb.quality_moisture) filter (where hb.quality_moisture is not null), 2) as avg_moisture,
  -- เปอร์เซ็นต์เกรด A (คุณภาพดี)
  round(
    count(*) filter (where hb.quality_grade = 'A')::numeric
    / nullif(count(*) filter (where hb.quality_grade is not null), 0) * 100
  , 1)                                          as grade_a_pct,
  -- Rating จาก service_provider_ratings
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
