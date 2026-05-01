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
      when p_template_code in ('resident_invoice_created', 'resident_payment_pending',
                               'resident_payment_verified', 'resident_payment_rejected',
                               'resident_payment_reminder')
        then 'payment_status'
      when p_template_code in ('admin_pending_submission', 'admin_monthly_summary')
        then 'payment_status'
      when p_template_code = 'resident_announcement'
        then 'announcements'
      else null
    end
  where ta.allows_notifications = true
    and p.is_active = true
    and np.telegram_enabled = true
    and (
      p_template_code not in ('admin_pending_submission', 'admin_monthly_summary')
      or p.role in ('treasurer', 'admin', 'super_admin')
    );
end;
$$;
