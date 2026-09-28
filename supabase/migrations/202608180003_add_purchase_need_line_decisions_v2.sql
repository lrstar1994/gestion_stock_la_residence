-- V2 locale uniquement : décision Direction et orientation opérationnelle par ligne.
-- Ne pas exécuter avant validation explicite. Aucun traitement distant n'est effectué ici.

alter table stock.purchase_needs
  add column if not exists decision_status text,
  add column if not exists processing_mode text,
  add column if not exists processing_supplier_id uuid,
  add column if not exists refused_reason text,
  add column if not exists direction_comment text,
  add column if not exists decided_by uuid,
  add column if not exists decided_at timestamptz;

-- Compatibilité avec l'ancienne préparation si elle a été appliquée localement.
alter table stock.purchase_needs
  drop constraint if exists purchase_needs_decision_status_check;
alter table stock.purchase_needs
  drop constraint if exists purchase_needs_processing_mode_check;
alter table stock.purchase_needs
  drop constraint if exists purchase_needs_line_decision_consistency_check;

do $$ begin if not exists (select 1 from pg_constraint where conname = 'purchase_needs_processing_supplier_fkey') then alter table stock.purchase_needs add constraint purchase_needs_processing_supplier_fkey foreign key (processing_supplier_id) references stock.suppliers(id); end if; end $$;

do $$ begin if not exists (select 1 from pg_constraint where conname = 'purchase_needs_decided_by_fkey') then alter table stock.purchase_needs add constraint purchase_needs_decided_by_fkey foreign key (decided_by) references stock.profiles(id); end if; end $$;

do $$ begin if not exists (select 1 from pg_constraint where conname = 'purchase_needs_line_decision_status_check') then alter table stock.purchase_needs add constraint purchase_needs_line_decision_status_check check (decision_status is null or decision_status in ('pending','approved','refused')) not valid; end if; end $$;

do $$ begin if not exists (select 1 from pg_constraint where conname = 'purchase_needs_line_processing_mode_check') then alter table stock.purchase_needs add constraint purchase_needs_line_processing_mode_check check (processing_mode is null or processing_mode in ('none','cash','supplier','to_reorient')) not valid; end if; end $$;

do $$ begin if not exists (select 1 from pg_constraint where conname = 'purchase_needs_line_decision_consistency_check_v2') then alter table stock.purchase_needs add constraint purchase_needs_line_decision_consistency_check_v2 check ((decision_status <> 'refused' or nullif(btrim(refused_reason),'') is not null) and (processing_mode <> 'supplier' or processing_supplier_id is not null) and (processing_mode <> 'cash' or processing_supplier_id is null) and (processing_mode <> 'to_reorient' or decision_status = 'approved') and (decision_status <> 'refused' or processing_mode is null or processing_mode = 'none')) not valid; end if; end $$;

create index if not exists purchase_needs_processing_supplier_idx
  on stock.purchase_needs(processing_supplier_id)
  where processing_supplier_id is not null;

create index if not exists purchase_needs_decision_status_idx
  on stock.purchase_needs(decision_status);

comment on column stock.purchase_needs.decision_status is
  'Décision Direction par ligne : pending, approved ou refused.';
comment on column stock.purchase_needs.processing_mode is
  'Orientation par ligne : none, cash, supplier ou to_reorient.';
comment on column stock.purchase_needs.direction_comment is
  'Commentaire facultatif de la Direction sur la décision de ligne.';