-- Bucket privé des justificatifs achat espèces. À appliquer uniquement sur Supabase test.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cash-purchase-receipts', 'cash-purchase-receipts', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Cash receipt files are readable" on storage.objects;
drop policy if exists "Cash receipt managers can upload files" on storage.objects;
drop policy if exists "Cash receipt managers can update files" on storage.objects;

create policy "Cash receipt authenticated readers" on storage.objects for select to authenticated
using (bucket_id = 'cash-purchase-receipts');
create policy "Cash receipt active operators upload" on storage.objects for insert to authenticated
with check (bucket_id = 'cash-purchase-receipts' and exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','acheteur','controle','caisse')));
create policy "Cash receipt active operators update" on storage.objects for update to authenticated
using (bucket_id = 'cash-purchase-receipts' and exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','acheteur','controle','caisse')));