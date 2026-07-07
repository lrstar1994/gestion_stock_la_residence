create schema if not exists stock;
set search_path = stock, public, auth;

alter table stock.purchase_needs
  add column if not exists price_input_amount decimal(14, 2),
  add column if not exists price_input_is_tax_excluded boolean default true,
  add column if not exists vat_rate decimal(5, 2) default 20,
  add column if not exists estimated_vat_amount decimal(14, 2),
  add column if not exists estimated_price_ttc decimal(14, 2);

update stock.purchase_needs
set
  price_input_amount = coalesce(price_input_amount, estimated_price),
  price_input_is_tax_excluded = coalesce(price_input_is_tax_excluded, true),
  vat_rate = coalesce(vat_rate, 20),
  estimated_vat_amount = coalesce(estimated_vat_amount, estimated_price * 0.20),
  estimated_price_ttc = coalesce(estimated_price_ttc, estimated_price * 1.20)
where estimated_price is not null;

notify pgrst, 'reload schema';
