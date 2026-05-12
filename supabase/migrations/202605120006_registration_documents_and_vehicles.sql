-- Migration: ข้อมูลการสมัครสมาชิกแบบเต็ม
-- เอกสารแนบ, ข้อมูลแปลงเพิ่มเติม, รถของทีมบริการ

-- ── 1. member_documents ──────────────────────────────────────────────
-- เก็บเอกสารแนบที่สมาชิกอัปโหลดตอนสมัคร
create table if not exists public.member_documents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  doc_type text not null check (doc_type in (
    'id_card',        -- บัตรประชาชน
    'farmer_card',    -- บัตรเกษตรกร
    'land_title',     -- โฉนดที่ดิน
    'land_doc',       -- เอกสารสิทธิ์อื่น (นส.3, สค.1)
    'vehicle_reg',    -- ทะเบียนรถ
    'other'
  )),
  storage_path text not null,
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  ocr_result_id uuid references public.ocr_results(id) on delete set null,
  note text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_member_documents_member
  on public.member_documents(member_id)
  where deleted_at is null;

create index if not exists idx_member_documents_type
  on public.member_documents(member_id, doc_type)
  where deleted_at is null;

-- ── 2. plots — เพิ่มข้อมูลสำหรับการสมัคร ───────────────────────────
alter table public.plots
  add column if not exists description text,
  add column if not exists land_doc_type text
    check (land_doc_type in ('title_deed','ns3','ns3k','sk1','por_btor_6','other', null)),
  add column if not exists land_doc_number text,
  add column if not exists province text,
  add column if not exists district text,
  add column if not exists sub_district text;

-- ── 3. member_vehicles ───────────────────────────────────────────────
-- รถของ truck_owner (เพิ่มได้หลายคัน)
create table if not exists public.member_vehicles (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in (
    'truck_4w',       -- รถบรรทุก 4 ล้อ
    'truck_6w',       -- รถบรรทุก 6 ล้อ
    'truck_10w',      -- รถบรรทุก 10 ล้อ
    'trailer',        -- รถพ่วง
    'tractor',        -- รถแทรกเตอร์
    'pickup',         -- รถกระบะ
    'other'
  )),
  brand text,
  model text,
  year_be integer check (year_be >= 2500 and year_be <= 2600),
  plate_number text not null,
  province text,
  capacity_ton numeric(8,2),
  note text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_vehicles_member
  on public.member_vehicles(member_id)
  where deleted_at is null;

create trigger trg_member_vehicles_updated_at
before update on public.member_vehicles
for each row execute function public.set_updated_at();

-- ── 4. ocr_results — เพิ่ม document_type ───────────────────────────
alter table public.ocr_results
  drop constraint if exists chk_ocr_results_document_type;

alter table public.ocr_results
  add constraint chk_ocr_results_document_type
  check (document_type in ('thai_id_card','farmer_card','land_doc','vehicle_reg','other'));

-- เพิ่ม extracted fields สำหรับเอกสารอื่น
alter table public.ocr_results
  add column if not exists extracted_data jsonb,
  add column if not exists document_number text;

-- ── 5. Storage buckets ───────────────────────────────────────────────
-- สร้าง bucket member-docs สำหรับเอกสารการสมัคร
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-docs',
  'member-docs',
  false,
  10485760, -- 10MB
  array['image/jpeg','image/png','image/heic','image/heif','application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- bucket member-photos สำหรับรูปแปลงและหลักฐาน
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-photos',
  'member-photos',
  false,
  10485760,
  array['image/jpeg','image/png','image/heic','image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 6. RLS ───────────────────────────────────────────────────────────
alter table public.member_documents enable row level security;
alter table public.member_vehicles enable row level security;

-- member_documents: เจ้าของและ admin/staff เห็นได้
create policy member_documents_select
on public.member_documents for select
using (
  member_id = public.current_member_id()
  or public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
);

create policy member_documents_insert
on public.member_documents for insert
with check (member_id = public.current_member_id());

create policy member_documents_delete
on public.member_documents for delete
using (
  member_id = public.current_member_id()
  or public.current_member_has_role('admin')
);

-- member_vehicles: เจ้าของและ admin/staff เห็นได้
create policy member_vehicles_select
on public.member_vehicles for select
using (
  member_id = public.current_member_id()
  or public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
);

create policy member_vehicles_insert
on public.member_vehicles for insert
with check (member_id = public.current_member_id());

create policy member_vehicles_update
on public.member_vehicles for update
using (
  member_id = public.current_member_id()
  or public.current_member_has_role('admin')
);

-- ── 7. Storage RLS ───────────────────────────────────────────────────
-- member-docs: upload ได้เฉพาะตัวเอง, ดูได้ตัวเองและ admin/staff
create policy storage_member_docs_insert
on storage.objects for insert
with check (
  bucket_id = 'member-docs'
  and auth.uid() is not null
);

create policy storage_member_docs_select
on storage.objects for select
using (
  bucket_id = 'member-docs'
  and auth.uid() is not null
);

create policy storage_member_photos_insert
on storage.objects for insert
with check (
  bucket_id = 'member-photos'
  and auth.uid() is not null
);

create policy storage_member_photos_select
on storage.objects for select
using (
  bucket_id = 'member-photos'
  and auth.uid() is not null
);
