-- แก้ไข moisture_deductions: เปลี่ยนจาก "หักราคา" เป็น "บวกราคา"
-- ความชื้นต่ำ = ราคาสูงขึ้น (price_adjust_per_kg เป็นบวกเสมอ)

alter table public.moisture_deductions
  rename column price_deduct_per_kg to price_adjust_per_kg;

comment on column public.moisture_deductions.price_adjust_per_kg
  is 'บวกเพิ่มจากราคาฐาน บาท/กก. เช่น 0.30 = ได้ราคาฐาน + 0.30';

-- อัปเดต seed: ยิ่งความชื้นต่ำ บวกมากขึ้น
update public.moisture_deductions set price_adjust_per_kg = 0.00 where moisture_pct = 30.0;
update public.moisture_deductions set price_adjust_per_kg = 0.10 where moisture_pct = 28.0;
update public.moisture_deductions set price_adjust_per_kg = 0.30 where moisture_pct = 25.0;
update public.moisture_deductions set price_adjust_per_kg = 0.50 where moisture_pct = 22.0;
update public.moisture_deductions set price_adjust_per_kg = 0.70 where moisture_pct = 18.0;
update public.moisture_deductions set price_adjust_per_kg = 1.00 where moisture_pct = 14.5;
