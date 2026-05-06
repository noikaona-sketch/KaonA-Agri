-- Issue #17: Prepare OCR and GPS capture schema for MVP
-- Direction: OCR results in separate table, masked/hash citizen ID only, GPS/evidence metadata on photos.
-- Additive-only migration. No frontend/API/OCR provider integration.

-- 1) OCR results as separate entity (no raw payload/full citizen ID on members)
create table if not exists public.ocr_results (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  photo_id uuid references public.photos(id) on delete set null,
  ocr_status text not null default 'pending',
  citizen_id_masked text,
  citizen_id_hash text,
  confidence numeric(5,2),
  extracted_fields jsonb,
  provider text,
  provider_request_id text,
  processed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.members(id),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.members(id)
);

alter table public.ocr_results drop constraint if exists chk_ocr_results_status;
alter table public.ocr_results
  add constraint chk_ocr_results_status
  check (ocr_status in ('pending','success','failed','manual_override','rejected'));

alter table public.ocr_results drop constraint if exists chk_ocr_results_confidence;
alter table public.ocr_results
  add constraint chk_ocr_results_confidence
  check (confidence is null or (confidence >= 0 and confidence <= 100));

alter table public.ocr_results drop constraint if exists chk_ocr_results_masked_format;
alter table public.ocr_results
  add constraint chk_ocr_results_masked_format
  check (
    citizen_id_masked is null
    or citizen_id_masked ~ '^[0-9Xx\*\- ]+$'
  );

-- 2) GPS/evidence + image preprocessing metadata on photos
alter table public.photos add column if not exists gps_provider text;
alter table public.photos add column if not exists gps_captured_at timestamptz;
alter table public.photos add column if not exists gps_is_mocked boolean not null default false;
alter table public.photos add column if not exists gps_meta jsonb;
alter table public.photos add column if not exists image_preprocess_meta jsonb;

alter table public.photos drop constraint if exists chk_photos_gps_provider;
alter table public.photos
  add constraint chk_photos_gps_provider
  check (
    gps_provider is null
    or gps_provider in ('gps','network','passive','fused','manual','unknown')
  );

-- 3) Indexes for operational filtering
create index if not exists idx_ocr_results_member_id on public.ocr_results(member_id);
create index if not exists idx_ocr_results_photo_id on public.ocr_results(photo_id);
create index if not exists idx_ocr_results_status on public.ocr_results(ocr_status);
create index if not exists idx_ocr_results_processed_at on public.ocr_results(processed_at);
create index if not exists idx_ocr_results_deleted_at on public.ocr_results(deleted_at);

create index if not exists idx_photos_gps_captured_at on public.photos(gps_captured_at);
create index if not exists idx_photos_gps_is_mocked on public.photos(gps_is_mocked);
