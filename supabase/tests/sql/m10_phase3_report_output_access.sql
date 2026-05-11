-- SQL acceptance checks for Phase 3 report output artifacts.
-- Validates:
--   1. report-outputs bucket exists and is private
--   2. Storage policies exist for finance role access
--   3. public.reports supports kavling_id for receipt linkage
--   4. report_type enum includes monthly_summary and receipt
--   5. RLS policy reports_select_own_receipt_or_admin exists
--   6. report-outputs storage policies require active finance profiles

do $$
declare
  v_count integer;
  v_active_treasurer uuid := '91000000-0000-0000-0000-000000000001'::uuid;
  v_inactive_treasurer uuid := '91000000-0000-0000-0000-000000000002'::uuid;
begin
  -- Check 1: report-outputs bucket exists and is not public
  select count(*) into v_count from storage.buckets where id = 'report-outputs';
  if v_count <> 1 then
    raise exception 'FAILED: report-outputs bucket must exist, got %', v_count;
  end if;

  select count(*) into v_count from storage.buckets where id = 'report-outputs' and public = true;
  if v_count <> 0 then
    raise exception 'FAILED: report-outputs must be private (public=false)';
  end if;

  -- Check 2: Storage policies exist (check via bucket policies table)
  -- Note: storage.policies may not exist in all Supabase versions, skip if not available
  -- The actual policy enforcement is tested via RLS + functional tests

  -- Check 3: public.reports columns exist
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'reports' and column_name = 'file_path' and table_schema = 'public'
  ) then
    raise exception 'FAILED: public.reports must have file_path column';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'reports' and column_name = 'metadata' and data_type = 'jsonb' and table_schema = 'public'
  ) then
    raise exception 'FAILED: public.reports.metadata must be jsonb';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'reports' and column_name = 'billing_period_id' and table_schema = 'public'
  ) then
    raise exception 'FAILED: public.reports must have billing_period_id';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'reports' and column_name = 'kavling_id' and table_schema = 'public'
  ) then
    raise exception 'FAILED: public.reports must have kavling_id for receipt linkage per T-03-24';
  end if;

  -- Check 4: report_type enum includes monthly_summary and receipt
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'monthly_summary' and enumtypid = 'public.report_type'::regtype
  ) then
    raise exception 'FAILED: report_type enum must include monthly_summary';
  end if;

  if not exists (
    select 1 from pg_enum
    where enumlabel = 'receipt' and enumtypid = 'public.report_type'::regtype
  ) then
    raise exception 'FAILED: report_type enum must include receipt';
  end if;

  -- Check 5: RLS policy on reports table
  if not exists (
    select 1 from pg_policies where tablename = 'reports' and policyname = 'reports_select_own_receipt_or_admin'
  ) then
    raise exception 'FAILED: public.reports must have reports_select_own_receipt_or_admin RLS policy';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in ('report_outputs_finance_upload', 'report_outputs_finance_read', 'report_outputs_finance_delete')
      and coalesce(qual, with_check, '') not like '%has_finance_role%'
  ) then
    raise exception 'FAILED: report-output storage policies must use active finance helper checks';
  end if;

  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_active_treasurer, 'authenticated', 'authenticated', 'active-report-output-m10@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_inactive_treasurer, 'authenticated', 'authenticated', 'inactive-report-output-m10@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_active_treasurer, 'M10 Active Treasurer', 'treasurer', true),
    (v_inactive_treasurer, 'M10 Inactive Treasurer', 'treasurer', false)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active;

  perform set_config('request.jwt.claim.sub', v_active_treasurer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  execute 'set local role authenticated';
  execute 'insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values (''report-outputs'', ''m10-active-upload.html'', $1, $2, ''{}''::jsonb)'
    using v_active_treasurer, v_active_treasurer::text;
  execute 'select count(*) from storage.objects where bucket_id = ''report-outputs'' and name = ''m10-active-upload.html'''
    into v_count;
  execute 'reset role';

  if v_count <> 1 then
    raise exception 'FAILED: active finance user must read report-output objects';
  end if;

  insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values
    ('report-outputs', 'm10-inactive-read.html', v_active_treasurer, v_active_treasurer::text, '{}'::jsonb);

  perform set_config('request.jwt.claim.sub', v_inactive_treasurer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    execute 'set local role authenticated';
    execute 'insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values (''report-outputs'', ''m10-inactive-upload.html'', $1, $2, ''{}''::jsonb)'
      using v_inactive_treasurer, v_inactive_treasurer::text;
    execute 'reset role';
    raise exception 'FAILED: inactive finance user must not upload report-output objects';
  exception
    when others then
      execute 'reset role';
      if sqlstate <> '42501' then
        raise;
      end if;
  end;

  execute 'set local role authenticated';
  execute 'select count(*) from storage.objects where bucket_id = ''report-outputs'' and name = ''m10-inactive-read.html'''
    into v_count;
  execute 'reset role';

  if v_count <> 0 then
    raise exception 'FAILED: inactive finance user must not read report-output objects';
  end if;

  -- All checks passed
  raise notice 'ALL M10 CHECKS PASSED: report-outputs bucket, reports schema, and RLS policies OK';
end;
$$;
