-- เพิ่ม warehouse_id ใน sale_orders (สำหรับ cashier session)
alter table public.sale_orders
  add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null;

-- เพิ่ม variety_id ใน order_items (สำหรับ POS ขายเมล็ดพันธุ์)
alter table public.order_items
  add column if not exists variety_id uuid references public.seed_varieties(id) on delete set null,
  add column if not exists product_name text;

-- index
create index if not exists idx_sale_orders_warehouse on public.sale_orders(warehouse_id, created_at);
