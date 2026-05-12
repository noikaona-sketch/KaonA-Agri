-- Migration: รถเกี่ยวภายนอก + คุณภาพข้าวโพด + ติดตามรถ

-- ── 1. harvest_bookings: เพิ่ม external truck fields ─────────────────
alter table public.harvest_bookings
  add column if not exists truck_type text
    check (truck_type in ('internal','external'))
    default 'internal',
  add column if not exists external_truck_name text,    -- ชื่อคนขับ/บริษัท
  add column if not exists external_truck_plate text,   -- ทะเบียนรถ
  add column if not exists external_truck_phone text,   -- เบอร์ติดต่อ
  -- ติดตามรถ
  add column if not exists truck_lat numeric(10,7),     -- GPS ล่าสุด
  add column if not exists truck_lng numeric(10,7),
  add column if not exists truck_updated_at timestamptz,
  add column if not exists truck_status text
    check (truck_status in ('waiting','on_way','arrived','loading','done', null)),
  -- ผลการตรวจคุณภาพ
  add column if not exists quality_grade text           -- A/B/C
    check (quality_grade in ('A','B','C','reject', null)),
  add column if not exists quality_moisture numeric(5,2), -- ความชื้น %
  add column if not exists quality_note text;

-- ── 2. seed_quality_grades: คุณภาพตามพันธุ์เมล็ด ─────────────────────
create table if not exists public.seed_quality_grades (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  crop_type text not null,
  seed_variety text not null,

  -- เกณฑ์คุณภาพ
  grade_a_moisture_max numeric(5,2) not null default 14.5,  -- ความชื้นสูงสุด % (เกรด A)
  grade_b_moisture_max numeric(5,2) not null default 18.0,  -- เกรด B
  grade_c_moisture_max numeric(5,2) not null default 25.0,  -- เกรด C

  grade_a_price_premium numeric(5,2) not null default 0,    -- บวกราคา บาท/กก.
  grade_b_price_adjust  numeric(5,2) not null default 0,    -- ปรับราคา (ลบได้)
  grade_c_price_adjust  numeric(5,2) not null default -1.0, -- หักราคา

  -- ลักษณะเมล็ด
  kernel_color text,          -- สีเมล็ด
  kernel_size text,           -- ขนาดเมล็ด
  protein_pct numeric(5,2),   -- % โปรตีน
  starch_pct  numeric(5,2),   -- % แป้ง
  oil_pct     numeric(5,2),   -- % น้ำมัน

  -- ข้อมูลผู้ซื้อ
  buyer_spec text,            -- spec ของผู้รับซื้อ
  reject_criteria text,       -- เกณฑ์ reject

  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quality_grades_product on public.seed_quality_grades(product_id);

create trigger trg_seed_quality_grades_updated_at
before update on public.seed_quality_grades
for each row execute function public.set_updated_at();

-- ── 3. harvest_tracking_log: log GPS รถเกี่ยว ────────────────────────
create table if not exists public.harvest_tracking_log (
  id uuid primary key default gen_random_uuid(),
  harvest_booking_id uuid not null references public.harvest_bookings(id) on delete cascade,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  speed_kmh numeric(5,1),
  recorded_at timestamptz not null default now()
);

create index if not exists idx_tracking_log_booking
  on public.harvest_tracking_log(harvest_booking_id, recorded_at desc);

-- ── 4. function: update truck location ───────────────────────────────
create or replace function public.update_truck_location(
  p_booking_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_speed_kmh numeric default null,
  p_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- update current location
  update public.harvest_bookings
  set
    truck_lat        = p_lat,
    truck_lng        = p_lng,
    truck_updated_at = now(),
    truck_status     = coalesce(p_status, truck_status)
  where id = p_booking_id;

  -- log ทุก point
  insert into public.harvest_tracking_log (harvest_booking_id, lat, lng, speed_kmh)
  values (p_booking_id, p_lat, p_lng, p_speed_kmh);
end;
$$;

grant execute on function public.update_truck_location(uuid, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.update_truck_location(uuid, numeric, numeric, numeric, text) to service_role;

-- ── 5. function: คำนวณ grade จาก moisture ────────────────────────────
create or replace function public.calc_quality_grade(
  p_product_id uuid,
  p_moisture_pct numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_config record;
  v_grade text;
  v_price_adjust numeric;
begin
  select * into v_config
  from public.seed_quality_grades
  where product_id = p_product_id
  limit 1;

  if v_config is null then
    -- default grade
    if p_moisture_pct <= 14.5 then v_grade := 'A'; v_price_adjust := 0;
    elsif p_moisture_pct <= 18.0 then v_grade := 'B'; v_price_adjust := 0;
    elsif p_moisture_pct <= 25.0 then v_grade := 'C'; v_price_adjust := -1;
    else v_grade := 'reject'; v_price_adjust := null;
    end if;
  else
    if p_moisture_pct <= v_config.grade_a_moisture_max then
      v_grade := 'A'; v_price_adjust := v_config.grade_a_price_premium;
    elsif p_moisture_pct <= v_config.grade_b_moisture_max then
      v_grade := 'B'; v_price_adjust := v_config.grade_b_price_adjust;
    elsif p_moisture_pct <= v_config.grade_c_moisture_max then
      v_grade := 'C'; v_price_adjust := v_config.grade_c_price_adjust;
    else
      v_grade := 'reject'; v_price_adjust := null;
    end if;
  end if;

  return jsonb_build_object(
    'grade', v_grade,
    'price_adjust', v_price_adjust,
    'moisture_pct', p_moisture_pct,
    'is_acceptable', v_grade != 'reject'
  );
end;
$$;

grant execute on function public.calc_quality_grade(uuid, numeric) to authenticated;
grant execute on function public.calc_quality_grade(uuid, numeric) to service_role;

-- ── 6. view: harvest_bookings_full ───────────────────────────────────
create or replace view public.harvest_bookings_full as
select
  hb.id,
  hb.planting_cycle_id,
  hb.member_id,
  hb.scheduled_date,
  hb.scheduled_time_start,
  hb.scheduled_time_end,
  hb.status,
  hb.truck_type,
  hb.truck_status,
  hb.truck_lat,
  hb.truck_lng,
  hb.truck_updated_at,
  hb.actual_date,
  hb.actual_yield_kg,
  hb.quality_grade,
  hb.quality_moisture,
  hb.quality_note,
  hb.note,
  -- สมาชิก
  m.full_name as member_name,
  m.phone     as member_phone,
  -- แปลง
  pl.name     as plot_name,
  pl.lat      as plot_lat,
  pl.lng      as plot_lng,
  pl.province as plot_province,
  -- รอบปลูก
  pc.crop_name,
  pc.planted_at,
  pc.expected_harvest_at,
  pc.area_planted_rai,
  pc.estimated_yield_kg,
  pc.quota_kg,
  -- รถในระบบ
  tm.full_name as truck_member_name,
  tm.phone     as truck_member_phone,
  -- รถภายนอก
  hb.external_truck_name,
  hb.external_truck_plate,
  hb.external_truck_phone,
  -- คุณภาพตามพันธุ์
  sgq.grade_a_moisture_max,
  sgq.grade_b_moisture_max,
  sgq.buyer_spec,
  p.name  as product_name,
  p.brand as product_brand,
  p.seed_variety
from public.harvest_bookings hb
join public.members m on m.id = hb.member_id
join public.planting_cycles pc on pc.id = hb.planting_cycle_id
join public.plots pl on pl.id = coalesce(hb.plot_id, pc.plot_id)
left join public.members tm on tm.id = hb.truck_member_id
left join public.products p on p.id = pc.product_id
left join public.seed_quality_grades sgq on sgq.product_id = p.id;

-- ── 7. RLS ───────────────────────────────────────────────────────────
alter table public.seed_quality_grades enable row level security;
alter table public.harvest_tracking_log enable row level security;

create policy quality_grades_select on public.seed_quality_grades for select using (true);
create policy quality_grades_manage on public.seed_quality_grades for all using (
  public.current_member_has_role('admin') or public.current_member_has_role('staff')
);

create policy tracking_log_select on public.harvest_tracking_log for select using (
  public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or exists (
    select 1 from public.harvest_bookings hb
    where hb.id = harvest_booking_id
      and (hb.member_id = public.current_member_id()
        or hb.truck_member_id = public.current_member_id())
  )
);

create policy tracking_log_insert on public.harvest_tracking_log for insert
with check (
  exists (
    select 1 from public.harvest_bookings hb
    where hb.id = harvest_booking_id
      and (hb.truck_member_id = public.current_member_id()
        or public.current_member_has_role('admin'))
  )
);
