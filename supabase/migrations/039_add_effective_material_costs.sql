create schema if not exists stock;
set search_path = stock, public, auth;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'stock'::regnamespace and typname = 'supplier_tax_status') then
    create type stock.supplier_tax_status as enum (
      'nif_stat_with_vat',
      'nif_stat_without_vat',
      'no_nif_stat_declared',
      'no_nif_stat_not_declared',
      'unknown'
    );
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'stock'::regnamespace and typname = 'invoice_tax_mode') then
    create type stock.invoice_tax_mode as enum (
      'invoice_with_recoverable_vat',
      'invoice_without_vat',
      'invoice_ttc_vat_not_recoverable',
      'declared_with_extra_tax',
      'manual_validated'
    );
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'stock'::regnamespace and typname = 'effective_cost_method') then
    create type stock.effective_cost_method as enum (
      'invoice_ht_vat_recoverable',
      'invoice_amount_no_vat',
      'invoice_ttc_vat_not_recoverable',
      'supplier_amount_plus_declared_tax',
      'manual_validated_cost',
      'unavailable'
    );
  end if;
end $$;

alter table stock.suppliers
  add column if not exists supplier_tax_status stock.supplier_tax_status default 'unknown',
  add column if not exists default_vat_recoverable boolean default true,
  add column if not exists default_invoice_tax_mode stock.invoice_tax_mode default 'invoice_with_recoverable_vat',
  add column if not exists default_declared_extra_tax_rate numeric(7, 4) default 0;

alter table stock.reception_items
  add column if not exists supplier_tax_status stock.supplier_tax_status,
  add column if not exists invoice_tax_mode stock.invoice_tax_mode,
  add column if not exists invoice_amount_ht numeric(14, 2),
  add column if not exists invoice_vat_amount numeric(14, 2),
  add column if not exists invoice_amount_ttc numeric(14, 2),
  add column if not exists vat_rate numeric(7, 4) default 20,
  add column if not exists vat_recoverable boolean default true,
  add column if not exists recoverable_vat_amount numeric(14, 2),
  add column if not exists non_recoverable_vat_amount numeric(14, 2),
  add column if not exists declared_extra_tax_rate numeric(7, 4) default 0,
  add column if not exists declared_extra_tax_amount numeric(14, 2),
  add column if not exists accounting_total_amount numeric(14, 2),
  add column if not exists effective_material_cost_total numeric(14, 2),
  add column if not exists effective_material_unit_cost numeric(14, 4),
  add column if not exists effective_cost_method stock.effective_cost_method,
  add column if not exists effective_cost_source text,
  add column if not exists effective_cost_note text;

alter table stock.invoices
  add column if not exists supplier_tax_status stock.supplier_tax_status,
  add column if not exists invoice_tax_mode stock.invoice_tax_mode default 'invoice_with_recoverable_vat',
  add column if not exists vat_rate numeric(7, 4) default 20,
  add column if not exists vat_recoverable boolean default true,
  add column if not exists recoverable_vat_amount numeric(14, 2),
  add column if not exists non_recoverable_vat_amount numeric(14, 2),
  add column if not exists declared_extra_tax_rate numeric(7, 4) default 0,
  add column if not exists declared_extra_tax_amount numeric(14, 2),
  add column if not exists accounting_total_amount numeric(14, 2),
  add column if not exists effective_material_cost_total numeric(14, 2),
  add column if not exists effective_cost_method stock.effective_cost_method,
  add column if not exists effective_cost_source text,
  add column if not exists effective_cost_note text;

alter table stock.invoice_items
  add column if not exists supplier_tax_status stock.supplier_tax_status,
  add column if not exists invoice_tax_mode stock.invoice_tax_mode,
  add column if not exists invoice_amount_ht numeric(14, 2),
  add column if not exists invoice_vat_amount numeric(14, 2),
  add column if not exists invoice_amount_ttc numeric(14, 2),
  add column if not exists vat_rate numeric(7, 4) default 20,
  add column if not exists vat_recoverable boolean default true,
  add column if not exists recoverable_vat_amount numeric(14, 2),
  add column if not exists non_recoverable_vat_amount numeric(14, 2),
  add column if not exists declared_extra_tax_rate numeric(7, 4) default 0,
  add column if not exists declared_extra_tax_amount numeric(14, 2),
  add column if not exists accounting_total_amount numeric(14, 2),
  add column if not exists effective_material_cost_total numeric(14, 2),
  add column if not exists effective_material_unit_cost numeric(14, 4),
  add column if not exists effective_cost_method stock.effective_cost_method,
  add column if not exists effective_cost_source text,
  add column if not exists effective_cost_note text;

