-- Migration: add subdistrict, village columns to plots
-- and update add_registration_plot RPC to accept them

alter table public.plots
  add column if not exists subdistrict text,
  add column if not exists village     text;

-- Update RPC to accept subdistrict and village
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
  p_subdistrict      text    default null,
  p_village          text    default null,
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
    province, district, subdistrict, village, description,
    status, created_by, role_used, timestamp
  ) values (
    p_member_id, p_name, p_area_rai,
    coalesce(p_lat, 0), coalesce(p_lng, 0), p_accuracy,
    p_land_doc_type, p_land_doc_number,
    p_province, p_district, p_subdistrict, p_village, p_description,
    'pending_review', p_member_id, 'farmer', now()
  )
  returning id into v_plot_id;

  return v_plot_id;
end;
$$;

grant execute on function public.add_registration_plot(uuid,text,numeric,numeric,numeric,numeric,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.add_registration_plot(uuid,text,numeric,numeric,numeric,numeric,text,text,text,text,text,text,text) to service_role;
