drop policy if exists "report_outputs_finance_upload" on storage.objects;
create policy "report_outputs_finance_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-outputs'
  and public.has_finance_role()
);

drop policy if exists "report_outputs_finance_read" on storage.objects;
create policy "report_outputs_finance_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'report-outputs'
  and public.has_finance_role()
);

drop policy if exists "report_outputs_finance_delete" on storage.objects;
create policy "report_outputs_finance_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'report-outputs'
  and public.has_finance_role()
);
