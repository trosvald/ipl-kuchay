-- M12: close audit-helper forgery gap from privileged mutation hardening.
-- The audit helper is internal to DB triggers. Client roles must not be able
-- to call it directly and forge privileged audit entries.

create or replace function public.insert_privileged_audit_log(
  audit_action text,
  entity_table_name text,
  entity_identifier text,
  before_row jsonb,
  after_row jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() <= 0 then
    raise exception 'internal audit helper only';
  end if;

  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  )
  values (
    auth.uid(),
    public.current_role(),
    audit_action,
    entity_table_name,
    entity_identifier,
    before_row,
    after_row
  );
end;
$$;

revoke all on function public.insert_privileged_audit_log(text, text, text, jsonb, jsonb)
  from public, anon, authenticated, service_role;

comment on function public.insert_privileged_audit_log(text, text, text, jsonb, jsonb)
is 'Internal helper for privileged mutation audit triggers only. Client roles must not have EXECUTE.';

create or replace function public.audit_privileged_table_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_action text;
  before_row jsonb;
  after_row jsonb;
  entity_id text;
  request_role text := nullif(current_setting('role', true), '');
begin
  if request_role is distinct from 'authenticated' or auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  before_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  after_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;

  if tg_table_name = 'billing_periods' then
    if not public.has_finance_role() then
      raise exception 'not authorized';
    end if;

    entity_id := case when tg_op = 'DELETE' then old.id::text else new.id::text end;

    if tg_op = 'INSERT' then
      audit_action := 'billing_period.create';
    elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
      audit_action := case new.status
        when 'open' then 'billing_period.status_open'
        when 'closed' then 'billing_period.status_closed'
        when 'archived' then 'billing_period.status_archived'
        else null
      end;
    end if;
  elsif tg_table_name = 'app_settings' then
    if not public.has_operator_role() then
      raise exception 'not authorized';
    end if;

    entity_id := case when tg_op = 'DELETE' then old.key else new.key end;

    if entity_id = 'payment_gateway' then
      audit_action := 'app_setting.payment_gateway_update';
    end if;
  elsif tg_table_name = 'announcements' then
    if not public.has_operator_role() then
      raise exception 'not authorized';
    end if;

    entity_id := case when tg_op = 'DELETE' then old.id::text else new.id::text end;

    if tg_op = 'INSERT' then
      audit_action := case
        when new.status = 'published' then 'announcement.publish'
        else 'announcement.create'
      end;
    elsif tg_op = 'UPDATE' then
      audit_action := case
        when old.status is distinct from new.status and new.status = 'published' then 'announcement.publish'
        when old.status is distinct from new.status and new.status = 'archived' then 'announcement.archive'
        when old.status is distinct from new.status and new.status = 'draft' then 'announcement.unpublish'
        else 'announcement.update'
      end;
    elsif tg_op = 'DELETE' then
      audit_action := 'announcement.delete';
    end if;
  elsif tg_table_name = 'events' then
    if not public.has_operator_role() then
      raise exception 'not authorized';
    end if;

    entity_id := case when tg_op = 'DELETE' then old.id::text else new.id::text end;

    if tg_op = 'INSERT' then
      audit_action := 'event.create';
    elsif tg_op = 'UPDATE' then
      audit_action := case
        when old.status is distinct from new.status and new.status = 'cancelled' then 'event.cancel'
        else 'event.update'
      end;
    elsif tg_op = 'DELETE' then
      audit_action := 'event.delete';
    end if;
  end if;

  if audit_action is not null then
    perform public.insert_privileged_audit_log(
      audit_action,
      tg_table_name,
      entity_id,
      before_row,
      after_row
    );
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.audit_privileged_table_mutation()
  from public, anon, authenticated, service_role;

comment on function public.audit_privileged_table_mutation()
is 'Security-definer trigger function for DB-side privileged mutation audit logging.';
