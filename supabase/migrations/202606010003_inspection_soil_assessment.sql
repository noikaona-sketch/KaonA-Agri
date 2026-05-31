-- Migration: inspection_soil_assessment
-- เพิ่มฟิลด์ตรวจสภาพดิน (A), ใบรับรองหน่วยงาน (C), และบันทึกส่งดินแล็บ
-- ต่อจาก 202606040002

-- ── A: ประเมินสภาพดินเอง ────────────────────────────────────────────────────
alter table public.inspections
  add column if not exists soil_color         text
    check (soil_color in ('dark_brown','brown','red','grey','black','other') or soil_color is null),
  add column if not exists soil_texture       text
    check (soil_texture in ('sandy','loamy','clay','silty','rocky') or soil_texture is null),
  add column if not exists soil_drainage      text
    check (soil_drainage in ('good','moderate','poor','waterlogged') or soil_drainage is null),
  add column if not exists soil_moisture      text
    check (soil_moisture in ('dry','moist','wet','saturated') or soil_moisture is null),
  add column if not exists soil_issues        text[],   -- ['erosion','compaction','saline','acidic','weed']
  add column if not exists soil_note          text;     -- บันทึกอิสระ

-- ── C: ใบรับรองหน่วยงาน ─────────────────────────────────────────────────────
alter table public.inspections
  add column if not exists cert_agency        text,     -- ชื่อหน่วยงาน เช่น กรมวิชาการเกษตร
  add column if not exists cert_number        text,     -- เลขที่ใบรับรอง
  add column if not exists cert_issued_date   date,
  add column if not exists cert_expires_date  date,
  add column if not exists cert_photo_path    text;     -- storage path ของรูปสแกน

-- ── Lab: ส่งดินตรวจแล็บ ──────────────────────────────────────────────────────
alter table public.inspections
  add column if not exists lab_submitted      boolean not null default false,
  add column if not exists lab_name           text,     -- ชื่อห้องแล็บ / หน่วยงานที่ส่ง
  add column if not exists lab_submitted_at   date,     -- วันที่ส่ง
  add column if not exists lab_tracking_no    text,     -- เลขติดตาม (ถ้ามี)
  add column if not exists lab_photo_path     text,     -- รูปถุงดิน/ใบนำส่ง
  add column if not exists lab_result_at      date,     -- วันรับผลกลับ (admin กรอกทีหลัง)
  add column if not exists lab_ph             numeric(4,2),
  add column if not exists lab_om_pct         numeric(5,2), -- % อินทรียวัตถุ
  add column if not exists lab_result_note    text;

-- photo_type: เพิ่ม 'soil_cert' และ 'soil_lab' 
alter table public.photos drop constraint if exists chk_photos_photo_type;
alter table public.photos
  add constraint chk_photos_photo_type
  check (photo_type is null or photo_type in (
    'plot','no_burn','inspection','id_card','other',
    'soil_cert','soil_lab'
  ));

-- index
create index if not exists idx_inspections_lab_submitted
  on public.inspections(lab_submitted) where lab_submitted = true;
