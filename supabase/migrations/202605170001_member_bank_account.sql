-- เพิ่ม bank account fields ใน members
alter table public.members
  add column if not exists bank_name           text,
  add column if not exists bank_account_number text,
  add column if not exists bank_account_name   text;
