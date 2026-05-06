-- Issue #17: OCR + GPS schema
-- Adds structured OCR traceability for member registration and GPS quality metadata.

alter table public.members
add column if not exists citizen_id_ocr_text text,
add column if not exists citizen_id_ocr_confidence numeric(5,4)
  check (citizen_id_ocr_confidence is null or (citizen_id_ocr_confidence >= 0 and citizen_id_ocr_confidence <= 1)),
add column if not exists citizen_id_ocr_status text not null default 'not_started'
  check (citizen_id_ocr_status in ('not_started', 'captured', 'needs_review', 'accepted', 'rejected', 'manual_override')),
add column if not exists citizen_id_ocr_payload jsonb,
add column if not exists citizen_id_ocr_processed_at timestamptz,
add column if not exists citizen_id_verified_at timestamptz;

alter table public.plots
add column if not exists gps_source text not null default 'device'
  check (gps_source in ('device', 'manual_pin', 'imported', 'corrected')),
add column if not exists gps_status text not null default 'captured'
  check (gps_status in ('captured', 'low_accuracy', 'verified', 'rejected')),
add column if not exists gps_captured_at timestamptz,
add column if not exists gps_verified_at timestamptz;

alter table public.photos
add column if not exists gps_source text not null default 'device'
  check (gps_source in ('device', 'manual_pin', 'imported', 'corrected')),
add column if not exists gps_status text not null default 'captured'
  check (gps_status in ('captured', 'low_accuracy', 'verified', 'rejected')),
add column if not exists gps_verified_at timestamptz;

create index if not exists idx_members_ocr_status on public.members(citizen_id_ocr_status);
create index if not exists idx_plots_gps_status on public.plots(gps_status);
create index if not exists idx_photos_gps_status on public.photos(gps_status);
