-- PR24: Campaign / Alert Foundation

create table if not exists public.campaign_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  body text not null check (char_length(trim(body)) > 0),
  type text not null check (type in ('price_notice','no_burn_program','pest_alert','queue_notice','general')),
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_announcements_date_range_chk check (end_date >= start_date)
);

create index if not exists idx_campaign_announcements_active_window
  on public.campaign_announcements (is_active, start_date, end_date);

create trigger trg_campaign_announcements_updated_at
before update on public.campaign_announcements
for each row execute function public.set_updated_at();

alter table public.campaign_announcements enable row level security;

-- Member read-only access to active + in-window announcements.
drop policy if exists campaign_announcements_member_read_active on public.campaign_announcements;
create policy campaign_announcements_member_read_active
on public.campaign_announcements
for select
using (
  is_active = true
  and start_date <= current_date
  and end_date >= current_date
);

-- Admin CRUD access (kept simple, no extra workflow).
drop policy if exists campaign_announcements_admin_all on public.campaign_announcements;
create policy campaign_announcements_admin_all
on public.campaign_announcements
for all
using (public.is_admin())
with check (public.is_admin());
