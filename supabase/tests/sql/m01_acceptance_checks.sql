-- Milestone 1 quick checks

-- Expected: 34
select count(*) as kavling_count from public.kavlings;

-- Expected: at least 6 seeded rows
select count(*) as fee_type_count from public.fee_types;

-- Expected: both rows exist and public = false
select id, public
from storage.buckets
where id in ('payment-proofs', 'report-files')
order by id;

-- Expected: permission denied for anon
-- set role anon;
-- select * from public.invoices limit 1;
-- reset role;
