alter table public.seed_varieties
  add column if not exists image_url text;

comment on column public.seed_varieties.image_url is 'URL รูปภาพเมล็ดพันธุ์ (Supabase Storage)';
