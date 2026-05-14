-- แก้: เพิ่ม columns ที่ order_items ต้องการ
-- (migration 202605130003 อาจ fail เพราะ seed_stock_lots ยังไม่มีตอน run)

alter table public.order_items
  add column if not exists lot_id         uuid,
  add column if not exists variety_id     uuid,
  add column if not exists stock_deducted boolean not null default false;

-- เพิ่ม FK หลังจากที่ table มีอยู่แล้ว
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'order_items_lot_id_fkey'
  ) then
    alter table public.order_items
      add constraint order_items_lot_id_fkey
      foreign key (lot_id) references public.seed_stock_lots(id) on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'order_items_variety_id_fkey'
  ) then
    alter table public.order_items
      add constraint order_items_variety_id_fkey
      foreign key (variety_id) references public.seed_varieties(id) on delete set null;
  end if;
end;
$$;

-- seed_reservation_seq ถ้ายังไม่มี
create sequence if not exists public.seed_reservation_seq start 1;

-- sale_order_seq ถ้ายังไม่มี
create sequence if not exists public.sale_order_seq start 1;
