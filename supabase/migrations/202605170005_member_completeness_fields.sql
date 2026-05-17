-- PR1: member completeness fields for admin approval workflow
-- Issue #203

-- ── 1. returned status + reason fields ───────────────────────────────
alter table public.members
  add column if not exists return_reason       text,
  add column if not exists returned_at         timestamptz,
  add column if not exists rejection_reason    text,
  add column if not exists rejected_at         timestamptz;

-- ── 2. bank account verification status ──────────────────────────────
-- values: missing | needs_review | verified | rejected
alter table public.members
  add column if not exists bank_verified_status text
    not null default 'missing'
    check (bank_verified_status in ('missing','needs_review','verified','rejected'));

-- auto-set bank_verified_status = needs_review when bank fields are filled
create or replace function public.sync_bank_verified_status()
returns trigger language plpgsql as $$
begin
  -- ถ้ากรอก bank fields ครบ และยังเป็น missing → เปลี่ยนเป็น needs_review
  if new.bank_account_number is not null
     and new.bank_name        is not null
     and new.bank_verified_status = 'missing'
  then
    new.bank_verified_status := 'needs_review';
  end if;
  -- ถ้าลบ bank fields → reset กลับเป็น missing
  if new.bank_account_number is null and new.bank_name is null then
    new.bank_verified_status := 'missing';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_bank_verified_status on public.members;
create trigger trg_sync_bank_verified_status
  before insert or update on public.members
  for each row execute function public.sync_bank_verified_status();

-- ── 3. approval_notes: ประวัติ action ─────────────────────────────────
create table if not exists public.member_approval_logs (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  action      text not null,   -- approved | rejected | returned | suspended | bank_verified | bank_rejected
  reason      text,            -- เหตุผล (required สำหรับ rejected/returned)
  acted_by    text,            -- admin user id หรือ email
  created_at  timestamptz not null default now()
);

create index if not exists idx_member_approval_logs_member
  on public.member_approval_logs(member_id, created_at desc);

-- ── 4. update members status check constraint ─────────────────────────
-- เพิ่ม returned ใน allowed statuses พร้อม pending_approval (ใช้ใน mobile flow)
alter table public.members
  drop constraint if exists members_status_check;

alter table public.members
  add constraint members_status_check
  check (status in ('pending','pending_approval','approved','rejected','returned','suspended'));

-- ── 5. backfill bank_verified_status ──────────────────────────────────
update public.members
set bank_verified_status = 'needs_review'
where bank_account_number is not null
  and bank_name is not null
  and bank_verified_status = 'missing';

-- ── 6. address fields ที่ยังขาด ───────────────────────────────────────
-- house_no, moo, subdistrict, district, province มีอยู่แล้ว
-- เพิ่ม village, road, postal_code
alter table public.members
  add column if not exists village     text,
  add column if not exists road        text,
  add column if not exists postal_code text;

comment on column public.members.village     is 'หมู่บ้าน/ชุมชน';
comment on column public.members.road        is 'ถนน';
comment on column public.members.postal_code is 'รหัสไปรษณีย์';
