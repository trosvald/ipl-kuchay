insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('report-files', 'report-files', false)
on conflict (id) do update set public = false;

create policy "payment_proofs_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = 'proofs'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "payment_proofs_select_owner_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    owner_id = auth.uid()::text
    or public.is_admin_like()
  )
);

create policy "payment_proofs_delete_admin_only"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin_like()
);

create policy "report_files_admin_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'report-files'
  and public.is_admin_like()
);

create policy "report_files_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-files'
  and public.is_admin_like()
);

create policy "report_files_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'report-files'
  and public.is_admin_like()
);
