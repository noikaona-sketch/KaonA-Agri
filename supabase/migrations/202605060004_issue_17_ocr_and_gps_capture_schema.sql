-- Issue #17: Prepare OCR and GPS capture schema for MVP
-- Additive-only migration for OCR payload traceability and GPS capture quality metadata.

-- 1) OCR capture details for member registration (ID card OCR + manual fallback)
alter table public.members add column if not exists citizen_id_ocr_status text;
alter table public.members add column if not exists citizen_id_ocr_payload jsonb;
alter table public.members add column if not exists citizen_id_ocr_confidence numeric(5,2);
alter table public.members add column if not exists citizen_id_ocr_extracted_at timestamptz;
alter table public.members add column if not exists citizen_id_verified_at timestamptz;
alter table public.members add column if not exists citizen_id_verified_by uuid references public.members(id);

alter table public.members drop constraint if exists chk_members_citizen_id_ocr_status;
alter table public.members
  add constraint chk_members_citizen_id_ocr_status
  check (
    citizen_id_ocr_status is null
    or citizen_id_ocr_status in ('pending','success','failed','manual_override')
  );

alter table public.members drop constraint if exists chk_members_citizen_id_ocr_confidence;
alter table public.members
  add constraint chk_members_citizen_id_ocr_confidence
  check (
    citizen_id_ocr_confidence is null
    or (citizen_id_ocr_confidence >= 0 and citizen_id_ocr_confidence <= 100)
  );

-- 2) GPS capture quality and source metadata for field/inspection evidence
alter table public.plots add column if not exists gps_provider text;
alter table public.plots add column if not exists gps_captured_at timestamptz;
alter table public.plots add column if not exists gps_is_mocked boolean not null default false;
alter table public.plots add column if not exists gps_meta jsonb;

alter table public.photos add column if not exists gps_provider text;
alter table public.photos add column if not exists gps_is_mocked boolean not null default false;
alter table public.photos add column if not exists gps_meta jsonb;

alter table public.plots drop constraint if exists chk_plots_gps_provider;
alter table public.plots
  add constraint chk_plots_gps_provider
  check (
    gps_provider is null
    or gps_provider in ('gps','network','passive','fused','manual','unknown')
  );

alter table public.photos drop constraint if exists chk_photos_gps_provider;
alter table public.photos
  add constraint chk_photos_gps_provider
  check (
    gps_provider is null
    or gps_provider in ('gps','network','passive','fused','manual','unknown')
  );

-- 3) Indexes to support operational queries
create index if not exists idx_members_ocr_status on public.members(citizen_id_ocr_status);
create index if not exists idx_members_ocr_extracted_at on public.members(citizen_id_ocr_extracted_at);
create index if not exists idx_plots_gps_captured_at on public.plots(gps_captured_at);
create index if not exists idx_plots_gps_is_mocked on public.plots(gps_is_mocked);
create index if not exists idx_photos_gps_is_mocked on public.photos(gps_is_mocked);
