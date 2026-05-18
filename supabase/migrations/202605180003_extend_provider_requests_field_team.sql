alter table public.provider_requests
drop constraint if exists chk_provider_requests_type;

alter table public.provider_requests
add constraint chk_provider_requests_type
check (request_type in ('service_team','field_team'));
