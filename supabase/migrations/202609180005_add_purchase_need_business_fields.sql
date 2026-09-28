-- Besoins d'achat : référentiel des utilisations et informations métier
-- complémentaires. Migration additive uniquement : aucun backfill, aucun
-- changement de workflow existant et aucune création de donnée métier.

create table if not exists stock.purchase_intended_uses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table stock.purchase_intended_uses is
  'Référentiel des utilisations prévues des besoins d''achat.';

comment on column stock.purchase_intended_uses.code is
  'Code métier stable de l''utilisation prévue.';

comment on column stock.purchase_intended_uses.label is
  'Libellé affiché, modifiable par la Direction.';

comment on column stock.purchase_intended_uses.is_active is
  'Les formulaires courants ne proposent que les utilisations actives.';

insert into stock.purchase_intended_uses (code, label, sort_order)
values
  ('cuisine', 'Cuisine', 10),
  ('petit_dejeuner', 'Petit déjeuner', 20),
  ('patisserie', 'Pâtisserie', 30),
  ('restaurant', 'Restaurant', 40),
  ('banquet', 'Banquet', 50),
  ('maintenance', 'Maintenance', 60),
  ('hebergement', 'Hébergement', 70),
  ('administration', 'Administration', 80),
  ('autre', 'Autre', 90)
on conflict (code) do nothing;

drop trigger if exists update_purchase_intended_uses_updated_at
  on stock.purchase_intended_uses;

create trigger update_purchase_intended_uses_updated_at
before update on stock.purchase_intended_uses
for each row execute function stock.update_updated_at_column();

alter table stock.purchase_needs
  add column if not exists business_origin text,
  add column if not exists intended_use_id uuid,
  add column if not exists supply_difficulty text,
  add column if not exists justification text,
  add column if not exists workflow_status text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_needs_intended_use_id_fkey'
      and conrelid = 'stock.purchase_needs'::regclass
  ) then
    alter table stock.purchase_needs
      add constraint purchase_needs_intended_use_id_fkey
      foreign key (intended_use_id)
      references stock.purchase_intended_uses(id)
      on delete restrict;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_needs_business_origin_check'
      and conrelid = 'stock.purchase_needs'::regclass
  ) then
    alter table stock.purchase_needs
      add constraint purchase_needs_business_origin_check
      check (
        business_origin is null
        or business_origin in (
          'renouvellement_stock',
          'production_fiche',
          'mise_en_place',
          'opportunite_achat'
        )
      ) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_needs_supply_difficulty_check'
      and conrelid = 'stock.purchase_needs'::regclass
  ) then
    alter table stock.purchase_needs
      add constraint purchase_needs_supply_difficulty_check
      check (
        supply_difficulty is null
        or supply_difficulty in ('facile', 'difficile')
      ) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_needs_workflow_status_check'
      and conrelid = 'stock.purchase_needs'::regclass
  ) then
    alter table stock.purchase_needs
      add constraint purchase_needs_workflow_status_check
      check (
        workflow_status is null
        or workflow_status in (
          'draft',
          'submitted',
          'direction_review',
          'approved',
          'refused',
          'to_procure'
        )
      ) not valid;
  end if;
end;
$$;

create index if not exists purchase_needs_intended_use_id_idx
  on stock.purchase_needs (intended_use_id)
  where intended_use_id is not null;

create index if not exists purchase_needs_business_origin_idx
  on stock.purchase_needs (business_origin)
  where business_origin is not null;

create index if not exists purchase_needs_workflow_status_idx
  on stock.purchase_needs (workflow_status)
  where workflow_status is not null;

create index if not exists purchase_needs_requested_date_idx
  on stock.purchase_needs (requested_date)
  where requested_date is not null;

comment on column stock.purchase_needs.business_origin is
  'Origine métier additive : renouvellement_stock, production_fiche, mise_en_place ou opportunite_achat.';

comment on column stock.purchase_needs.intended_use_id is
  'Utilisation prévue. Nullable pour préserver les besoins historiques.';

comment on column stock.purchase_needs.supply_difficulty is
  'Difficulté structurée d''approvisionnement : facile ou difficile.';

comment on column stock.purchase_needs.justification is
  'Justification métier du besoin, distincte du commentaire libre.';

comment on column stock.purchase_needs.workflow_status is
  'Workflow métier futur, distinct de status, decision_status et processing_mode.';

alter table stock.purchase_intended_uses enable row level security;

drop policy if exists "Active profiles can view purchase intended uses"
  on stock.purchase_intended_uses;

create policy "Active profiles can view purchase intended uses"
on stock.purchase_intended_uses
for select
to authenticated
using (
  exists (
    select 1
    from stock.profiles
    where profiles.user_id = auth.uid()
      and profiles.status = 'active'::stock.user_status
  )
);

drop policy if exists "Directors can insert purchase intended uses"
  on stock.purchase_intended_uses;

create policy "Directors can insert purchase intended uses"
on stock.purchase_intended_uses
for insert
to authenticated
with check (stock.is_current_user_direction());

drop policy if exists "Directors can update purchase intended uses"
  on stock.purchase_intended_uses;

create policy "Directors can update purchase intended uses"
on stock.purchase_intended_uses
for update
to authenticated
using (stock.is_current_user_direction())
with check (stock.is_current_user_direction());

drop policy if exists "Directors can delete unused purchase intended uses"
  on stock.purchase_intended_uses;

create policy "Directors can delete unused purchase intended uses"
on stock.purchase_intended_uses
for delete
to authenticated
using (stock.is_current_user_direction());

revoke all on table stock.purchase_intended_uses from public, anon;
grant select, insert, update, delete on table stock.purchase_intended_uses to authenticated;
