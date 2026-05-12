-- Migration: RPC functions + views สำหรับ farming lifecycle

-- ── 1. function: คำนวณประมาณการณ์ผลผลิต ─────────────────────────────
create or replace function public.calc_estimated_yield(
  p_crop_type text,
  p_area_rai numeric,
  p_seed_qty_kg numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_config record;
  v_yield_from_area  numeric;
  v_yield_from_seed  numeric;
  v_estimated_yield  numeric;
  v_quota_kg         numeric;
  v_price_per_kg     numeric;
  v_estimated_revenue numeric;
begin
  -- หา config ของพืชนี้
  select * into v_config
  from public.crop_yield_config
  where crop_type = p_crop_type
  limit 1;

  if v_config is null then
    -- fallback default
    v_config.yield_per_rai    := 1200;
    v_config.quota_per_seed_kg := 600;
    v_config.seed_to_yield_ratio := 600;
  end if;

  -- คำนวณจาก 2 วิธี ใช้ค่าที่น้อยกว่า (conservative)
  v_yield_from_area := coalesce(p_area_rai, 0) * v_config.yield_per_rai;
  v_yield_from_seed := coalesce(p_seed_qty_kg, 0) * v_config.seed_to_yield_ratio;

  -- ถ้ามีทั้งคู่ใช้ค่าต่ำกว่า, ถ้ามีแค่อย่างเดียวใช้อย่างนั้น
  if p_area_rai > 0 and p_seed_qty_kg > 0 then
    v_estimated_yield := least(v_yield_from_area, v_yield_from_seed);
  elsif p_area_rai > 0 then
    v_estimated_yield := v_yield_from_area;
  else
    v_estimated_yield := v_yield_from_seed;
  end if;

  -- โควต้า = เมล็ด × quota_per_seed_kg
  v_quota_kg := coalesce(p_seed_qty_kg, 0) * v_config.quota_per_seed_kg;

  -- ราคาปัจจุบัน
  select price_per_kg into v_price_per_kg
  from public.market_prices
  where crop_type = p_crop_type
    and is_active = true
  order by effective_date desc
  limit 1;

  v_estimated_revenue := v_estimated_yield * coalesce(v_price_per_kg, 0);

  return jsonb_build_object(
    'estimated_yield_kg',    round(v_estimated_yield, 2),
    'quota_kg',              round(v_quota_kg, 2),
    'yield_per_rai',         v_config.yield_per_rai,
    'yield_from_area_kg',    round(v_yield_from_area, 2),
    'yield_from_seed_kg',    round(v_yield_from_seed, 2),
    'price_per_kg',          coalesce(v_price_per_kg, 0),
    'estimated_revenue_thb', round(v_estimated_revenue, 2)
  );
end;
$$;

grant execute on function public.calc_estimated_yield(text, numeric, numeric) to authenticated;
grant execute on function public.calc_estimated_yield(text, numeric, numeric) to service_role;

-- ── 2. function: สร้างนัดขาย ─────────────────────────────────────────
create or replace function public.create_sale_appointment(
  p_planting_cycle_id uuid,
  p_estimated_qty_kg  numeric,
  p_appointment_date  date,
  p_appointment_time  text default null,
  p_location_note     text default null,
  p_note              text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_crop_name text;
  v_price     numeric;
  v_appt_no   text;
  v_appt_id   uuid;
  v_quota_kg  numeric;
  v_used_kg   numeric;
begin
  select m.id into v_member_id
  from public.members m where m.auth_user_id = auth.uid();

  if v_member_id is null then
    raise exception 'Authentication required';
  end if;

  -- ดึงข้อมูล planting_cycle
  select crop_name, quota_kg
  into v_crop_name, v_quota_kg
  from public.planting_cycles
  where id = p_planting_cycle_id
    and member_id = v_member_id;

  if v_crop_name is null then
    raise exception 'ไม่พบข้อมูลรอบการปลูก';
  end if;

  -- ตรวจโควต้าที่ใช้ไปแล้ว
  select coalesce(sum(estimated_qty_kg), 0) into v_used_kg
  from public.sale_appointments
  where planting_cycle_id = p_planting_cycle_id
    and status not in ('cancelled');

  if v_quota_kg is not null and (v_used_kg + p_estimated_qty_kg) > v_quota_kg then
    raise exception 'เกินโควต้า: คงเหลือ % กก.', (v_quota_kg - v_used_kg);
  end if;

  -- ราคาปัจจุบัน
  select price_per_kg into v_price
  from public.market_prices
  where crop_type = v_crop_name and is_active = true
  order by effective_date desc limit 1;

  if v_price is null then v_price := 0; end if;

  -- เลขที่นัด
  v_appt_no := 'SA-' || to_char(now() at time zone 'Asia/Bangkok', 'YYYY') || '-' ||
               lpad(nextval('public.sale_appointment_seq')::text, 5, '0');

  insert into public.sale_appointments (
    appointment_number, planting_cycle_id, member_id,
    estimated_qty_kg, quota_remaining_kg,
    price_per_kg, appointment_date, appointment_time,
    location_note, status, note
  ) values (
    v_appt_no, p_planting_cycle_id, v_member_id,
    p_estimated_qty_kg, coalesce(v_quota_kg - v_used_kg - p_estimated_qty_kg, null),
    v_price, p_appointment_date, p_appointment_time,
    p_location_note, 'scheduled', p_note
  ) returning id into v_appt_id;

  return jsonb_build_object(
    'appointment_id',     v_appt_id,
    'appointment_number', v_appt_no,
    'price_per_kg',       v_price,
    'estimated_amount',   p_estimated_qty_kg * v_price
  );
end;
$$;

grant execute on function public.create_sale_appointment(uuid, numeric, date, text, text, text) to authenticated;

-- ── 3. view: farming_map_view ─────────────────────────────────────────
-- ใช้แสดงบน map ทุกแปลงที่กำลังปลูก
create or replace view public.farming_map_view as
select
  pc.id as cycle_id,
  pc.member_id,
  m.full_name as member_name,
  pc.crop_name,
  pc.season_year,
  pc.status,
  pc.planted_at,
  pc.expected_harvest_at,
  pc.actual_harvest_at,
  pc.area_planted_rai,
  pc.estimated_yield_kg,
  pc.actual_yield_kg,
  pc.quota_kg,
  pc.seed_qty_used,
  -- วันที่คาดเก็บเกี่ยว (จาก planted_at + days_to_harvest ของสินค้า)
  case
    when pc.expected_harvest_at is not null then pc.expected_harvest_at
    when pc.planted_at is not null and p.days_to_harvest is not null then
      pc.planted_at + p.days_to_harvest
    else null
  end as harvest_date_estimated,
  -- จำนวนวันถึงเก็บเกี่ยว
  case
    when pc.expected_harvest_at is not null then
      (pc.expected_harvest_at - current_date)
    when pc.planted_at is not null and p.days_to_harvest is not null then
      (pc.planted_at + p.days_to_harvest - current_date)
    else null
  end as days_to_harvest,
  -- ราคาปัจจุบัน
  mp.price_per_kg,
  -- ประมาณการรายได้
  coalesce(pc.estimated_yield_kg, 0) * coalesce(mp.price_per_kg, 0) as estimated_revenue,
  -- พิกัดแปลง
  pl.lat,
  pl.lng,
  pl.name as plot_name,
  pl.area_rai as plot_area_rai,
  pl.province,
  -- สีตาม status สำหรับ map
  case
    when pc.status in ('harvested','completed') then 'grey'
    when pc.expected_harvest_at <= current_date + 14
      or (pc.planted_at + coalesce(p.days_to_harvest, 999)) <= current_date + 14 then 'red'
    when pc.expected_harvest_at <= current_date + 30
      or (pc.planted_at + coalesce(p.days_to_harvest, 999)) <= current_date + 30 then 'orange'
    when pc.status in ('planted','growing','flowering','maturing') then 'green'
    else 'blue'
  end as map_color
from public.planting_cycles pc
join public.members m on m.id = pc.member_id
join public.plots pl on pl.id = pc.plot_id
left join public.products p on p.id = pc.product_id
left join lateral (
  select price_per_kg from public.market_prices
  where crop_type = pc.crop_name and is_active = true
  order by effective_date desc limit 1
) mp on true
where pc.status not in ('cancelled')
  and pl.lat is not null
  and pl.lng is not null;

-- ── 4. view: harvest_calendar ─────────────────────────────────────────
-- ภาพรวมปฏิทินเก็บเกี่ยว
create or replace view public.harvest_calendar as
select
  date_trunc('week', harvest_date_estimated) as week_start,
  count(*) as plot_count,
  sum(estimated_yield_kg) as total_estimated_kg,
  sum(estimated_revenue) as total_estimated_revenue,
  array_agg(distinct crop_name) as crop_types,
  array_agg(cycle_id) as cycle_ids
from public.farming_map_view
where harvest_date_estimated is not null
  and harvest_date_estimated between current_date and current_date + interval '180 days'
  and map_color != 'grey'
group by date_trunc('week', harvest_date_estimated)
order by week_start;

-- ── 5. view: member_farm_dashboard ────────────────────────────────────
-- dashboard สมาชิก — สรุปฟาร์มทั้งหมด
create or replace view public.member_farm_dashboard as
select
  pc.member_id,
  count(*) as total_cycles,
  count(*) filter (where pc.status = 'planted')  as planted_count,
  count(*) filter (where pc.status = 'growing')  as growing_count,
  count(*) filter (where pc.status = 'harvested') as harvested_count,
  coalesce(sum(pc.area_planted_rai), 0) as total_area_rai,
  coalesce(sum(pc.estimated_yield_kg), 0) as total_estimated_yield_kg,
  coalesce(sum(pc.actual_yield_kg), 0) as total_actual_yield_kg,
  coalesce(sum(pc.quota_kg), 0) as total_quota_kg,
  min(case when pc.status not in ('harvested','cancelled')
    then coalesce(pc.expected_harvest_at, pc.planted_at + 90)
    else null
  end) as next_harvest_date
from public.planting_cycles pc
where pc.status not in ('cancelled')
group by pc.member_id;
