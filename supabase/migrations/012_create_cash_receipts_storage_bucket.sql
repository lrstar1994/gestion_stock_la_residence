create schema if not exists stock;
set search_path = stock, public, auth;

-- Migration : bucket de stockage pour les justificatifs d'achats en especes

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cash-purchase-receipts',
  'cash-purchase-receipts',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Cash receipt files are readable"
  on storage.objects for select
  using (bucket_id = 'cash-purchase-receipts' and auth.uid() is not null);

create policy "Cash receipt managers can upload files"
  on storage.objects for insert
  with check (
    bucket_id = 'cash-purchase-receipts'
    and exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role in ('direction', 'acheteur')
        and profiles.status = 'active'
    )
  );

create policy "Cash receipt managers can update files"
  on storage.objects for update
  using (
    bucket_id = 'cash-purchase-receipts'
    and exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role in ('direction', 'acheteur')
        and profiles.status = 'active'
    )
  );
