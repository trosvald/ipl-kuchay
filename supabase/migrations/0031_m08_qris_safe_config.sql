-- M08: Safe resident-readable QRIS feature flag.

create or replace function public.get_resident_payment_gateway_config()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  gateway_setting jsonb;
  qris_enabled boolean := false;
begin
  select value
  into gateway_setting
  from public.app_settings
  where key = 'payment_gateway';

  if gateway_setting is not null
     and jsonb_typeof(gateway_setting->'enabled') = 'boolean' then
    qris_enabled := (gateway_setting->>'enabled')::boolean;
  end if;

  return jsonb_build_object('qris_enabled', qris_enabled);
end;
$$;

revoke execute on function public.get_resident_payment_gateway_config() from public;
grant execute on function public.get_resident_payment_gateway_config() to authenticated;
