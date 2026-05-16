-- Migration: reservation attachment, source_channel, partial sale support

-- ── seed_reservations: new columns ───────────────────────────────────
alter table public.seed_reservations
  add column if not exists source_channel  text default 'หน้าร้าน',
  add column if not exists attachment_url  text,   -- public URL สำหรับแสดง
  add column if not exists attachment_path text,   -- storage path สำหรับลบในอนาคต
  add column if not exists qty_sold        numeric(12,2),  -- qty ที่ขายจริงจาก POS
  add column if not exists qty_remaining   numeric(12,2),  -- qty ที่เหลือค้าง
  add column if not exists closed_at       timestamptz,    -- เวลาปิดจอง
  add column if not exists closed_by       text;           -- user ที่ปิดจอง

-- ── status CHECK: เพิ่ม partial ────────────────────────────────────────
alter table public.seed_reservations
  drop constraint if exists seed_reservations_status_check;

alter table public.seed_reservations
  add constraint seed_reservations_status_check
  check (status in ('pending','confirmed','completed','cancelled','converted','partial'));

-- ── Supabase Storage: bucket reservation-attachments ──────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reservation-attachments',
  'reservation-attachments',
  false,
  5242880,   -- 5MB max (images compressed client-side before upload)
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;
