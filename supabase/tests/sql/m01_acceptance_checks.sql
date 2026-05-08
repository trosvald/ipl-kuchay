do $$
declare
  v_kavling_count integer;
  v_fee_type_count integer;
  v_bucket_count integer;
  v_public_bucket_count integer;
  v_kavling_status_fn regprocedure;
begin
  select count(*) into v_kavling_count from public.kavlings;
  if v_kavling_count <> 34 then
    raise exception 'expected 34 kavlings, got %', v_kavling_count;
  end if;

  select count(*) into v_fee_type_count from public.fee_types;
  if v_fee_type_count < 6 then
    raise exception 'expected at least 6 fee types, got %', v_fee_type_count;
  end if;

  select count(*)
  into v_bucket_count
  from storage.buckets
  where id in ('payment-proofs', 'report-files');

  if v_bucket_count <> 2 then
    raise exception 'expected both storage buckets to exist, got %', v_bucket_count;
  end if;

  select count(*)
  into v_public_bucket_count
  from storage.buckets
  where id in ('payment-proofs', 'report-files')
    and public = true;

  if v_public_bucket_count <> 0 then
    raise exception 'payment/report buckets must be private';
  end if;

  if not has_function_privilege('anon', 'public.get_public_period_summary()', 'execute') then
    raise exception 'anon must execute public.get_public_period_summary()';
  end if;

  v_kavling_status_fn := to_regprocedure('public.get_public_kavling_status(uuid)');
  if v_kavling_status_fn is not null
     and has_function_privilege('anon', 'public.get_public_kavling_status(uuid)', 'execute') then
    raise exception 'anon must not execute public.get_public_kavling_status(uuid)';
  end if;
end;
$$;
