-- Migration: ระบบเครดิต + วงจรการปลูกครบ + แจ้งเตือน

-- ── 1. member_credit_accounts ────────────────────────────────────────
-- ยอดค้างชำระ (debit_account) ตัดตอนตอนขาย
create table if not exists public.member_credit_accounts (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null unique references public.members(id) on delete cascade,
  balance       numeric(14,2) not null default 0,  -- ยอดเครดิตคงเหลือ (บวก = มีเครดิต)
  debit_balance numeric(14,2) not null default 0,  -- ยอดค้างชำระ (บวก = ค้างอยู่)
  total_spent   numeric(14,2) not null default 0,
  total_paid    numeric(14,2) not null default 0,
  last_activity timestamptz,
  updated_at    timestamptz not null default now()
);

create trigger trg_credit_accounts_updated_at
before update on public.member_credit_accounts
for each row execute function public.set_updated_at();

-- ── 2. credit_transactions ────────────────────────────────────────────
create table if not exists public.credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  txn_type    text not null check (txn_type in (
    'order',          -- ตัดจากคำสั่ง
    'payment',        -- ชำระหนี้
    'credit_add',     -- admin เพิ่มเครดิต
    'credit_refund',  -- คืนเครดิต
    'adjust'          -- ปรับยอด
  )),
  amount      numeric(14,2) not null,   -- บวก=เพิ่ม ลบ=ตัด
  balance_after numeric(14,2) not null,
  ref_type    text,
  ref_id      uuid,
  note        text,
  created_by  uuid references public.members(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_credit_txn_member on public.credit_transactions(member_id, created_at desc);

-- ── 3. function: process_order_credit ─────────────────────────────────
-- ตัดยอดเครดิต หรือบันทึกค้างชำระ เมื่อสั่งซื้อ
create or replace function public.process_order_credit(
  p_member_id   uuid,
  p_amount      numeric,
  p_order_id    uuid,
  p_payment_method text  -- 'credit' | 'debit_account' | 'cash' | 'transfer'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acct record;
begin
  -- upsert credit account
  insert into public.member_credit_accounts (member_id)
  values (p_member_id)
  on conflict (member_id) do nothing;

  select * into v_acct
  from public.member_credit_accounts
  where member_id = p_member_id
  for update;

  if p_payment_method = 'debit_account' then
    -- ค้างชำระ ตัดตอนตอนขาย
    update public.member_credit_accounts
    set debit_balance  = debit_balance + p_amount,
        total_spent    = total_spent + p_amount,
        last_activity  = now()
    where member_id = p_member_id;

    insert into public.credit_transactions
      (member_id, txn_type, amount, balance_after, ref_type, ref_id, note)
    values
      (p_member_id, 'order', -p_amount, v_acct.balance, 'sale_order', p_order_id, 'ค้างชำระ (debit_account)');

  elsif p_payment_method = 'credit' then
    if v_acct.balance < p_amount then
      raise exception 'เครดิตไม่เพียงพอ: มี % บาท แต่ต้องการ % บาท', v_acct.balance, p_amount;
    end if;
    update public.member_credit_accounts
    set balance       = balance - p_amount,
        total_spent   = total_spent + p_amount,
        last_activity = now()
    where member_id = p_member_id;

    insert into public.credit_transactions
      (member_id, txn_type, amount, balance_after, ref_type, ref_id)
    values
      (p_member_id, 'order', -p_amount, v_acct.balance - p_amount, 'sale_order', p_order_id);
  end if;
end;
$$;

grant execute on function public.process_order_credit(uuid, numeric, uuid, text) to authenticated;
grant execute on function public.process_order_credit(uuid, numeric, uuid, text) to service_role;

-- ── 4. planting_cycles: เพิ่ม columns สำหรับ lifecycle ───────────────
alter table public.planting_cycles
  add column if not exists source          text default 'manual'
    check (source in ('order','manual')),       -- สร้างจากคำสั่ง หรือ manual
  add column if not exists source_order_id uuid references public.sale_orders(id) on delete set null,
  add column if not exists confirmed_at    timestamptz,           -- วันที่ยืนยันวันปลูกจริง
  add column if not exists reminder_sent_at timestamptz,          -- ส่ง reminder ล่าสุดเมื่อไหร่
  add column if not exists member_note     text;

-- ── 5. function: create_planting_cycle_from_order ─────────────────────
-- สร้าง planting_cycle อัตโนมัติเมื่อสั่งซื้อเมล็ด
create or replace function public.create_planting_cycle_from_order(
  p_order_id    uuid,
  p_member_id   uuid,
  p_product_id  uuid,
  p_seed_qty_kg numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product    record;
  v_config     record;
  v_cycle_id   uuid;
  v_days       int;
  v_yield_kg   numeric;
  v_quota_kg   numeric;
begin
  -- ข้อมูลสินค้า
  select * into v_product from public.products where id = p_product_id;
  if v_product is null then return null; end if;
  if v_product.category != 'seed' then return null; end if;

  -- yield config
  select * into v_config
  from public.crop_yield_config
  where crop_type = coalesce(v_product.crop_type, v_product.name)
  limit 1;

  v_days     := coalesce(v_product.days_to_harvest, 90);
  v_yield_kg := p_seed_qty_kg * coalesce(v_config.seed_to_yield_ratio, 600);
  v_quota_kg := p_seed_qty_kg * coalesce(v_config.quota_per_seed_kg, 600);

  -- สร้าง planting_cycle (ยังไม่ระบุวันปลูก — รอสมาชิกยืนยัน)
  insert into public.planting_cycles (
    member_id, crop_name, season_year, status,
    product_id, seed_qty_used, seed_lot_number,
    estimated_yield_kg, quota_kg,
    source, source_order_id
  ) values (
    p_member_id,
    coalesce(v_product.crop_type, v_product.name),
    extract(year from now())::int + 543,  -- พ.ศ.
    'planned',
    p_product_id,
    p_seed_qty_kg,
    null,
    v_yield_kg,
    v_quota_kg,
    'order',
    p_order_id
  )
  returning id into v_cycle_id;

  return v_cycle_id;
end;
$$;

grant execute on function public.create_planting_cycle_from_order(uuid, uuid, uuid, numeric) to service_role;

-- ── 6. function: push_notification ────────────────────────────────────
create or replace function public.push_notification(
  p_member_id   uuid,
  p_title       text,
  p_body        text,
  p_ref_type    text default null,
  p_ref_id      uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (member_id, title, body, related_resource_type, related_resource_id)
  values (p_member_id, p_title, p_body, p_ref_type, p_ref_id);
end;
$$;

grant execute on function public.push_notification(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.push_notification(uuid, text, text, text, uuid) to service_role;

-- ── 7. trigger: auto notify เมื่อมี planting_cycle ใหม่ ──────────────
create or replace function public.notify_planting_cycle_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'order' then
    perform public.push_notification(
      new.member_id,
      '🌱 วงจรการปลูกถูกสร้างแล้ว',
      'ระบุแปลงและยืนยันวันปลูกเพื่อเริ่มติดตาม',
      'planting_cycle',
      new.id
    );
  end if;
  return new;
end;
$$;

create trigger trg_notify_planting_created
after insert on public.planting_cycles
for each row execute function public.notify_planting_cycle_created();

-- ── 8. function: confirm_planting_date ────────────────────────────────
-- สมาชิกยืนยันวันปลูก + เลือกแปลง
create or replace function public.confirm_planting_date(
  p_cycle_id    uuid,
  p_plot_id     uuid,
  p_planted_at  date,
  p_area_rai    numeric default null,
  p_note        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id    uuid;
  v_days         int;
  v_harvest_date date;
  v_product      record;
begin
  select m.id into v_member_id
  from public.members m where m.auth_user_id = auth.uid();

  -- ตรวจสิทธิ์
  if not exists (
    select 1 from public.planting_cycles
    where id = p_cycle_id and member_id = v_member_id
  ) then
    raise exception 'ไม่มีสิทธิ์แก้ไขวงจรนี้';
  end if;

  -- หา days_to_harvest
  select p.days_to_harvest into v_days
  from public.planting_cycles pc
  join public.products p on p.id = pc.product_id
  where pc.id = p_cycle_id;

  v_harvest_date := p_planted_at + coalesce(v_days, 90);

  update public.planting_cycles
  set
    plot_id              = p_plot_id,
    planted_at           = p_planted_at,
    expected_harvest_at  = v_harvest_date,
    area_planted_rai     = p_area_rai,
    status               = 'planted',
    confirmed_at         = now(),
    member_note          = p_note,
    updated_at           = now()
  where id = p_cycle_id;

  -- notify
  perform public.push_notification(
    v_member_id,
    '✅ ยืนยันวันปลูกแล้ว',
    'คาดเก็บเกี่ยว ' || to_char(v_harvest_date, 'DD Mon YYYY'),
    'planting_cycle', p_cycle_id
  );

  return jsonb_build_object(
    'cycle_id',           p_cycle_id,
    'planted_at',         p_planted_at,
    'expected_harvest_at', v_harvest_date,
    'days_to_harvest',    coalesce(v_days, 90)
  );
end;
$$;

grant execute on function public.confirm_planting_date(uuid, uuid, date, numeric, text) to authenticated;

-- ── 9. RLS ────────────────────────────────────────────────────────────
alter table public.member_credit_accounts enable row level security;
alter table public.credit_transactions enable row level security;

create policy credit_acct_select on public.member_credit_accounts for select using (
  member_id = public.current_member_id()
  or public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
);

create policy credit_txn_select on public.credit_transactions for select using (
  member_id = public.current_member_id()
  or public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
);

-- notifications: เจ้าของอ่านและ mark read ได้
create policy notif_select on public.notifications for select
using (member_id = public.current_member_id());

create policy notif_update on public.notifications for update
using (member_id = public.current_member_id());