alter table stock.stock_movements
  add column if not exists effective_material_unit_cost numeric(14, 4),
  add column if not exists effective_material_cost_total numeric(14, 2),
  add column if not exists effective_cost_method stock.effective_cost_method,
  add column if not exists effective_cost_source text;

alter table stock.stock_pending_movements
  add column if not exists effective_material_unit_cost numeric(14, 4),
  add column if not exists effective_material_cost_total numeric(14, 2),
  add column if not exists effective_cost_method stock.effective_cost_method,
  add column if not exists effective_cost_source text;

update stock.reception_items
set
  invoice_tax_mode = coalesce(invoice_tax_mode, 'invoice_with_recoverable_vat'),
  invoice_amount_ht = coalesce(invoice_amount_ht, quantity_accepted * unit_price_real),
  invoice_vat_amount = coalesce(invoice_vat_amount, 0),
  invoice_amount_ttc = coalesce(invoice_amount_ttc, quantity_accepted * unit_price_real),
  recoverable_vat_amount = coalesce(recoverable_vat_amount, 0),
  non_recoverable_vat_amount = coalesce(non_recoverable_vat_amount, 0),
  declared_extra_tax_amount = coalesce(declared_extra_tax_amount, 0),
  accounting_total_amount = coalesce(accounting_total_amount, quantity_accepted * unit_price_real),
  effective_material_cost_total = coalesce(effective_material_cost_total, quantity_accepted * unit_price_real),
  effective_material_unit_cost = coalesce(effective_material_unit_cost, unit_price_real),
  effective_cost_method = coalesce(effective_cost_method, 'invoice_ht_vat_recoverable'),
  effective_cost_source = coalesce(effective_cost_source, 'reception')
where effective_material_unit_cost is null;

update stock.invoice_items
set
  invoice_tax_mode = coalesce(invoice_tax_mode, 'invoice_with_recoverable_vat'),
  invoice_amount_ht = coalesce(invoice_amount_ht, quantity * unit_price),
  invoice_vat_amount = coalesce(invoice_vat_amount, 0),
  invoice_amount_ttc = coalesce(invoice_amount_ttc, quantity * unit_price),
  recoverable_vat_amount = coalesce(recoverable_vat_amount, 0),
  non_recoverable_vat_amount = coalesce(non_recoverable_vat_amount, 0),
  declared_extra_tax_amount = coalesce(declared_extra_tax_amount, 0),
  accounting_total_amount = coalesce(accounting_total_amount, quantity * unit_price),
  effective_material_cost_total = coalesce(effective_material_cost_total, quantity * unit_price),
  effective_material_unit_cost = coalesce(effective_material_unit_cost, unit_price),
  effective_cost_method = coalesce(effective_cost_method, 'invoice_ht_vat_recoverable'),
  effective_cost_source = coalesce(effective_cost_source, 'invoice')
where effective_material_unit_cost is null;

update stock.invoices
set
  recoverable_vat_amount = coalesce(recoverable_vat_amount, amount_tva),
  non_recoverable_vat_amount = coalesce(non_recoverable_vat_amount, 0),
  declared_extra_tax_amount = coalesce(declared_extra_tax_amount, 0),
  accounting_total_amount = coalesce(accounting_total_amount, amount_ttc),
  effective_material_cost_total = coalesce(effective_material_cost_total, amount_ht),
  effective_cost_method = coalesce(effective_cost_method, 'invoice_ht_vat_recoverable'),
  effective_cost_source = coalesce(effective_cost_source, 'invoice')
where effective_material_cost_total is null;

CREATE OR REPLACE FUNCTION handle_movement_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_unit_price numeric(14, 4);
  v_avg_price numeric(14, 4);
