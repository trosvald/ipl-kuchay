create or replace function public.log_admin_action(
  action_name text,
  target_entity_table text,
  target_entity_id text,
  previous_data jsonb default null,
  next_data jsonb default null,
  source_request_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_admin_like() then
    raise exception 'not authorized';
  end if;

  if action_name is null or length(trim(action_name)) = 0 then
    raise exception 'action is required';
  end if;

  if target_entity_table is null or length(trim(target_entity_table)) = 0 then
    raise exception 'entity table is required';
  end if;

  if target_entity_id is null or length(trim(target_entity_id)) = 0 then
    raise exception 'entity id is required';
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data,
    request_id
  )
  values (
    auth.uid(),
    public.current_role(),
    trim(action_name),
    trim(target_entity_table),
    trim(target_entity_id),
    previous_data,
    next_data,
    source_request_id
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

revoke execute on function public.log_admin_action(text, text, text, jsonb, jsonb, text) from public;
grant execute on function public.log_admin_action(text, text, text, jsonb, jsonb, text) to authenticated;
