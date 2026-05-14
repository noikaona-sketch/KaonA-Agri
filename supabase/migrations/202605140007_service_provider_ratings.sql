-- Service Provider Rating System
-- Extracted concept from K_farm: score-to-grade
-- Extended with: punctuality, quality, loss, cleanliness, safety

create table if not exists public.service_provider_ratings (
  id              uuid primary key default gen_random_uuid(),

  -- ผู้ให้บริการ (truck_owner member)
  provider_member_id uuid not null references public.members(id) on delete cascade,

  -- งานที่ประเมิน
  harvest_booking_id uuid references public.harvest_bookings(id) on delete set null,
  rated_by_member_id uuid references public.members(id) on delete set null,

  -- คะแนน 1-5 แต่ละด้าน
  score_punctuality  smallint check (score_punctuality between 1 and 5),   -- ตรงเวลา
  score_quality      smallint check (score_quality     between 1 and 5),   -- คุณภาพงาน
  score_loss         smallint check (score_loss         between 1 and 5),   -- ความสูญเสีย (5=น้อยมาก)
  score_cleanliness  smallint check (score_cleanliness  between 1 and 5),   -- ความสะอาด
  score_safety       smallint check (score_safety       between 1 and 5),   -- ความปลอดภัย

  -- คำนวณอัตโนมัติ
  score_total        numeric(4,2) generated always as (
    (coalesce(score_punctuality,0) + coalesce(score_quality,0) +
     coalesce(score_loss,0) + coalesce(score_cleanliness,0) +
     coalesce(score_safety,0))::numeric / 5.0
  ) stored,

  -- grade จาก score_total
  grade              text generated always as (
    case
      when (coalesce(score_punctuality,0) + coalesce(score_quality,0) +
            coalesce(score_loss,0) + coalesce(score_cleanliness,0) +
            coalesce(score_safety,0))::numeric / 5.0 >= 4.5 then 'A+'
      when (coalesce(score_punctuality,0) + coalesce(score_quality,0) +
            coalesce(score_loss,0) + coalesce(score_cleanliness,0) +
            coalesce(score_safety,0))::numeric / 5.0 >= 4.0 then 'A'
      when (coalesce(score_punctuality,0) + coalesce(score_quality,0) +
            coalesce(score_loss,0) + coalesce(score_cleanliness,0) +
            coalesce(score_safety,0))::numeric / 5.0 >= 3.5 then 'B+'
      when (coalesce(score_punctuality,0) + coalesce(score_quality,0) +
            coalesce(score_loss,0) + coalesce(score_cleanliness,0) +
            coalesce(score_safety,0))::numeric / 5.0 >= 3.0 then 'B'
      else 'C'
    end
  ) stored,

  note      text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ratings_provider on public.service_provider_ratings(provider_member_id);
create index if not exists idx_ratings_booking  on public.service_provider_ratings(harvest_booking_id);

-- view: สรุปคะแนนรวมต่อ provider
create or replace view public.provider_rating_summary as
select
  m.id                             as member_id,
  m.full_name,
  m.phone,
  count(r.id)                      as total_ratings,
  round(avg(r.score_punctuality),2) as avg_punctuality,
  round(avg(r.score_quality),2)     as avg_quality,
  round(avg(r.score_loss),2)        as avg_loss,
  round(avg(r.score_cleanliness),2) as avg_cleanliness,
  round(avg(r.score_safety),2)      as avg_safety,
  round(avg(r.score_total),2)       as avg_total,
  -- grade จาก avg_total
  case
    when avg(r.score_total) >= 4.5 then 'A+'
    when avg(r.score_total) >= 4.0 then 'A'
    when avg(r.score_total) >= 3.5 then 'B+'
    when avg(r.score_total) >= 3.0 then 'B'
    else 'C'
  end                              as overall_grade,
  max(r.created_at)                as last_rated_at
from public.members m
join public.member_roles mr on mr.member_id = m.id and mr.role = 'truck_owner'
left join public.service_provider_ratings r on r.provider_member_id = m.id
group by m.id, m.full_name, m.phone
order by avg(r.score_total) desc nulls last;

-- RLS
alter table public.service_provider_ratings enable row level security;

create policy ratings_select on public.service_provider_ratings
  for select using (
    provider_member_id = public.current_member_id()
    or rated_by_member_id = public.current_member_id()
    or public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
  );

create policy ratings_insert on public.service_provider_ratings
  for insert with check (
    rated_by_member_id = public.current_member_id()
    or public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
  );
