-- M09: Contextual Telegram dispatch for payment submission events.
-- Prevents category-wide recipient selection for submission templates.

create or replace function public.get_linked_telegram_recipients(
  p_template_code text
)
returns table (
  profile_id uuid,
  telegram_chat_id bigint,
  template_code text,
  related_invoice_id uuid,
  related_submission_id uuid,
  template_vars jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_template_code in (
    'resident_invoice_created',
    'resident_payment_pending',
    'resident_payment_verified',
    'resident_payment_rejected',
    'admin_pending_submission'
  ) then
    return;
  end if;

  return query
  select
    ta.profile_id,
    ta.telegram_chat_id,
    p_template_code::text as template_code,
    null::uuid as related_invoice_id,
    null::uuid as related_submission_id,
    '{}'::jsonb as template_vars
  from public.telegram_accounts ta
  join public.profiles p on p.id = ta.profile_id
  join public.notification_preferences np
    on np.profile_id = ta.profile_id
    and np.category = case
      when p_template_code = 'resident_payment_reminder'
        then 'payment_status'
      when p_template_code = 'admin_monthly_summary'
        then 'payment_status'
      when p_template_code = 'resident_announcement'
        then 'announcements'
      else null
    end
  where ta.allows_notifications = true
    and p.is_active = true
    and np.telegram_enabled = true
    and (
      p_template_code <> 'admin_monthly_summary'
      or p.role in ('treasurer', 'admin', 'super_admin')
    );
end;
$$;

create or replace function public.get_payment_event_telegram_recipients(
  p_template_code text,
  p_submission_id uuid
)
returns table (
  profile_id uuid,
  telegram_chat_id bigint,
  template_code text,
  related_invoice_id uuid,
  related_submission_id uuid,
  template_vars jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_template_code not in (
    'admin_pending_submission',
    'resident_payment_pending',
    'resident_payment_verified',
    'resident_payment_rejected'
  ) then
    return;
  end if;

  return query
  with submission_context as (
    select
      ps.id as submission_id,
      ps.invoice_id,
      ps.submitted_by,
      ps.amount_submitted,
      ps.status,
      ps.rejection_reason,
      ps.proof_path,
      bp.label as period_label,
      k.code as kavling_code
    from public.payment_submissions ps
    join public.invoices i on i.id = ps.invoice_id
    join public.billing_periods bp on bp.id = i.billing_period_id
    join public.kavlings k on k.id = i.kavling_id
    where ps.id = p_submission_id
      and (
        (p_template_code = 'admin_pending_submission' and ps.status = 'submitted' and ps.proof_path is not null)
        or (p_template_code = 'resident_payment_pending' and ps.status = 'submitted' and ps.proof_path is not null)
        or (p_template_code = 'resident_payment_verified' and ps.status = 'verified')
        or (p_template_code = 'resident_payment_rejected' and ps.status = 'rejected')
      )
  )
  select
    ta.profile_id,
    ta.telegram_chat_id,
    p_template_code::text as template_code,
    sc.invoice_id as related_invoice_id,
    sc.submission_id as related_submission_id,
    jsonb_build_object(
      'period_label', sc.period_label,
      'kavling_code', sc.kavling_code,
      'amount_submitted', sc.amount_submitted::text,
      'reason', coalesce(nullif(sc.rejection_reason, ''), '-')
    ) as template_vars
  from submission_context sc
  join public.profiles p
    on (
      (p_template_code = 'admin_pending_submission' and p.role in ('treasurer', 'admin', 'super_admin'))
      or (p_template_code in ('resident_payment_pending', 'resident_payment_verified', 'resident_payment_rejected') and p.id = sc.submitted_by)
    )
    and p.is_active = true
  join public.telegram_accounts ta
    on ta.profile_id = p.id
    and ta.allows_notifications = true
  join public.notification_preferences np
    on np.profile_id = p.id
    and np.category = 'payment_status'
    and np.telegram_enabled = true;
end;
$$;

revoke execute on function public.get_payment_event_telegram_recipients(text, uuid) from public;
grant execute on function public.get_payment_event_telegram_recipients(text, uuid) to authenticated;
