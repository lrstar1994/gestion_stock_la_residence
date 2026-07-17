create schema if not exists stock;
set search_path = stock, public, auth;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'stock'::regnamespace and typname = 'invoice_payment_status') then
    create type stock.invoice_payment_status as enum (
      'a_preparer',
      'prepare',
      'a_valider_direction',
      'refuse_direction',
      'valide_direction',
      'a_executer',
      'execute',
      'annule'
    );
  end if;
end $$;

alter table stock.invoice_payments
  add column if not exists status stock.invoice_payment_status default 'execute',
  add column if not exists planned_payment_date date,
  add column if not exists planned_by uuid references stock.profiles(id),
  add column if not exists planned_at timestamp with time zone,
  add column if not exists validated_by uuid references stock.profiles(id),
  add column if not exists validated_at timestamp with time zone,
  add column if not exists validation_comment text,
  add column if not exists refused_by uuid references stock.profiles(id),
  add column if not exists refused_at timestamp with time zone,
  add column if not exists refusal_reason text,
  add column if not exists executed_by uuid references stock.profiles(id),
  add column if not exists executed_at timestamp with time zone,
  add column if not exists execution_comment text,
  add column if not exists cash_account text,
  add column if not exists beneficiary text;

update stock.invoice_payments
set
  status = coalesce(status, 'execute'),
  planned_payment_date = coalesce(planned_payment_date, payment_date),
  planned_by = coalesce(planned_by, created_by),
  planned_at = coalesce(planned_at, created_at),
  executed_by = coalesce(executed_by, created_by),
  executed_at = coalesce(executed_at, created_at)
where status is null
   or planned_payment_date is null
   or planned_at is null
   or executed_at is null;

create index if not exists idx_invoice_payments_status on stock.invoice_payments(status);
create index if not exists idx_invoice_payments_planned_date on stock.invoice_payments(planned_payment_date);
create index if not exists idx_invoice_payments_validated_by on stock.invoice_payments(validated_by);
create index if not exists idx_invoice_payments_executed_by on stock.invoice_payments(executed_by);

notify pgrst, 'reload schema';
