create schema if not exists stock;

grant usage on schema stock to anon, authenticated;

alter default privileges in schema stock
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema stock
  grant usage, select on sequences to authenticated;

alter default privileges in schema stock
  grant execute on functions to anon, authenticated;

set search_path = stock, public, auth;