-- Correction ciblée V1 : achats espèces avec article catalogue ou désignation libre.
-- Cette migration locale est destinée au projet Supabase de test avant toute
-- décision séparée concernant la base réelle.

alter table stock.cash_purchase_items
  add column if not exists free_designation text,
  add column if not exists article_match_status text not null default 'matched';

alter table stock.cash_purchase_items
  alter column article_id drop not null;

alter table stock.cash_purchase_items
  drop constraint if exists cash_purchase_items_article_match_status_check,
  drop constraint if exists cash_purchase_items_article_reference_check;

alter table stock.cash_purchase_items
  add constraint cash_purchase_items_article_match_status_check
    check (article_match_status in ('matched', 'to_create_or_match')),
  add constraint cash_purchase_items_article_reference_check
    check (
      (
        article_id is not null
        and article_match_status = 'matched'
      )
      or
      (
        article_id is null
        and article_match_status = 'to_create_or_match'
        and nullif(btrim(free_designation), '') is not null
      )
    );

comment on column stock.cash_purchase_items.free_designation is
  'Désignation saisie lorsque l''article n''existe pas encore dans le catalogue.';

comment on column stock.cash_purchase_items.article_match_status is
  'matched si article_id est renseigné, to_create_or_match pour une désignation libre.';
