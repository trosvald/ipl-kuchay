-- M12: Require a real private storage object before manual payment approval.

create or replace function public.payment_submission_has_verified_proof(target_submission_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_row public.payment_submissions%rowtype;
  object_row record;
  expected_extension text;
  expected_path text;
  object_mime_type text;
  object_size_text text;
begin
  select *
  into submission_row
  from public.payment_submissions
  where id = target_submission_id;

  if not found then
    return false;
  end if;

  if nullif(trim(coalesce(submission_row.proof_path, '')), '') is null
     or nullif(trim(coalesce(submission_row.proof_mime_type, '')), '') is null
     or submission_row.proof_size_bytes is null
     or submission_row.proof_size_bytes <= 0 then
    return false;
  end if;

  expected_extension := case submission_row.proof_mime_type
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
    when 'application/pdf' then 'pdf'
    else null
  end;

  if expected_extension is null then
    return false;
  end if;

  expected_path := format(
    'proofs/%s/%s/%s.%s',
    submission_row.submitted_by,
    submission_row.invoice_id,
    submission_row.id,
    expected_extension
  );

  if submission_row.proof_path <> expected_path then
    return false;
  end if;

  select owner_id, metadata
  into object_row
  from storage.objects
  where bucket_id = 'payment-proofs'
    and name = submission_row.proof_path
  limit 1;

  if not found then
    return false;
  end if;

  if object_row.owner_id is distinct from submission_row.submitted_by::text then
    return false;
  end if;

  object_mime_type := coalesce(
    object_row.metadata->>'mimetype',
    object_row.metadata->>'mimeType',
    object_row.metadata->>'contentType'
  );
  object_size_text := object_row.metadata->>'size';

  if object_mime_type is distinct from submission_row.proof_mime_type then
    return false;
  end if;

  if object_size_text is null
     or object_size_text !~ '^[0-9]+$'
     or object_size_text::integer <> submission_row.proof_size_bytes then
    return false;
  end if;

  return true;
end;
$$;

revoke execute on function public.payment_submission_has_verified_proof(uuid) from public;

create or replace function public.verify_payment_submission(target_submission_id uuid, admin_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_row public.payment_submissions%rowtype;
  updated_submission_row public.payment_submissions%rowtype;
  payment_id uuid;
  invoice_status public.invoice_status;
begin
  if not public.has_finance_role() then
    raise exception 'not authorized';
  end if;

  select *
  into submission_row
  from public.payment_submissions
  where id = target_submission_id
  for update;

  if not found then
    raise exception 'submission not found';
  end if;

  if submission_row.status <> 'submitted' then
    raise exception 'submission is not submitted';
  end if;

  if not public.payment_submission_has_verified_proof(submission_row.id) then
    raise exception 'submission requires a verified proof object';
  end if;

  update public.payment_submissions
  set status = 'verified',
      verified_by = auth.uid(),
      verified_at = now(),
      note = coalesce(note, '') || case when admin_note is not null then E'\nAdmin: ' || admin_note else '' end
  where id = target_submission_id
  returning * into updated_submission_row;

  payment_id := public.apply_invoice_payment(
    target_invoice_id => submission_row.invoice_id,
    target_amount => submission_row.amount_submitted,
    target_method => 'manual_transfer',
    target_paid_at => now(),
    target_verified_by => auth.uid(),
    target_payment_submission_id => submission_row.id,
    target_external_reference => null,
    target_notes => admin_note,
    allow_noop_when_outstanding_zero => false
  );

  invoice_status := public.recalculate_invoice_status(submission_row.invoice_id);

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
    'payment_submission.verify',
    'payment_submissions',
    submission_row.id::text,
    to_jsonb(submission_row),
    jsonb_build_object(
      'submission', to_jsonb(updated_submission_row),
      'payment_id', payment_id,
      'invoice_id', submission_row.invoice_id,
      'invoice_status', invoice_status,
      'admin_note', admin_note
    )
  );

  return payment_id;
end;
$$;
