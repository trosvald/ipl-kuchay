do $$
declare
  v_admin uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_period uuid;
  v_kav uuid;
  v_invoice uuid;
  v_submission uuid;
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (v_admin, 'authenticated', 'authenticated', 'admin-m01@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values (v_admin, 'M01 Admin', 'admin', true)
  on conflict (id) do update
  set role = excluded.role,
      is_active = excluded.is_active;

  insert into public.billing_periods (year, month, label, due_date, status)
  values (2026, 6, 'June 2026', current_date + interval '7 day', 'open')
  on conflict (year, month) do update
  set label = excluded.label
  returning id into v_period;

  select id into v_kav
  from public.kavlings
  order by sort_order
  limit 1;

  insert into public.invoices (billing_period_id, kavling_id, invoice_number, amount_due, due_date, status)
  values (v_period, v_kav, 'IPL-2026-06-KAV1', 350000, current_date + interval '7 day', 'unpaid')
  on conflict (billing_period_id, kavling_id) do update
  set amount_due = excluded.amount_due
  returning id into v_invoice;

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice, v_admin, 100000, 'rejected')
  returning id into v_submission;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    perform public.reject_payment_submission(v_submission, 'status test');
    raise exception 'expected rejection guard error was not raised';
  exception
    when others then
      if position('submission is not submitted' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;
