do $$
declare
  v_super_admin uuid := '81000000-0000-0000-0000-000000000001'::uuid;
  v_admin uuid := '81000000-0000-0000-0000-000000000002'::uuid;
  v_treasurer uuid := '81000000-0000-0000-0000-000000000003'::uuid;
  v_resident_a uuid := '81000000-0000-0000-0000-000000000004'::uuid;
  v_resident_b uuid := '81000000-0000-0000-0000-000000000005'::uuid;
  v_ann_draft uuid;
  v_ann_published uuid;
  v_ann_archived uuid;
  v_evt_future uuid;
  v_evt_past uuid;
  v_evt_cancelled uuid;
  v_rsvp_id uuid;
begin
  -- Prerequisite: new tables must exist
  if to_regclass('public.announcements') is null then
    raise exception 'announcements table is required';
  end if;
  if to_regclass('public.events') is null then
    raise exception 'events table is required';
  end if;
  if to_regclass('public.event_attendees') is null then
    raise exception 'event_attendees table is required';
  end if;
  if to_regclass('public.announcement_attachments') is null then
    raise exception 'announcement_attachments table is required';
  end if;

  -- Prerequisite: has_operator_role must exist
  if not exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'has_operator_role'
  ) then
    raise exception 'public.has_operator_role() is required';
  end if;

  -- Seed test users if not already present
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_super_admin, 'authenticated', 'authenticated', 'sa-m08@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_admin, 'authenticated', 'authenticated', 'admin-m08@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_treasurer, 'authenticated', 'authenticated', 'treasurer-m08@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident_a, 'authenticated', 'authenticated', 'resident-a-m08@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident_b, 'authenticated', 'authenticated', 'resident-b-m08@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_super_admin, 'M08 Super Admin', 'super_admin', true),
    (v_admin, 'M08 Admin', 'admin', true),
    (v_treasurer, 'M08 Treasurer', 'treasurer', true),
    (v_resident_a, 'M08 Resident A', 'resident', true),
    (v_resident_b, 'M08 Resident B', 'resident', true)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active;

  -- ============================================================
  -- T-04-02 / T-04-01: Resident sees only published announcements
  -- ============================================================

  insert into public.announcements (id, title, body, status, created_by)
  values
    (gen_random_uuid(), 'Draft Only', 'Draft body', 'draft', v_admin)
  returning id into v_ann_draft;

  insert into public.announcements (id, title, body, status, published_at, created_by)
  values
    (gen_random_uuid(), 'Published Announcement', 'Published body', 'published', now(), v_admin)
  returning id into v_ann_published;

  insert into public.announcements (id, title, body, status, published_at, archived_at, created_by)
  values
    (gen_random_uuid(), 'Archived Announcement', 'Archived body', 'archived', now() - interval '7 days', now(), v_admin)
  returning id into v_ann_archived;

  -- Switch to resident A context
  perform set_config('request.jwt.claim.sub', v_resident_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- Resident MUST see published announcement
  if not exists (
    select 1 from public.announcements
    where id = v_ann_published and status = 'published'
  ) then
    raise exception 'resident must see published announcement';
  end if;

  -- Resident MUST see archived announcement
  if not exists (
    select 1 from public.announcements
    where id = v_ann_archived and status = 'archived'
  ) then
    raise exception 'resident must see archived announcement in history';
  end if;

  -- Resident MUST NOT see draft announcement
  if exists (
    select 1 from public.announcements
    where id = v_ann_draft and status = 'draft'
  ) then
    raise exception 'resident must NOT see draft announcement';
  end if;

  -- ============================================================
  -- T-04-01: Admin can manage announcements lifecycle
  -- ============================================================

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.announcements
  set status = 'archived', archived_at = now()
  where id = v_ann_published;

  if not exists (
    select 1 from public.announcements
    where id = v_ann_published and status = 'archived'
  ) then
    raise exception 'admin must be able to archive announcement';
  end if;

  -- ============================================================
  -- T-04-01: Treasurer is denied announcement write access
  -- ============================================================

  perform set_config('request.jwt.claim.sub', v_treasurer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    insert into public.announcements (title, body, status, created_by)
    values ('Treasurer Insert', 'Body', 'draft', v_treasurer);
    raise exception 'treasurer must NOT be able to insert announcements';
  exception
    when insufficient_privilege then null;
    when others then
      if position('violates row level security' in lower(sqlerrm)) > 0 then null;
      else raise;
      end if;
  end;

  begin
    update public.announcements
    set title = 'Treasurer Update'
    where id = v_ann_archived;
    raise exception 'treasurer must NOT be able to update announcements';
  exception
    when insufficient_privilege then null;
    when others then
      if position('violates row level security' in lower(sqlerrm)) > 0 then null;
      else raise;
      end if;
  end;

  begin
    delete from public.announcements
    where id = v_ann_archived;
    raise exception 'treasurer must NOT be able to delete announcements';
  exception
    when insufficient_privilege then null;
    when others then
      if position('violates row level security' in lower(sqlerrm)) > 0 then null;
      else raise;
      end if;
  end;

  -- ============================================================
  -- T-04-03 / T-04-02: RSVP ownership enforcement
  -- ============================================================

  -- Create events: future, past, cancelled
  insert into public.events (id, title, starts_at, ends_at, status, created_by)
  values
    (gen_random_uuid(), 'Future Event', now() + interval '7 days', now() + interval '7 days' + interval '2 hours', 'scheduled', v_admin)
  returning id into v_evt_future;

  insert into public.events (id, title, starts_at, ends_at, status, created_by)
  values
    (gen_random_uuid(), 'Past Event', now() - interval '7 days', now() - interval '7 days' + interval '2 hours', 'scheduled', v_admin)
  returning id into v_evt_past;

  insert into public.events (id, title, starts_at, ends_at, status, cancelled_at, cancellation_note, created_by)
  values
    (gen_random_uuid(), 'Cancelled Event', now() + interval '14 days', now() + interval '14 days' + interval '2 hours', 'cancelled', now(), 'Dibatalkan', v_admin)
  returning id into v_evt_cancelled;

  -- Resident A inserts own RSVP for future event
  perform set_config('request.jwt.claim.sub', v_resident_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.event_attendees (event_id, profile_id, response)
  values (v_evt_future, v_resident_a, 'attending')
  returning id into v_rsvp_id;

  -- Resident A updates own RSVP
  update public.event_attendees
  set response = 'not_attending'
  where id = v_rsvp_id and profile_id = v_resident_a;

  if not exists (
    select 1 from public.event_attendees
    where id = v_rsvp_id and response = 'not_attending'
  ) then
    raise exception 'resident must be able to update own RSVP before event start';
  end if;

  -- Resident A tries to insert RSVP for Resident B (MUST fail)
  begin
    insert into public.event_attendees (event_id, profile_id, response)
    values (v_evt_future, v_resident_b, 'attending');
    raise exception 'resident must NOT be able to insert RSVP for another profile';
  exception
    when insufficient_privilege then null;
    when others then
      if position('violates row level security' in lower(sqlerrm)) > 0 then null;
      else raise;
      end if;
  end;

  -- Resident A tries to update Resident B's RSVP (MUST fail)
  perform set_config('request.jwt.claim.sub', v_resident_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- First resident B needs an RSVP
  perform set_config('request.jwt.claim.sub', v_resident_b::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.event_attendees (event_id, profile_id, response)
  values (v_evt_future, v_resident_b, 'no_response');

  perform set_config('request.jwt.claim.sub', v_resident_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    update public.event_attendees
    set response = 'attending'
    where event_id = v_evt_future and profile_id = v_resident_b;
    raise exception 'resident must NOT be able to update RSVP for another profile';
  exception
    when insufficient_privilege then null;
    when others then
      if position('violates row level security' in lower(sqlerrm)) > 0 then null;
      else raise;
      end if;
  end;

  -- ============================================================
  -- T-04-03: RSVP update blocked after event starts
  -- ============================================================

  -- Past event: resident A tries to update RSVP (must fail - event already started)
  perform set_config('request.jwt.claim.sub', v_resident_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    insert into public.event_attendees (event_id, profile_id, response)
    values (v_evt_past, v_resident_a, 'attending');
    raise exception 'resident must NOT be able to insert RSVP for past event';
  exception
    when insufficient_privilege then null;
    when others then
      if position('violates row level security' in lower(sqlerrm)) > 0 then null;
      else raise;
      end if;
  end;

  -- ============================================================
  -- T-04-01 / EVNT-01: Super admin can manage event lifecycle
  -- ============================================================

  perform set_config('request.jwt.claim.sub', v_super_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.events
  set status = 'cancelled', cancelled_at = now(), cancellation_note = 'Cancelled by admin'
  where id = v_evt_future;

  if not exists (
    select 1 from public.events
    where id = v_evt_future and status = 'cancelled'
  ) then
    raise exception 'super_admin must be able to cancel event';
  end if;

  -- ============================================================
  -- T-04-01: Treasurer denied event content management
  -- ============================================================

  perform set_config('request.jwt.claim.sub', v_treasurer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    insert into public.events (title, starts_at, ends_at, status, created_by)
    values ('Treasurer Event', now() + interval '7 days', now() + interval '8 days', 'scheduled', v_treasurer);
    raise exception 'treasurer must NOT be able to insert events';
  exception
    when insufficient_privilege then null;
    when others then
      if position('violates row level security' in lower(sqlerrm)) > 0 then null;
      else raise;
      end if;
  end;

  begin
    update public.events
    set title = 'Treasurer Update Event'
    where id = v_evt_cancelled;
    raise exception 'treasurer must NOT be able to update events';
  exception
    when insufficient_privilege then null;
    when others then
      if position('violates row level security' in lower(sqlerrm)) > 0 then null;
      else raise;
      end if;
  end;

  -- ============================================================
  -- Resident can see scheduled and cancelled events
  -- ============================================================

  perform set_config('request.jwt.claim.sub', v_resident_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if not exists (
    select 1 from public.events where id = v_evt_future and status = 'cancelled'
  ) then
    raise exception 'resident must see cancelled event';
  end if;

  if not exists (
    select 1 from public.events where id = v_evt_past
  ) then
    raise exception 'resident must see past event';
  end if;

  -- ============================================================
  -- Announcement attachments follow parent visibility
  -- ============================================================

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.announcement_attachments
    (announcement_id, label, storage_path, mime_type, size_bytes)
  values
    (v_ann_published, 'Lampiran 1', 'test/path/file.pdf', 'application/pdf', 1024);

  perform set_config('request.jwt.claim.sub', v_resident_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if not exists (
    select 1 from public.announcement_attachments aa
    join public.announcements a on a.id = aa.announcement_id
    where a.status = 'published'
  ) then
    raise exception 'resident must be able to read attachment for published announcement';
  end if;

end;
$$;
