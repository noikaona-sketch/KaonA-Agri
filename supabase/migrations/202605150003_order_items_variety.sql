-- order_items.product_id ต้อง nullable เพราะ POS ขายเมล็ดพันธุ์ (variety) โดยตรง
alter table public.order_items
  alter column product_id drop not null;

-- เพิ่ม lot_no สำหรับบันทึก LOT ที่ขาย
alter table public.order_items
  add column if not exists lot_no text;

-- เพิ่ม pickup_slot_id สำหรับการจอง
alter table public.sale_orders
  add column if not exists pickup_slot_id uuid references public.pickup_slots(id) on delete set null,
  add column if not exists note text;

-- check ต้องมี product_id หรือ variety_id อย่างน้อย 1 อย่าง
alter table public.order_items
  drop constraint if exists chk_order_item_product_or_variety;

alter table public.order_items
  add constraint chk_order_item_product_or_variety check (
    product_id is not null or variety_id is not null
  );
