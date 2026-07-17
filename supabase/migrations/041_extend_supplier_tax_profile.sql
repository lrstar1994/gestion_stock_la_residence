create schema if not exists stock;
set search_path = stock, public, auth;

alter table stock.suppliers
  add column if not exists is_identified boolean default false,
  add column if not exists usually_issues_vat_invoice boolean default false,
  add column if not exists default_vat_rate numeric(7, 4) default 20,
  add column if not exists is_usual_without_nif_stat boolean default false,
  add column if not exists default_declared_extra_tax_enabled boolean default false,
  add column if not exists occasional_purchase_alert_threshold numeric(14, 2) default 1000000;

update stock.suppliers
set
  is_identified = coalesce(is_identified, false) or nullif(trim(coalesce(nif, '')), '') is not null or nullif(trim(coalesce(stat, '')), '') is not null,
  usually_issues_vat_invoice = coalesce(usually_issues_vat_invoice, false) or supplier_tax_status = 'nif_stat_with_vat',
  default_vat_rate = coalesce(default_vat_rate, 20),
  is_usual_without_nif_stat = coalesce(is_usual_without_nif_stat, false) or supplier_tax_status in ('no_nif_stat_declared', 'no_nif_stat_not_declared'),
  default_declared_extra_tax_enabled = coalesce(default_declared_extra_tax_enabled, false) or default_declared_extra_tax_rate > 0,
  occasional_purchase_alert_threshold = coalesce(occasional_purchase_alert_threshold, 1000000);

create index if not exists idx_suppliers_supplier_tax_status on stock.suppliers(supplier_tax_status);
create index if not exists idx_suppliers_is_identified on stock.suppliers(is_identified);

notify pgrst, 'reload schema';
