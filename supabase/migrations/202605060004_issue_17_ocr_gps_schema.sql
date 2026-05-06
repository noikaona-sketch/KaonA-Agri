-- Issue #17: OCR + GPS evidence schema
-- Privacy-first OCR result storage and GPS evidence review metadata.

create table if not exists public.ocr_results (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  photo_id uuid references public.photos(id) on delete set null,
  document_type text not null default 'thai_id_card'
    check (document_type in ('thai_id_card', 'other')),
  provider text
    check (provider is null or provider in ('google_vision', 'gemini', 'manual', 'other')),
  extracted_full_name text,
  extracted_citizen_id_masked text,
  citizen_id_hash text,
  confidence numeric(5,4)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'manual_review')),
  reviewed_by uuid references public.members(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.photos
add column if not exists gps_source text not null default 'device'
  check (gps_source in ('device', 'manual', 'unknown')),
add column if not exists gps_verified boolean not null default false,
add column if not exists gps_distance_to_plot_m numeric,
add column if not exists evidence_status text not null default 'submitted'
  check (evidence_status in ('submitted', 'accepted', 'rejected', 'needs_review')),
add column if not exists reviewed_by uuid references public.members(id),
add column if not exists reviewed_at timestamptz,
add column if not exists original_storage_path text,
add column if not exists processed_storage_path text,
add column if not exists width_px integer,
add column if not exists height_px integer,
add column if not exists file_size_bytes bigint,
add column if not exists processing_status text not null default 'pending'
  check (processing_status in ('pending', 'processed', 'failed', 'skipped'));

create index if not exists idx_ocr_results_member_status
on public.ocr_results(member_id, status);

create index if not exists idx_ocr_results_citizen_id_hash
on public.ocr_results(citizen_id_hash);

create index if not exists idx_photos_evidence_status
on public.photos(evidence_status);

create index if not exists idx_photos_plot_captured_at
on public.photos(plot_id, captured_at);

create index if not exists idx_photos_no_burn_evidence_status
on public.photos(no_burn_request_id, evidence_status);

alter table public.ocr_results enable row level security;

create policy ocr_results_select_own
on public.ocr_results for select
using (member_id = public.current_member_id());

create policy ocr_results_select_admin_staff
on public.ocr_results for select
using (public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('service_account'));

create policy ocr_results_insert_admin_staff
on public.ocr_results for insert
with check (public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('service_account'));

create policy ocr_results_update_admin_staff
on public.ocr_results for update
using (public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('service_account'))
with check (public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('service_account'));
