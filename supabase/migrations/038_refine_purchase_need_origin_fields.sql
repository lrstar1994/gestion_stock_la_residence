create schema if not exists stock;
set search_path = stock, public, auth;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'stock'::regnamespace and typname = 'need_type') then
    create type stock.need_type as enum (
      'reapprovisionnement_normal',
      'besoin_ponctuel',
      'urgence_rupture',
      'remplacement_anomalie',
      'demande_exceptionnelle_direction'
    );
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'stock'::regnamespace and typname = 'need_destination') then
    create type stock.need_destination as enum (
      'stock_general',
      'cuisine_production',
      'salle_bar_service_client',
      'evenement_banquet_seminaire',
      'chambres_hebergement',
      'maintenance_travaux',
      'administration_bureau',
      'immobilisation_equipement',
      'autre'
    );
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'stock'::regnamespace and typname = 'need_calculation_source') then
    create type stock.need_calculation_source as enum (
      'saisie_manuelle',
      'seuil_stock',
      'besoins_theoriques_evenement',
      'fiche_technique',
      'historique_consommation',
      'demande_direction',
      'autre'
    );
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'stock'::regnamespace and typname = 'requesting_service') then
    create type stock.requesting_service as enum (
      'direction',
      'cuisine',
      'fiche_technique',
      'magasin',
      'achats',
      'maintenance',
      'comptabilite',
      'caisse',
      'point_vente',
      'hebergement',
      'administration',
      'autre'
    );
  end if;
end $$;

alter table stock.purchase_needs
  add column if not exists type_de_besoin stock.need_type,
  add column if not exists destination_prevue stock.need_destination,
  add column if not exists source_du_calcul stock.need_calculation_source,
  add column if not exists service_demandeur stock.requesting_service;

update stock.purchase_needs
set
  type_de_besoin = coalesce(
    type_de_besoin,
    case
      when urgency = 'tres_urgent' then 'urgence_rupture'::stock.need_type
      when origin = 'seuil_minimum' then 'reapprovisionnement_normal'::stock.need_type
      else 'besoin_ponctuel'::stock.need_type
    end
  ),
  destination_prevue = coalesce(
    destination_prevue,
    case origin
      when 'evenement' then 'evenement_banquet_seminaire'::stock.need_destination
      when 'production' then 'cuisine_production'::stock.need_destination
      when 'maintenance' then 'maintenance_travaux'::stock.need_destination
      when 'chambres' then 'chambres_hebergement'::stock.need_destination
      when 'administration' then 'administration_bureau'::stock.need_destination
      else 'stock_general'::stock.need_destination
    end
  ),
  source_du_calcul = coalesce(
    source_du_calcul,
    case origin
      when 'evenement' then 'besoins_theoriques_evenement'::stock.need_calculation_source
      when 'seuil_minimum' then 'seuil_stock'::stock.need_calculation_source
      when 'production' then 'fiche_technique'::stock.need_calculation_source
      else 'saisie_manuelle'::stock.need_calculation_source
    end
  ),
  service_demandeur = coalesce(
    service_demandeur,
    case origin
      when 'maintenance' then 'maintenance'::stock.requesting_service
      when 'chambres' then 'hebergement'::stock.requesting_service
      when 'administration' then 'administration'::stock.requesting_service
      else 'cuisine'::stock.requesting_service
    end
  );

alter table stock.purchase_needs
  alter column type_de_besoin set default 'besoin_ponctuel',
  alter column destination_prevue set default 'stock_general',
  alter column source_du_calcul set default 'saisie_manuelle',
  alter column service_demandeur set default 'cuisine';

create index if not exists idx_purchase_needs_type_de_besoin on stock.purchase_needs(type_de_besoin);
create index if not exists idx_purchase_needs_destination_prevue on stock.purchase_needs(destination_prevue);
create index if not exists idx_purchase_needs_source_du_calcul on stock.purchase_needs(source_du_calcul);
create index if not exists idx_purchase_needs_service_demandeur on stock.purchase_needs(service_demandeur);

notify pgrst, 'reload schema';
