-- เพิ่ม moisture_pct และ price_type ใน market_prices
-- moisture_pct: ความชื้น เช่น 30.0 = ข้าวโพดสด, 14.5 = ข้าวโพดแห้งมาตรฐาน
-- price_type: 'market' = ราคาประกาศ, 'member' = ราคาสมาชิก KaonA

alter table public.market_prices
  add column if not exists moisture_pct numeric(5,1) default null,
  add column if not exists price_type   text        not null default 'market'
    check (price_type in ('market','member'));

comment on column public.market_prices.moisture_pct is 'ความชื้น % เช่น 30.0 หรือ 14.5';
comment on column public.market_prices.price_type   is 'market=ราคาประกาศ, member=ราคาสมาชิก';

-- backfill: ราคาเดิมเป็น market ทั้งหมด (default แล้ว)
-- seed ราคาข้าวโพด 2 ชนิดความชื้น (ถ้ายังไม่มี)
insert into public.market_prices (crop_type, price_per_kg, moisture_pct, price_type, effective_date, note, is_active)
values
  ('ข้าวโพด', 8.00, 30.0,  'market', current_date, 'ราคาประกาศ ความชื้น 30%',   true),
  ('ข้าวโพด', 8.50, 14.5,  'market', current_date, 'ราคาประกาศ ความชื้น 14.5%', true)
on conflict do nothing;
