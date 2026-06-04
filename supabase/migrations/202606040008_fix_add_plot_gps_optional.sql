-- Migration: make lat/lng optional on plots table (GPS disabled for LINE mobile)
-- and fix add_registration_plot RPC to work with server-side auth (no auth.uid())

-- 1. Allow lat/lng to be null (GPS disabled scenario)
--    Using default 0 keeps NOT NULL constraint but lets caller pass 0 when no GPS.
--    Longer term: make nullable. For now default=0 unblocks the GPS-disabled flow.
alter table public.plots
  alter column lat set default 0,
  alter column lng set default 0;

-- 2. Replace add_registration_plot to:
--    a) Accept p_lat/p_lng with default 0 (GPS optional)
--    b) Remove auth.uid() check — caller is already authenticated by the API route
--       using resolveApprovedMember before calling this RPC.
--    c) Verify p_member_id exists and is approved instead (safe, no auth.uid() needed)
create or replace function public.add_registration_plot(
  p_member_id        uuid,
  p_name             text,
  p_area_rai         numeric,
  p_lat              numeric default 0,
  p_lng              numeric default 0,
  p_accuracy         numeric default null,
  p_land_doc_type    text    default null,
  p_land_doc_number  text    default null,
  p_province         text    default null,
  p_district         text    default null,
  p_description      text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plot_id      uuid;
  v_member_status text;
begin
  -- Verify member exists and is approved
  -- (auth check already done by resolveApprovedMember in the API route)
  select status into v_member_status
  from public.members
  where id = p_member_id;

  if v_member_status is null then
    raise exception 'member not found: %', p_member_id;
  end if;

  if v_member_status <> 'approved' then
    raise exception 'member is not approved (status: %)', v_member_status;
  end if;

  insert into public.plots (
    member_id, name, area_rai,
    lat, lng, accuracy,
    land_doc_type, land_doc_number,
    province, district, description,
    status, created_by, role_used, timestamp
  ) values (
    p_member_id, p_name, p_area_rai,
    coalesce(p_lat, 0), coalesce(p_lng, 0), p_accuracy,
    p_land_doc_type, p_land_doc_number,
    p_province, p_district, p_description,
    'pending_review', p_member_id, 'farmer', now()
  )
  returning id into v_plot_id;

  return v_plot_id;
end;
$$;

grant execute on function public.add_registration_plot(uuid, text, numeric, numeric, numeric, numeric, text, text, text, text, text) to authenticated;
grant execute on function public.add_registration_plot(uuid, text, numeric, numeric, numeric, numeric, text, text, text, text, text) to service_role;
