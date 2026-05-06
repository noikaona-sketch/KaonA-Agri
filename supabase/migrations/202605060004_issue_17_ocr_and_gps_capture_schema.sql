-- Issue #17: Prepare OCR and GPS capture schema for MVP
-- Direction: isolate OCR into public.ocr_results, keep GPS/evidence review on photos, no provider integration.

-- 1) OCR results table (privacy-first)
create table if not exists public.ocr_results (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  photo_id uuid references public.photos(id) on delete set null,
  document_type text not null default 'thai_id_card',
  provider text,
  extracted_full_name text,
  extracted_citizen_id_masked text,
  citizen_id_hash text,
  confidence numeric(5,4),
  status text not null default 'pending',
  reviewed_by uuid references public.members(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.ocr_results drop constraint if exists chk_ocr_results_document_type;
alter table public.ocr_results
  add constraint chk_ocr_results_document_type
  check (document_type in ('thai_id_card', 'other'));

alter table public.ocr_results drop constraint if exists chk_ocr_results_provider;
alter table public.ocr_results
  add constraint chk_ocr_results_provider
  check (provider is null or provider in ('google_vision', 'gemini', 'manual', 'other'));

alter table public.ocr_results drop constraint if exists chk_ocr_results_status;
alter table public.ocr_results
  add constraint chk_ocr_results_status
  check (status in ('pending', 'accepted', 'rejected', 'manual_review'));

alter table public.ocr_results drop constraint if exists chk_ocr_results_confidence;
alter table public.ocr_results
  add constraint chk_ocr_results_confidence
  check (confidence is null or (confidence >= 0 and confidence <= 1));

-- 2) RLS for OCR results
alter table public.ocr_results enable row level security;

create policy ocr_results_select_own
on public.ocr_results for select
using (member_id = public.current_member_id());

create policy ocr_results_select_admin_staff_service
on public.ocr_results for select
using (
  public.current_member_has_role('staff')
  or public.current_member_has_role('admin')
  or public.current_member_has_role('service_account')
);

create policy ocr_results_insert_admin_staff_service
on public.ocr_results for insert
with check (
  public.current_member_has_role('staff')
  or public.current_member_has_role('admin')
  or public.current_member_has_role('service_account')
);

create policy ocr_results_update_admin_staff_service
on public.ocr_results for update
using (
  public.current_member_has_role('staff')
  or public.current_member_has_role('admin')
  or public.current_member_has_role('service_account')
)
with check (
  public.current_member_has_role('staff')
  or public.current_member_has_role('admin')
  or public.current_member_has_role('service_account')
);

-- 3) GPS/evidence + image preprocessing metadata on photos
alter table public.photos add column if not exists gps_source text not null default 'device';
alter table public.photos add column if not exists gps_verified boolean not null default false;
alter table public.photos add column if not exists gps_distance_to_plot_m numeric;
alter table public.photos add column if not exists evidence_status text not null default 'submitted';
alter table public.photos add column if not exists reviewed_by uuid references public.members(id);
alter table public.photos add column if not exists reviewed_at timestamptz;

alter table public.photos add column if not exists gps_provider text;
alter table public.photos add column if not exists gps_is_mocked boolean not null default false;
alter table public.photos add column if not exists gps_meta jsonb;

alter table public.photos add column if not exists original_storage_path text;
alter table public.photos add column if not exists processed_storage_path text;
alter table public.photos add column if not exists width_px integer;
alter table public.photos add column if not exists height_px integer;
alter table public.photos add column if not exists file_size_bytes bigint;
alter table public.photos add column if not exists processing_status text not null default 'pending';

alter table public.photos drop constraint if exists chk_photos_gps_source;
alter table public.photos
  add constraint chk_photos_gps_source
  check (gps_source in ('device', 'manual', 'unknown'));

alter table public.photos drop constraint if exists chk_photos_evidence_status;
alter table public.photos
  add constraint chk_photos_evidence_status
  check (evidence_status in ('submitted', 'accepted', 'rejected', 'needs_review'));

alter table public.photos drop constraint if exists chk_photos_gps_provider;
alter table public.photos
  add constraint chk_photos_gps_provider
  check (gps_provider is null or gps_provider in ('gps','network','passive','fused','manual','unknown'));

alter table public.photos drop constraint if exists chk_photos_processing_status;
alter table public.photos
  add constraint chk_photos_processing_status
  check (processing_status in ('pending', 'processed', 'failed', 'skipped'));

-- 4) Indexes
create index if not exists idx_ocr_results_member_status on public.ocr_results(member_id, status);
create index if not exists idx_ocr_results_citizen_id_hash on public.ocr_results(citizen_id_hash);

create index if not exists idx_photos_evidence_status on public.photos(evidence_status);
create index if not exists idx_photos_plot_captured_at on public.photos(plot_id, captured_at);
create index if not exists idx_photos_no_burn_evidence_status on public.photos(no_burn_request_id, evidence_status);
create index if not exists idx_photos_processing_status on public.photos(processing_status);
