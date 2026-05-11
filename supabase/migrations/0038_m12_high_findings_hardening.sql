-- M12 high-severity production-readiness hardening.
-- Covers resident handoff privacy, audited privileged mutations,
-- direct finance table mutation denial, and scheduled Telegram job wiring.

create or replace function public.can_access_invoice_history(target_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_finance_role()
    or exists (
      select 1
      from public.invoices i
      join public.billing_periods bp on bp.id = i.billing_period_id
      join public.kavling_residents kr on kr.kavling_id = i.kavling_id
      where i.id = target_invoice_id
        and bp.status in ('open', 'closed', 'archived')
        and kr.profile_id = auth.uid()
        and i.due_date >= kr.started_at
        and (kr.active = true or kr.ended_at is not null)
        and (kr.ended_at is null or i.due_date <= kr.ended_at)
    );
$$;

create or replace function public.can_access_payment_proof_submission(target_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_finance_role()
    or exists (
      select 1
      from public.payment_submissions ps
      join public.invoices i on i.id = ps.invoice_id
      join public.kavling_residents kr on kr.kavling_id = i.kavling_id
      join public.profiles p on p.id = ps.submitted_by
      where ps.id = target_submission_id
        and ps.submitted_by = auth.uid()
        and p.id = auth.uid()
        and p.role = 'resident'
        and p.is_active = true
        and kr.profile_id = auth.uid()
        and kr.active = true
        and kr.ended_at is null
        and i.due_date >= kr.started_at
        and (kr.ended_at is null or i.due_date <= kr.ended_at)
    );
$$;

comment on function public.can_access_invoice_history(uuid)
is 'Residents can access invoice history only inside their own kavling occupancy window. Finance roles retain operational access.';

comment on function public.can_access_payment_proof_submission(uuid)
is 'Payment proof signed URLs are visible only to the active resident submitter within their occupancy window and to active finance roles. Co-residents, former residents, and broader invoice-history viewers must not receive signed proof URLs.';

drop policy if exists "invoices_admin_manage" on public.invoices;
drop policy if exists "payment_submissions_admin_update" on public.payment_submissions;
drop policy if exists "payment_submissions_admin_delete" on public.payment_submissions;

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

revoke all on function public.insert_privileged_audit_log(text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.insert_privileged_audit_log(text, text, text, jsonb, jsonb) to authenticated;

create or replace function public.audit_privileged_table_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  audit_action text;
  before_row jsonb;
  after_row jsonb;
  entity_id text;
begin
  if current_user <> 'authenticated' or auth.uid() is null then
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

drop trigger if exists billing_periods_audit_privileged_mutation on public.billing_periods;
create trigger billing_periods_audit_privileged_mutation
after insert or update on public.billing_periods
for each row execute function public.audit_privileged_table_mutation();

drop trigger if exists app_settings_audit_privileged_mutation on public.app_settings;
create trigger app_settings_audit_privileged_mutation
after insert or update on public.app_settings
for each row execute function public.audit_privileged_table_mutation();

drop trigger if exists announcements_audit_privileged_mutation on public.announcements;
create trigger announcements_audit_privileged_mutation
after insert or update or delete on public.announcements
for each row execute function public.audit_privileged_table_mutation();

drop trigger if exists events_audit_privileged_mutation on public.events;
create trigger events_audit_privileged_mutation
after insert or update or delete on public.events
for each row execute function public.audit_privileged_table_mutation();

create or replace function public.generate_invoices_for_period(target_period_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  period_row public.billing_periods%rowtype;
  created_count integer := 0;
  kavling_row record;
  fee_row record;
  new_invoice_id uuid;
  resolved_amount integer;
begin
  if not public.has_finance_role() then
    raise exception 'not authorized';
  end if;

  select * into period_row
  from public.billing_periods
  where id = target_period_id;

  if not found then
    raise exception 'billing period not found';
  end if;

  if period_row.status not in ('draft', 'open') then
    raise exception 'billing period must be draft/open';
  end if;

  for kavling_row in
    select *
    from public.kavlings
    where active = true
    order by sort_order, code
  loop
    new_invoice_id := null;

    insert into public.invoices (
      billing_period_id,
      kavling_id,
      invoice_number,
      amount_due,
      due_date,
      status
    )
    values (
      period_row.id,
      kavling_row.id,
      public.generate_invoice_number(period_row.year, period_row.month, kavling_row.code),
      0,
      period_row.due_date,
      'unpaid'
    )
    on conflict (billing_period_id, kavling_id) do nothing
    returning id into new_invoice_id;

    if new_invoice_id is not null then
      created_count := created_count + 1;

      for fee_row in
        select *
        from public.fee_types
        where active = true
          and is_recurring = true
          and is_penalty = false
          and (
            billing_cycle = 'monthly'
            or (billing_cycle = 'yearly' and charge_month = period_row.month)
          )
        order by sort_order, code
      loop
        select coalesce((
          select kfo.amount
          from public.kavling_fee_overrides kfo
          where kfo.kavling_id = kavling_row.id
            and kfo.fee_type_id = fee_row.id
            and (kfo.active_from is null or kfo.active_from <= make_date(period_row.year, period_row.month, 1))
            and (kfo.active_until is null or kfo.active_until >= make_date(period_row.year, period_row.month, 1))
          order by kfo.active_from desc nulls last
          limit 1
        ), fee_row.default_amount)
        into resolved_amount;

        insert into public.invoice_items (invoice_id, fee_type_id, description, amount, sort_order)
        values (new_invoice_id, fee_row.id, fee_row.name, resolved_amount, fee_row.sort_order);
      end loop;

      update public.invoices inv
      set amount_due = coalesce((
        select sum(ii.amount)
        from public.invoice_items ii
        where ii.invoice_id = new_invoice_id
      ), 0)
      where inv.id = new_invoice_id;
    end if;
  end loop;

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
    'billing_period.generate_invoices',
    'billing_periods',
    period_row.id::text,
    to_jsonb(period_row),
    jsonb_build_object('created_count', created_count)
  );

  return created_count;
end;
$$;

create or replace function public.invoke_internal_edge_function(target_function_name text)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  functions_url text;
  internal_secret text;
  request_id bigint;
begin
  if target_function_name not in ('run-scheduled-reminders', 'run-monthly-summary') then
    raise exception 'unsupported scheduled function';
  end if;

  if to_regclass('vault.decrypted_secrets') is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
      into functions_url
      using 'supabase_functions_url';
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
      into internal_secret
      using 'app_internal_cron_secret';
  end if;

  functions_url := coalesce(
    nullif(functions_url, ''),
    nullif(current_setting('app.settings.supabase_functions_url', true), '')
  );
  internal_secret := coalesce(
    nullif(internal_secret, ''),
    nullif(current_setting('app.settings.internal_cron_secret', true), '')
  );

  if functions_url is null then
    raise exception 'supabase_functions_url is not configured';
  end if;

  if internal_secret is null then
    raise exception 'app_internal_cron_secret is not configured';
  end if;

  select net.http_post(
    url := rtrim(functions_url, '/') || '/' || target_function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', internal_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_internal_edge_function(text) from public, anon, authenticated;
grant execute on function public.invoke_internal_edge_function(text) to service_role;

comment on function public.invoke_internal_edge_function(text)
is 'Called by pg_cron to invoke secret-gated Telegram scheduled Edge Functions through pg_net. Configure vault secrets supabase_functions_url and app_internal_cron_secret before enabling in production.';

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('daily-resident-reminder');
    exception when others then
      null;
    end;

    begin
      perform cron.unschedule('monthly-admin-summary');
    exception when others then
      null;
    end;

    perform cron.schedule(
      'daily-resident-reminder',
      '0 0 * * *',
      $cron$
      select public.invoke_internal_edge_function('run-scheduled-reminders');
      $cron$
    );

    perform cron.schedule(
      'monthly-admin-summary',
      '0 0 1 * *',
      $cron$
      select public.invoke_internal_edge_function('run-monthly-summary');
      $cron$
    );
  end if;
end;
$$;
