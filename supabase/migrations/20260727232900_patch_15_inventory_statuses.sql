-- Valeurs ajoutees dans une migration separee afin qu'elles soient utilisables
-- par les fonctions de la migration suivante (regle PostgreSQL ALTER TYPE).
-- Migration locale uniquement.

alter type stock.inventory_status add value if not exists 'en_saisie';
alter type stock.inventory_status add value if not exists 'saisi';
alter type stock.inventory_status add value if not exists 'a_controler';
alter type stock.inventory_status add value if not exists 'a_valider_direction';
alter type stock.inventory_status add value if not exists 'corrections_generees';
alter type stock.inventory_status add value if not exists 'cloture';
alter type stock.inventory_status add value if not exists 'annule';
alter type stock.inventory_status add value if not exists 'cloture_avec_reserve';
