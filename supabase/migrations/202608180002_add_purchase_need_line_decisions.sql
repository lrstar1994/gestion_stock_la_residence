-- Préparation locale uniquement : décision/orientation Direction par ligne purchase_needs.
-- Ne pas exécuter sur le Supabase réel. Migration idempotente pour le projet test après validation.
alter table stock.purchase_needs
  add column if not exists decision_status text,
  add column if not exists processing_mode text,
  add column if not exists processing_supplier_id uuid,
  add column if not exists refused_reason text,
  add column if not exists decided_by uuid,
  add column if not exists decided_at timestamptz;

alter table stock.purchase_needs
  add constraint purchase_needs_decision_status_check
  check (decision_status is null or decision_status in ('pending','refused','cash','supplier'));

alter table stock.purchase_needs
  add constraint purchase_needs_processing_mode_check
  check (processing_mode is null or processing_mode in ('cash','supplier'));

create index if not exists purchase_needs_processing_supplier_idx
  on stock.purchase_needs(processing_supplier_id)
  where processing_supplier_id is not null;

comment on column stock.purchase_needs.decision_status is 'Décision Direction par ligne : pending, refused, cash ou supplier.';
comment on column stock.purchase_needs.processing_mode is 'Orientation opérationnelle de la ligne après décision Direction.';