BEGIN
  IF NEW.reception_item_id IS NOT NULL THEN
    SELECT COALESCE(effective_material_unit_cost, unit_price_real)
    INTO v_unit_price
    FROM reception_items
    WHERE id = NEW.reception_item_id;

    NEW.unit_cost = v_unit_price;
    NEW.effective_material_unit_cost = v_unit_price;
    NEW.effective_cost_method = COALESCE(NEW.effective_cost_method, 'invoice_ht_vat_recoverable');
    NEW.effective_cost_source = COALESCE(NEW.effective_cost_source, 'reception');
    NEW.price_source = 'reception';
  ELSIF NEW.movement_type IN ('sortie', 'transfert', 'perte', 'consommation') THEN
    SELECT COALESCE(SUM(quantity * COALESCE(effective_material_unit_cost, unit_cost)) / NULLIF(SUM(quantity), 0), 0)
    INTO v_avg_price
    FROM stock_movements
    WHERE article_id = NEW.article_id
    AND movement_type IN ('entree', 'correction', 'ajustement')
    AND COALESCE(effective_material_unit_cost, unit_cost) IS NOT NULL
    AND quantity > 0
    AND status IN ('normal', 'retroactif', 'valide');

    NEW.unit_cost = v_avg_price;
    NEW.effective_material_unit_cost = v_avg_price;
    NEW.effective_cost_method = COALESCE(NEW.effective_cost_method, 'invoice_amount_no_vat');
    NEW.effective_cost_source = COALESCE(NEW.effective_cost_source, 'average');
    NEW.price_source = 'average';
  ELSIF NEW.unit_cost IS NOT NULL THEN
    NEW.effective_material_unit_cost = COALESCE(NEW.effective_material_unit_cost, NEW.unit_cost);
    NEW.effective_cost_method = COALESCE(NEW.effective_cost_method, CASE WHEN NEW.movement_type IN ('correction', 'ajustement') THEN 'manual_validated_cost' ELSE 'invoice_amount_no_vat' END);
    NEW.effective_cost_source = COALESCE(NEW.effective_cost_source, 'manual');
    NEW.price_source = CASE
      WHEN NEW.movement_type IN ('correction', 'ajustement') THEN 'correction'::price_source_type
      ELSE 'manual'::price_source_type
    END;
  ELSE
    RAISE EXCEPTION 'Le prix unitaire est obligatoire pour ce type de mouvement';
  END IF;

  NEW.effective_material_cost_total = COALESCE(NEW.effective_material_cost_total, NEW.quantity * NEW.effective_material_unit_cost);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

drop view if exists stock.price_history_view;
drop view if exists stock.stock_view;

create or replace view stock.stock_view as
select
  article_id,
  sum(quantity) as total_quantity,
  (
    select coalesce(sm.effective_material_unit_cost, sm.unit_cost)
    from stock.stock_movements sm
    where sm.article_id = movements.article_id
    and sm.movement_type in ('entree', 'correction', 'ajustement')
    and coalesce(sm.effective_material_unit_cost, sm.unit_cost) is not null
    and sm.status in ('normal', 'retroactif', 'valide')
    order by sm.movement_date desc, sm.created_at desc
    limit 1
  )::numeric as last_price,
  (
    select coalesce(sum(sm.quantity * coalesce(sm.effective_material_unit_cost, sm.unit_cost)) / nullif(sum(sm.quantity), 0), 0)
    from stock.stock_movements sm
    where sm.article_id = movements.article_id
    and sm.movement_type in ('entree', 'correction', 'ajustement')
    and coalesce(sm.effective_material_unit_cost, sm.unit_cost) is not null
    and sm.quantity > 0
    and sm.status in ('normal', 'retroactif', 'valide')
  )::numeric as average_price
from (
  select article_id, unit_id, quantity, movement_type, coalesce(effective_material_unit_cost, unit_cost) as unit_cost
  from stock.stock_movements
  where movement_type in ('entree', 'retour', 'correction', 'ajustement')
  and status in ('normal', 'retroactif', 'valide')
  union all
  select article_id, unit_id, -quantity, movement_type, coalesce(effective_material_unit_cost, unit_cost) as unit_cost
  from stock.stock_movements
  where movement_type in ('sortie', 'perte', 'consommation')
  and status in ('normal', 'retroactif', 'valide')
  union all
  select article_id, unit_id, 0, movement_type, coalesce(effective_material_unit_cost, unit_cost) as unit_cost
  from stock.stock_movements
  where movement_type = 'transfert'
  and status in ('normal', 'retroactif', 'valide')
) movements
group by article_id;

create or replace view stock.price_history_view as
select
  id,
  article_id,
  movement_date,
  coalesce(effective_material_unit_cost, unit_cost) as unit_cost,
  quantity,
  price_source,
  reference_type,
  reference_id,
  movement_reference,
  effective_cost_method,
  effective_cost_source,
  created_at
from stock.stock_movements
where movement_type in ('entree', 'correction', 'ajustement')
and coalesce(effective_material_unit_cost, unit_cost) is not null
and status in ('normal', 'retroactif', 'valide')
order by movement_date desc;

create index if not exists idx_reception_items_effective_material_unit_cost on stock.reception_items(effective_material_unit_cost);
create index if not exists idx_invoice_items_effective_material_unit_cost on stock.invoice_items(effective_material_unit_cost);
create index if not exists idx_stock_movements_effective_material_unit_cost on stock.stock_movements(effective_material_unit_cost);

notify pgrst, 'reload schema';
