create schema if not exists stock;
set search_path = stock, public, auth;

-- Migration : type d'ecart pour depassement d'avance en especes

alter type stock.difference_type add value if not exists 'advance_overrun';

create policy "Cashiers can give cash on validated purchases"
  on stock.cash_purchases
  for update
  using (
    exists (
      select 1
      from stock.profiles current_profile
      where current_profile.user_id = auth.uid()
        and current_profile.role = 'caisse'
        and current_profile.status = 'active'
    )
    and status = 'valide'
  )
  with check (
    exists (
      select 1
      from stock.profiles current_profile
      where current_profile.user_id = auth.uid()
        and current_profile.role = 'caisse'
        and current_profile.status = 'active'
    )
    and status = 'especes_remises'
  );

drop policy if exists "Cash staff can manage cash purchases"
on stock.cash_purchases;

create policy "Cash staff can manage cash purchases"
on stock.cash_purchases
for all
using (
  exists (
    select 1
    from stock.profiles current_profile
    where current_profile.user_id = auth.uid()
      and current_profile.status = 'active'
      and (
        current_profile.role = 'acheteur'
        or (
          current_profile.role = 'caisse'
          and stock.cash_purchases.status = 'valide'
        )
      )
  )
)
with check (
  exists (
    select 1
    from stock.profiles current_profile
    where current_profile.user_id = auth.uid()
      and current_profile.status = 'active'
      and (
        current_profile.role = 'acheteur'
        or (
          current_profile.role = 'caisse'
          and stock.cash_purchases.status in ('valide', 'especes_remises')
        )
      )
  )
);