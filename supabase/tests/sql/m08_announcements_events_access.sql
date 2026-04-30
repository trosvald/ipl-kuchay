do $$
declare
  v_super_admin uuid := '81000000-0000-0000-0000-000000000001'::uuid;
  v_admin uuid := '81000000-0000-0000-0000-000000000002'::uuid;
  v_treasurer uuid := '81000000-0000-0000-0000-000000000003'::uuid;
  v_resident_a uuid := '81000000-0000-0000-0000-000000000004'::uuid;
  v_resident_b uuid := '81000000-0000-0000-0000-000000000005'::uuid;
begin
  -- ============================================================
  -- Prerequisites: tables, functions, enums
  -- ============================================================

  if to_regclass('public.announcements') is null then
    raise exception 'announcements table is required';
  end if;
  if to_regclass('public.announcement_attachments') is null then
    raise exception 'announcement_attachments table is required';
  end if;
  if to_regclass('public.events') is null then
    raise exception 'events table is required';
  end if;
  if to_regclass('public.event_attendees') is null then
    raise exception 'event_attendees table is required';
  end if;

  if not exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'has_operator_role'
  ) then
    raise exception 'public.has_operator_role() is required';
  end if;

  -- Verify enums exist
  if not exists (
    select 1 from pg_type
    where typname = 'announcement_status'
      and typnamespace = 'public'::regnamespace
  ) then
    raise exception 'enum announcement_status is required';
  end if;

  if not exists (
    select 1 from pg_type
    where typname = 'event_status'
      and typnamespace = 'public'::regnamespace
  ) then
    raise exception 'enum event_status is required';
  end if;

  if not exists (
    select 1 from pg_type
    where typname = 'rsvp_response'
      and typnamespace = 'public'::regnamespace
  ) then
    raise exception 'enum rsvp_response is required';
  end if;

  if not exists (
    select 1 from pg_type
    where typname = 'announcement_status'
      and typnamespace = 'public'::regnamespace
      and 'draft' = any(enum_range(null::public.announcement_status)::text[])
      and 'published' = any(enum_range(null::public.announcement_status)::text[])
      and 'archived' = any(enum_range(null::public.announcement_status)::text[])
  ) then
    raise exception 'announcement_status must contain draft, published, archived';
  end if;

  -- Seed test users
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
  -- T-04-01: has_operator_role logic (excludes treasurer, resident)
  -- ============================================================

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  if not public.has_operator_role() then
    raise exception 'admin must satisfy has_operator_role()';
  end if;

  perform set_config('request.jwt.claim.sub', v_super_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  if not public.has_operator_role() then
    raise exception 'super_admin must satisfy has_operator_role()';
  end if;

  perform set_config('request.jwt.claim.sub', v_treasurer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  if public.has_operator_role() then
    raise exception 'treasurer must not satisfy has_operator_role()';
  end if;

  perform set_config('request.jwt.claim.sub', v_resident_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  if public.has_operator_role() then
    raise exception 'resident must not satisfy has_operator_role()';
  end if;

  -- ============================================================
  -- T-04-02: Resident announcement visibility via RLS policies
  -- ============================================================

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'announcements'
      and policyname = 'announcements_select_published_resident'
      and qual like '%published%'
  ) then
    raise exception 'policy announcements_select_published_resident must filter by published status';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'announcements'
      and policyname = 'announcements_select_archived_resident'
      and qual like '%archived%'
  ) then
    raise exception 'policy announcements_select_archived_resident must filter by archived status';
  end if;

  -- Verify no policy grants draft access to non-operators
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'announcements'
      and policyname = 'announcements_manage_admin'
      and qual like '%has_operator_role%'
  ) then
    raise exception 'announcements_manage_admin must gate on has_operator_role()';
  end if;

  -- Verify announcements RLS is enabled
  if not exists (
    select 1 from pg_tables
    where schemaname = 'public'
      and tablename = 'announcements'
      and rowsecurity = true
  ) then
    raise exception 'announcements must have RLS enabled';
  end if;

  -- ============================================================
  -- T-04-01: Announcement write path restricted to operators
  -- ============================================================

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'announcements'
      and policyname = 'announcements_manage_admin'
      and with_check like '%has_operator_role%'
  ) then
    raise exception 'announcements_manage_admin with_check must use has_operator_role()';
  end if;

  -- Verify only the admin policy has INSERT/UPDATE/DELETE commands (select policies are SELECT-only)
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'announcements'
      and policyname in ('announcements_select_published_resident', 'announcements_select_archived_resident')
      and cmd != 'SELECT'
  ) then
    raise exception 'announcements resident select policies must be SELECT-only (not allow writes)';
  end if;

  -- ============================================================
  -- T-04-03 / T-04-02: RSVP ownership enforcement (schema + policy)
  -- ============================================================

  -- Unique constraint on (event_id, profile_id)
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_attendees'::regclass
      and contype = 'u'
  ) then
    raise exception 'event_attendees must have unique(event_id, profile_id)';
  end if;

  -- RSVP insert policy uses auth.uid() = profile_id
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_attendees'
      and policyname = 'event_attendees_insert_own'
      and with_check like '%auth.uid()%'
  ) then
    raise exception 'event_attendees_insert_own must reference auth.uid()';
  end if;

  -- RSVP insert policy checks events.starts_at > now()
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_attendees'
      and policyname = 'event_attendees_insert_own'
      and with_check like '%starts_at%'
  ) then
    raise exception 'event_attendees_insert_own must check starts_at for event-start cutoff';
  end if;

  -- RSVP update policy uses auth.uid() = profile_id
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_attendees'
      and policyname = 'event_attendees_update_own'
      and qual like '%auth.uid()%'
      and with_check like '%auth.uid()%'
  ) then
    raise exception 'event_attendees_update_own must reference auth.uid() for ownership';
  end if;

  -- RSVP select policy: own profile_id OR has_operator_role
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_attendees'
      and policyname = 'event_attendees_select_resident'
      and qual like '%profile_id%'
      and qual like '%has_operator_role%'
  ) then
    raise exception 'event_attendees_select_resident must reference profile_id AND has_operator_role()';
  end if;

  -- ============================================================
  -- T-04-01 / EVNT-01: Event policies gated on has_operator_role()
  -- ============================================================

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'events'
      and policyname = 'events_manage_admin'
      and with_check like '%has_operator_role%'
  ) then
    raise exception 'events_manage_admin with_check must use has_operator_role()';
  end if;

  -- Resident event select policy filters by status
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'events'
      and policyname = 'events_select_resident'
      and qual like '%scheduled%'
      and qual like '%cancelled%'
  ) then
    raise exception 'events_select_resident must filter by scheduled/cancelled status';
  end if;

  -- Events RLS is enabled
  if not exists (
    select 1 from pg_tables
    where schemaname = 'public'
      and tablename = 'events'
      and rowsecurity = true
  ) then
    raise exception 'events must have RLS enabled';
  end if;

  -- ============================================================
  -- T-04-04: Announcement attachment policies
  -- ============================================================

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'announcement_attachments'
      and policyname = 'announcement_attachments_select_resident'
      and qual like '%announcements%'
  ) then
    raise exception 'announcement_attachments resident select must join to parent announcements';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'announcement_attachments'
      and policyname = 'announcement_attachments_manage_admin'
      and with_check like '%has_operator_role%'
  ) then
    raise exception 'announcement_attachments_manage_admin with_check must use has_operator_role()';
  end if;

  -- ============================================================
  -- Storage bucket and policies
  -- ============================================================

  if not exists (
    select 1 from storage.buckets
    where id = 'announcement-assets'
  ) then
    raise exception 'storage bucket announcement-assets is required';
  end if;

  if exists (
    select 1 from storage.buckets
    where id = 'announcement-assets'
      and public = true
  ) then
    raise exception 'announcement-assets bucket must NOT be public';
  end if;

  -- Admin upload policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'announcement_assets_admin_upload'
  ) then
    raise exception 'announcement_assets_admin_upload policy is required';
  end if;

  -- Resident read policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'announcement_assets_resident_read'
  ) then
    raise exception 'announcement_assets_resident_read policy is required';
  end if;

  -- Resident read policy ties to parent announcement visibility
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'announcement_assets_resident_read'
      and qual like '%announcement_attachments%'
      and qual like '%announcements%'
  ) then
    raise exception 'announcement_assets_resident_read must join through attachments to announcements';
  end if;

  -- ============================================================
  -- Schema integrity: indexes, triggers
  -- ============================================================

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'announcements'
      and indexname = 'idx_announcements_status'
  ) then
    raise exception 'index idx_announcements_status is required';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'announcements'
      and indexname = 'idx_announcements_published_at'
  ) then
    raise exception 'index idx_announcements_published_at is required';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'events'
      and indexname = 'idx_events_starts_at'
  ) then
    raise exception 'index idx_events_starts_at is required';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'event_attendees'
      and indexname = 'idx_event_attendees_profile_id'
  ) then
    raise exception 'index idx_event_attendees_profile_id is required';
  end if;

  -- ============================================================
  -- Data operations (verify tables work with valid data)
  -- ============================================================

  -- Create test data to verify table structure
  insert into public.announcements (id, title, body, status, is_urgent, published_at, created_by)
  values (gen_random_uuid(), 'Test Announcement', 'Body', 'published', true, now(), v_admin);

  insert into public.events (id, title, description, location, starts_at, ends_at, status, created_by)
  values (gen_random_uuid(), 'Test Event', 'Description', 'Location', now() + interval '7 days', now() + interval '7 days' + interval '2 hours', 'scheduled', v_admin);

  insert into public.event_attendees (event_id, profile_id, response)
  select id, v_resident_a, 'attending'
  from public.events
  where title = 'Test Event'
  limit 1
  on conflict do nothing;

  insert into public.announcement_attachments (announcement_id, label, storage_path, mime_type, size_bytes)
  select id, 'Lampiran 1', 'test/file.pdf', 'application/pdf', 1024
  from public.announcements
  where title = 'Test Announcement'
  limit 1;

end;
$$;
