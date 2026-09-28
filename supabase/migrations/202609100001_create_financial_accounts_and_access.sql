-- C1.1 : référentiel des comptes financiers et affectations aux profils.
-- Structure uniquement : aucun compte réel ni profil affecté.

create table if not exists stock.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('cash', 'mobile_money', 'vault', 'bank')),
  currency text not null default 'MGA' check (currency = 'MGA'),
  active boolean not null default true,
  location_id uuid null references stock.locations(id) on delete set null,
  display_identifier text null,
  description text null,
  created_at timestamptz not null default now(),
  created_by uuid null references stock.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references stock.profiles(id) on delete set null,
  constraint financial_accounts_code_key unique (code)
);

create table if not exists stock.financial_account_access (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references stock.financial_accounts(id) on delete restrict,
  profile_id uuid not null references stock.profiles(id) on delete restrict,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null references stock.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references stock.profiles(id) on delete set null,
  constraint financial_account_access_profile_account_key unique (profile_id, account_id)
);

create unique index if not exists financial_account_access_one_default_active_idx
  on stock.financial_account_access(profile_id)
  where active and is_default;

create index if not exists financial_account_access_account_idx
  on stock.financial_account_access(account_id, active);

create index if not exists financial_accounts_active_type_idx
  on stock.financial_accounts(account_type, active);

comment on table stock.financial_accounts is
  'C1.1 : comptes détenant réellement des fonds. Aucun numéro bancaire/Mvola complet, PIN ou hash.';
comment on table stock.financial_account_access is
  'C1.1 : affectations profil-compte. Les affectations réelles seront configurées en C1.3.';

insert into stock.role_permissions(role, permission)
select role_name::stock.user_role, 'financial_accounts.read'
from (values ('direction'), ('comptabilite'), ('caisse')) as roles(role_name)
on conflict (role, permission) do nothing;

-- Cette permission est strictement réservée aux trois rôles ci-dessus.
delete from stock.role_permissions
where permission = 'financial_accounts.read'
  and role not in ('direction'::stock.user_role, 'comptabilite'::stock.user_role, 'caisse'::stock.user_role);

alter table stock.financial_accounts enable row level security;
alter table stock.financial_account_access enable row level security;

revoke all on table stock.financial_accounts from public, anon, authenticated;
revoke all on table stock.financial_account_access from public, anon, authenticated;
grant select on table stock.financial_accounts to authenticated;
grant select on table stock.financial_account_access to authenticated;

drop policy if exists "Financial accounts readable by authorized profiles" on stock.financial_accounts;
create policy "Financial accounts readable by authorized profiles"
  on stock.financial_accounts for select to authenticated
  using (
    stock.has_permission('financial_accounts.read')
    and (
      exists (
        select 1 from stock.profiles p
        where p.id = stock.current_profile_id()
          and p.role in ('direction'::stock.user_role, 'comptabilite'::stock.user_role)
          and p.status = 'active'::stock.user_status
      )
      or exists (
        select 1 from stock.financial_account_access faa
        where faa.account_id = financial_accounts.id
          and faa.profile_id = stock.current_profile_id()
          and faa.active
          and financial_accounts.active
      )
    )
  );

drop policy if exists "Financial account access readable by authorized profiles" on stock.financial_account_access;
create policy "Financial account access readable by authorized profiles"
  on stock.financial_account_access for select to authenticated
  using (
    stock.has_permission('financial_accounts.read')
    and (
      exists (
        select 1 from stock.profiles p
        where p.id = stock.current_profile_id()
          and p.role in ('direction'::stock.user_role, 'comptabilite'::stock.user_role)
          and p.status = 'active'::stock.user_status
      )
      or profile_id = stock.current_profile_id()
    )
  );

-- Aucun client ne peuple ou ne modifie le référentiel en C1.1.
revoke insert, update, delete on table stock.financial_accounts from public, anon, authenticated;
revoke insert, update, delete on table stock.financial_account_access from public, anon, authenticated;
