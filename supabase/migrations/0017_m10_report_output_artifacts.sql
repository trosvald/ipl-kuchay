-- Migration: report-output artifacts
-- Creates private storage bucket for generated monthly summary and resident receipt artifacts.
-- Also adds metadata constraints on public.reports for receipt rows.

-- Create report-outputs storage bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-outputs',
  'report-outputs',
  false, -- private bucket, no public access
  null,
  null
)
on conflict (id) do nothing;

-- Storage policies for finance roles (treasurer/admin/super_admin)

-- Allow finance roles to upload report artifacts (write)
drop policy if exists "report_outputs_finance_upload" on storage.objects;
create policy "report_outputs_finance_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-outputs'
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('treasurer', 'admin', 'super_admin')
  )
);

-- Allow finance roles to read report artifacts (for signed URL delivery)
drop policy if exists "report_outputs_finance_read" on storage.objects;
create policy "report_outputs_finance_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'report-outputs'
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('treasurer', 'admin', 'super_admin')
  )
);

-- Allow finance roles to delete report artifacts
drop policy if exists "report_outputs_finance_delete" on storage.objects;
create policy "report_outputs_finance_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'report-outputs'
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('treasurer', 'admin', 'super_admin')
  )
);

-- Receipt metadata constraint: receipt rows must carry kavling_id, invoice_id, and payment metadata
-- This is enforced by the generate-report-output Edge Function when inserting receipt rows.
-- Add comment for documentation:
comment on table public.reports is
  'Report artifacts: monthly summaries and resident receipts stored privately in report-outputs bucket. Receipt rows (report_type = ''receipt'') must include kavling_id, invoice_id in metadata.';