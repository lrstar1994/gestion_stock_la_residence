-- Lot A4 - procédé structuré et photo de dressage. Local uniquement.
begin;

alter table stock.recipe_steps
  alter column title drop not null,
  add column if not exists active_duration_minutes numeric(8,2),
  add column if not exists passive_duration_minutes numeric(8,2),
  add column if not exists observation text,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

alter table stock.recipe_steps
  add constraint recipe_steps_active_duration_chk check (active_duration_minutes is null or active_duration_minutes >= 0),
  add constraint recipe_steps_passive_duration_chk check (passive_duration_minutes is null or passive_duration_minutes >= 0);

do $$ begin
  alter table stock.recipe_steps add constraint recipe_steps_created_by_fkey foreign key (created_by) references stock.profiles(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table stock.recipe_steps add constraint recipe_steps_updated_by_fkey foreign key (updated_by) references stock.profiles(id) on delete set null;
exception when duplicate_object then null; end $$;

alter table stock.recipes add column if not exists dressing_photo_path text;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-assets', 'recipe-assets', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Recipe assets authenticated read" on storage.objects;
create policy "Recipe assets authenticated read" on storage.objects for select to authenticated
using (
  bucket_id = 'recipe-assets'
  and exists (
    select 1
    from stock.profiles p
    where p.user_id = auth.uid()
      and p.status = 'active'
  )
);

drop policy if exists "Recipe editors upload assets" on storage.objects;
create policy "Recipe editors upload assets" on storage.objects for insert to authenticated
with check (
  bucket_id = 'recipe-assets'
  and exists (
    select 1 from stock.profiles p
    where p.user_id = auth.uid() and p.status = 'active'
      and p.role in ('direction','chef_cuisine','fiche_technique')
  )
);

drop policy if exists "Recipe editors update assets" on storage.objects;
create policy "Recipe editors update assets" on storage.objects for update to authenticated
using (
  bucket_id = 'recipe-assets'
  and exists (
    select 1 from stock.profiles p
    where p.user_id = auth.uid() and p.status = 'active'
      and p.role in ('direction','chef_cuisine','fiche_technique')
  )
);

drop policy if exists "Recipe editors delete assets" on storage.objects;
create policy "Recipe editors delete assets" on storage.objects for delete to authenticated
using (
  bucket_id = 'recipe-assets'
  and exists (
    select 1 from stock.profiles p
    where p.user_id = auth.uid() and p.status = 'active'
      and p.role in ('direction','chef_cuisine','fiche_technique')
  )
);

commit;
