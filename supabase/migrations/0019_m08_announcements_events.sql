-- Phase 4: Announcements, Events, and RSVP schema
-- RLS boundary: residents see published content + self-owned RSVP only
-- Admin/super_admin manage all lifecycle
-- Treasurer has NO content-management write path

-- ============================================================
-- Enums
-- ============================================================

create type public.announcement_status as enum ('draft', 'published', 'archived');

create type public.event_status as enum ('scheduled', 'cancelled');

create type public.rsvp_response as enum ('attending', 'not_attending', 'no_response');

-- ============================================================
-- Tables
-- ============================================================

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  status announcement_status not null default 'draft',
  is_urgent boolean not null default false,
  is_pinned boolean not null default false,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.announcement_attachments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null
    references public.announcements(id) on delete cascade,
  label text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  status event_status not null default 'scheduled',
  cancellation_note text not null default '',
  cancelled_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null
    references public.events(id) on delete cascade,
  profile_id uuid not null
    references public.profiles(id) on delete cascade,
  response rsvp_response not null default 'no_response',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_announcements_status on public.announcements(status);
create index idx_announcements_published_at on public.announcements(published_at desc);
create index idx_announcements_created_by on public.announcements(created_by);

create index idx_announcement_attachments_announcement_id
  on public.announcement_attachments(announcement_id);

create index idx_events_status on public.events(status);
create index idx_events_starts_at on public.events(starts_at asc);

create index idx_event_attendees_event_id on public.event_attendees(event_id);
create index idx_event_attendees_profile_id on public.event_attendees(profile_id);

-- ============================================================
-- Triggers
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

create trigger event_attendees_set_updated_at
  before update on public.event_attendees
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table public.announcements enable row level security;
alter table public.announcement_attachments enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;

-- announcements: residents select published only; admin/super_admin manage all

create policy "announcements_select_published_resident"
  on public.announcements for select
  to authenticated
  using (status = 'published');

create policy "announcements_select_archived_resident"
  on public.announcements for select
  to authenticated
  using (status = 'archived');

create policy "announcements_manage_admin"
  on public.announcements for all
  to authenticated
  using (public.has_operator_role())
  with check (public.has_operator_role());

-- announcement_attachments: follow parent announcement visibility for residents;
-- admin/super_admin manage all

create policy "announcement_attachments_select_resident"
  on public.announcement_attachments for select
  to authenticated
  using (
    exists (
      select 1 from public.announcements a
      where a.id = announcement_attachments.announcement_id
        and a.status = 'published'
    )
    or
    exists (
      select 1 from public.announcements a
      where a.id = announcement_attachments.announcement_id
        and a.status = 'archived'
    )
    or public.has_operator_role()
  );

create policy "announcement_attachments_manage_admin"
  on public.announcement_attachments for all
  to authenticated
  using (public.has_operator_role())
  with check (public.has_operator_role());

-- events: residents select scheduled/cancelled (visible lifecycle states);
-- admin/super_admin manage all; treasurer has no event write policy

create policy "events_select_resident"
  on public.events for select
  to authenticated
  using (status in ('scheduled', 'cancelled'));

create policy "events_manage_admin"
  on public.events for all
  to authenticated
  using (public.has_operator_role())
  with check (public.has_operator_role());

-- event_attendees: residents insert/update own RSVP until event starts;
-- admins read all attendee data

create policy "event_attendees_select_resident"
  on public.event_attendees for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.has_operator_role()
  );

create policy "event_attendees_insert_own"
  on public.event_attendees for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.starts_at > now()
    )
  );

create policy "event_attendees_update_own"
  on public.event_attendees for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.starts_at > now()
    )
  );

-- ============================================================
-- Storage bucket: announcement-assets
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'announcement-assets',
  'announcement-assets',
  false,
  null,
  array['image/png', 'image/jpeg', 'image/gif', 'application/pdf']
)
on conflict (id) do nothing;

create policy "announcement_assets_admin_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'announcement-assets'
    and public.has_operator_role()
  );

create policy "announcement_assets_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'announcement-assets'
    and public.has_operator_role()
  )
  with check (
    bucket_id = 'announcement-assets'
    and public.has_operator_role()
  );

create policy "announcement_assets_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'announcement-assets'
    and public.has_operator_role()
  );

-- Residents can read objects that belong to a published/archived announcement
create policy "announcement_assets_resident_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'announcement-assets'
    and (
      public.has_operator_role()
      or exists (
        select 1 from public.announcement_attachments aa
        join public.announcements a on a.id = aa.announcement_id
        where aa.storage_path = storage.objects.name
          and a.status in ('published', 'archived')
      )
    )
  );
