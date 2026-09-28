--
-- PostgreSQL database dump
--

\restrict 4XZ4xjsBEMAwLhjo1xTARYajUhgN4Hp99wj2O0aRazEMdt96IkZwh3fPe9CkiLI

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: domaine_operation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.domaine_operation AS ENUM (
    'maintenance',
    'chambres',
    'salles'
);


--
-- Name: role_utilisateur; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.role_utilisateur AS ENUM (
    'admin',
    'coordinateur'
);


--
-- Name: anomaly_type; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.anomaly_type AS ENUM (
    'quantite_manquante',
    'prix_different',
    'produit_abime',
    'produit_non_conforme',
    'livraison_partielle',
    'erreur_facture',
    'achat_non_autorise',
    'produit_paye_non_recu'
);


--
-- Name: article_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.article_status AS ENUM (
    'active',
    'inactive',
    'archived'
);


--
-- Name: cash_purchase_source; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.cash_purchase_source AS ENUM (
    'caisse_principale',
    'caisse_privilege',
    'caisse_piscine'
);


--
-- Name: cash_purchase_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.cash_purchase_status AS ENUM (
    'en_attente',
    'valide',
    'especes_remises',
    'retour_partiel',
    'retour_complet',
    'cloture',
    'refuse'
);


--
-- Name: consumption_type; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.consumption_type AS ENUM (
    'normale',
    'surconsommation',
    'economie',
    'perte'
);


--
-- Name: difference_type; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.difference_type AS ENUM (
    'change_not_returned',
    'price_difference',
    'quantity_missing',
    'product_not_conforming',
    'invoice_error',
    'advance_overrun'
);


--
-- Name: effective_cost_method; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.effective_cost_method AS ENUM (
    'invoice_ht_vat_recoverable',
    'invoice_amount_no_vat',
    'invoice_ttc_vat_not_recoverable',
    'supplier_amount_plus_declared_tax',
    'manual_validated_cost',
    'unavailable'
);


--
-- Name: event_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.event_status AS ENUM (
    'planifie',
    'en_production',
    'termine',
    'annule'
);


--
-- Name: event_type; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.event_type AS ENUM (
    'buffet',
    'brunch',
    'seminaire',
    'business_lunch',
    'cocktail',
    'take_away',
    'patisserie',
    'autre'
);


--
-- Name: interest_level; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.interest_level AS ENUM (
    'tres_demande',
    'normal',
    'complement',
    'decouverte',
    'appoint',
    'condiment'
);


--
-- Name: inventory_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.inventory_status AS ENUM (
    'brouillon',
    'en_attente',
    'valide',
    'corrige',
    'archive'
);


--
-- Name: inventory_type; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.inventory_type AS ENUM (
    'initial',
    'periodique',
    'exceptionnel',
    'controle'
);


--
-- Name: invoice_payment_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.invoice_payment_status AS ENUM (
    'a_preparer',
    'prepare',
    'a_valider_direction',
    'refuse_direction',
    'valide_direction',
    'a_executer',
    'execute',
    'annule'
);


--
-- Name: invoice_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.invoice_status AS ENUM (
    'a_verifier',
    'validee',
    'a_payer',
    'payee',
    'partiellement_paye',
    'conteste',
    'cloturee',
    'annulee'
);


--
-- Name: invoice_tax_mode; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.invoice_tax_mode AS ENUM (
    'invoice_with_recoverable_vat',
    'invoice_without_vat',
    'invoice_ttc_vat_not_recoverable',
    'declared_with_extra_tax',
    'manual_validated'
);


--
-- Name: loss_type; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.loss_type AS ENUM (
    'casse',
    'erreur',
    'qualite',
    'autre'
);


--
-- Name: movement_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.movement_status AS ENUM (
    'normal',
    'retroactif',
    'annule',
    'en_attente',
    'valide'
);


--
-- Name: movement_type; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.movement_type AS ENUM (
    'entree',
    'sortie',
    'transfert',
    'retour',
    'perte',
    'consommation',
    'correction',
    'ajustement'
);


--
-- Name: need_calculation_source; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.need_calculation_source AS ENUM (
    'saisie_manuelle',
    'seuil_stock',
    'besoins_theoriques_evenement',
    'fiche_technique',
    'historique_consommation',
    'demande_direction',
    'autre'
);


--
-- Name: need_destination; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.need_destination AS ENUM (
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


--
-- Name: need_origin; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.need_origin AS ENUM (
    'evenement',
    'production',
    'seuil_minimum',
    'maintenance',
    'entretien',
    'chambres',
    'administration',
    'demande_manuelle'
);


--
-- Name: need_type; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.need_type AS ENUM (
    'reapprovisionnement_normal',
    'besoin_ponctuel',
    'urgence_rupture',
    'remplacement_anomalie',
    'demande_exceptionnelle_direction'
);


--
-- Name: need_urgency; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.need_urgency AS ENUM (
    'normal',
    'urgent',
    'tres_urgent'
);


--
-- Name: payment_mode; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.payment_mode AS ENUM (
    'especes',
    'virement',
    'mobile_money',
    'cheque',
    'credit_fournisseur',
    'autre'
);


--
-- Name: pending_ingredient_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.pending_ingredient_status AS ENUM (
    'pending',
    'resolved',
    'ambiguous',
    'new_created'
);


--
-- Name: price_source_type; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.price_source_type AS ENUM (
    'reception',
    'manual',
    'average',
    'correction'
);


--
-- Name: product_type; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.product_type AS ENUM (
    'produit_fini',
    'produit_brut'
);


--
-- Name: purchase_need_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.purchase_need_status AS ENUM (
    'a_faire',
    'en_cours',
    'termine',
    'annule',
    'valide',
    'regroupe',
    'refuse'
);


--
-- Name: purchase_order_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.purchase_order_status AS ENUM (
    'brouillon',
    'validee',
    'envoyee',
    'partiellement_livree',
    'livree',
    'reception_avec_ecart',
    'annulee',
    'cloturee'
);


--
-- Name: quality_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.quality_status AS ENUM (
    'conforme',
    'non_conforme',
    'a_verifier'
);


--
-- Name: reception_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.reception_status AS ENUM (
    'brouillon',
    'en_attente',
    'validee',
    'validee_avec_anomalies',
    'entree_stock',
    'refusee'
);


--
-- Name: recipe_main_ingredient; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.recipe_main_ingredient AS ENUM (
    'POU',
    'ZEB',
    'POR',
    'POI',
    'CRV',
    'OEU',
    'LEG',
    'FEC',
    'FRO',
    'FRU',
    'CHO',
    'VAN',
    'MIX'
);


--
-- Name: recipe_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.recipe_status AS ENUM (
    'brouillon',
    'simulation',
    'en_attente',
    'validee',
    'archived'
);


--
-- Name: recipe_tag; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.recipe_tag AS ENUM (
    'economique',
    'festif',
    'malagasy',
    'enfant',
    'vegetarien',
    'tres_apprecie',
    'ameliorer'
);


--
-- Name: recipe_type; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.recipe_type AS ENUM (
    'EF',
    'EC',
    'PL',
    'ACC',
    'DS',
    'PC-S',
    'PC-SU',
    'CO-S',
    'CO-SU',
    'SAU',
    'PREP',
    'BOI',
    'BF'
);


--
-- Name: requesting_service; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.requesting_service AS ENUM (
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


--
-- Name: sales_channel; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.sales_channel AS ENUM (
    'whatsapp',
    'facebook',
    'telephone',
    'reception',
    'client_direct',
    'formulaire',
    'commercial'
);


--
-- Name: sales_point; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.sales_point AS ENUM (
    'le_privilege',
    'piscine',
    'reception',
    'chambre',
    'evenement',
    'take_away'
);


--
-- Name: sales_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.sales_status AS ENUM (
    'validee',
    'annulee',
    'retournee'
);


--
-- Name: service_mode; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.service_mode AS ENUM (
    'sur_place',
    'take_away',
    'livraison',
    'room_service',
    'evenement',
    'seminaire'
);


--
-- Name: service_type; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.service_type AS ENUM (
    'assiette',
    'buffet'
);


--
-- Name: stock_out_destination; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.stock_out_destination AS ENUM (
    'recette',
    'production',
    'buffet',
    'seminaire',
    'restaurant',
    'take_away',
    'piscine',
    'chambre',
    'maintenance',
    'entretien',
    'consommation_interne',
    'perte',
    'casse',
    'autre'
);


--
-- Name: supplier_tax_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.supplier_tax_status AS ENUM (
    'nif_stat_with_vat',
    'nif_stat_without_vat',
    'no_nif_stat_declared',
    'no_nif_stat_not_declared',
    'unknown'
);


--
-- Name: user_role; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.user_role AS ENUM (
    'direction',
    'chef_cuisine',
    'fiche_technique',
    'magasinier',
    'caisse',
    'comptabilite',
    'acheteur',
    'point_vente',
    'maintenance',
    'consultation'
);


--
-- Name: user_status; Type: TYPE; Schema: stock; Owner: -
--

CREATE TYPE stock.user_status AS ENUM (
    'pending_validation',
    'active',
    'inactive',
    'rejected'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: creer_chauffe_eau_depuis_planning(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.creer_chauffe_eau_depuis_planning() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  type_nom text;
  action_date date;
  action_type text;
BEGIN
  SELECT upper(nom) INTO type_nom
  FROM public.type_mouvement
  WHERE id = NEW.id_type_mouvement;

  IF type_nom LIKE '%ARRIVEE%' THEN
    action_date := NEW.date - 1;
    action_type := 'ALLUMER';
  ELSIF type_nom LIKE '%DEPART%' THEN
    action_date := NEW.date;
    action_type := 'ETEINDRE';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.chauffe_eau_action (
    id_lieu,
    id_planning_chambre,
    date_action,
    type_action,
    etat,
    commentaire
  )
  VALUES (
    NEW.id_lieu,
    NEW.id,
    action_date,
    action_type,
    'A_FAIRE',
    NULL
  )
  ON CONFLICT (id_lieu, date_action, type_action) DO NOTHING;

  RETURN NEW;
END;
$$;


--
-- Name: creer_tache_chambre_depuis_planning(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.creer_tache_chambre_depuis_planning() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  executant_defaut uuid;
  points_mouvement integer;
  urgence_tache text;
BEGIN
  SELECT b.id_executant_defaut INTO executant_defaut
  FROM public.lieux l
  LEFT JOIN public.batiments b ON b.id = l.id_batiment
  WHERE l.id = NEW.id_lieu;

  SELECT COALESCE(points, 0) INTO points_mouvement
  FROM public.type_mouvement
  WHERE id = NEW.id_type_mouvement;

  urgence_tache := CASE WHEN NEW.date <= CURRENT_DATE THEN 'haute' ELSE 'normale' END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tache_chambre (
      id_planning_chambre,
      id_lieu,
      id_type_mouvement,
      date_mouvement,
      date_execution,
      date_limite,
      id_executant,
      id_etat,
      points,
      urgence,
      motif_blocage,
      commentaire
    )
    VALUES (
      NEW.id,
      NEW.id_lieu,
      NEW.id_type_mouvement,
      NEW.date,
      NEW.date,
      NEW.date,
      COALESCE(NEW.id_executant, executant_defaut),
      NEW.id_etat,
      points_mouvement,
      urgence_tache,
      NEW.motif_blocage,
      NULL
    )
    ON CONFLICT (id_planning_chambre) DO NOTHING;
  ELSE
    UPDATE public.tache_chambre
    SET
      id_lieu = NEW.id_lieu,
      id_type_mouvement = NEW.id_type_mouvement,
      date_mouvement = NEW.date,
      date_execution = NEW.date,
      date_limite = NEW.date,
      id_executant = COALESCE(NEW.id_executant, executant_defaut),
      id_etat = NEW.id_etat,
      points = points_mouvement,
      urgence = urgence_tache,
      motif_blocage = NEW.motif_blocage
    WHERE id_planning_chambre = NEW.id
      AND date_execution = OLD.date
      AND date_limite = OLD.date;

    IF NOT FOUND THEN
      INSERT INTO public.tache_chambre (
        id_planning_chambre,
        id_lieu,
        id_type_mouvement,
        date_mouvement,
        date_execution,
        date_limite,
        id_executant,
        id_etat,
        points,
        urgence,
        motif_blocage,
        commentaire
      )
      VALUES (
        NEW.id,
        NEW.id_lieu,
        NEW.id_type_mouvement,
        NEW.date,
        NEW.date,
        NEW.date,
        COALESCE(NEW.id_executant, executant_defaut),
        NEW.id_etat,
        points_mouvement,
        urgence_tache,
        NEW.motif_blocage,
        NULL
      )
      ON CONFLICT (id_planning_chambre) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: empecher_modification_photos_intervention_fermee(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.empecher_modification_photos_intervention_fermee() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  etat_intervention text;
BEGIN
  SELECT e.nom
  INTO etat_intervention
  FROM public.intervention_maintenance i
  JOIN public.etat_mouvement e ON e.id = i.id_etat
  WHERE i.id = COALESCE(NEW.id_intervention, OLD.id_intervention);

  IF etat_intervention = 'TERMINE' THEN
    RAISE EXCEPTION 'Les photos sont verrouillees apres fermeture.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: est_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.est_admin(utilisateur_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.utilisateurs
    WHERE id = utilisateur_id
      AND role = 'admin'
      AND statut = 1
  );
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Insérer l'utilisateur dans la table 'utilisateurs' avec statut inactif (0)
  INSERT INTO public.utilisateurs (id, email, nom, role, statut)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Utilisateur'),
    'coordinateur',  -- Par défaut, le rôle est coordinateur (attente validation)
    0  -- Statut inactif (en attente)
  );
  RETURN NEW;
END;
$$;


--
-- Name: initialiser_tache_periodique_planning(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialiser_tache_periodique_planning() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  etat_a_faire_id uuid;
BEGIN
  IF NEW.id_etat IS NULL THEN
    SELECT id INTO etat_a_faire_id FROM public.etat_mouvement WHERE nom = 'A_FAIRE';
    NEW.id_etat := etat_a_faire_id;
  END IF;

  IF NEW.date_echeance_originale IS NULL THEN
    NEW.date_echeance_originale := NEW.date_echeance;
  END IF;

  IF NEW.est_reportee = true AND NULLIF(trim(COALESCE(NEW.motif_report, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Un motif est obligatoire pour reporter une tache.';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: peut_gerer_chauffe_eau(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_gerer_chauffe_eau(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.est_admin(uid)
    OR EXISTS (
      SELECT 1
      FROM public.utilisateurs u
      WHERE u.id = uid
        AND u.statut = 1
        AND 'maintenance' = ANY(u.domaines_autorises)
    );
$$;


--
-- Name: peut_gerer_executants(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_gerer_executants(utilisateur_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.utilisateurs
    WHERE id = utilisateur_id
      AND statut = 1
      AND (
        role = 'admin'
        OR (
          role = 'coordinateur'
          AND domaines_autorises && ARRAY['chambres', 'salles']::public.domaine_operation[]
        )
      )
  );
END;
$$;


--
-- Name: peut_gerer_interventions_maintenance(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_gerer_interventions_maintenance(utilisateur_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.utilisateurs
    WHERE id = utilisateur_id
      AND statut = 1
      AND (
        role = 'admin'
        OR (role = 'coordinateur' AND 'maintenance' = ANY(domaines_autorises))
      )
  );
END;
$$;


--
-- Name: peut_gerer_planning_chambre(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_gerer_planning_chambre(utilisateur_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.utilisateurs
    WHERE id = utilisateur_id
      AND statut = 1
      AND (
        role = 'admin'
        OR (role = 'coordinateur' AND 'chambres' = ANY(domaines_autorises))
      )
  );
END;
$$;


--
-- Name: peut_gerer_taches_periodiques(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_gerer_taches_periodiques(utilisateur_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.utilisateurs
    WHERE id = utilisateur_id
      AND statut = 1
      AND (
        role = 'admin'
        OR (
          role = 'coordinateur'
          AND (
            'chambres' = ANY(domaines_autorises)
            OR 'salles' = ANY(domaines_autorises)
          )
        )
      )
  );
END;
$$;


--
-- Name: peut_voir_executant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_voir_executant(utilisateur_id uuid, executant_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.utilisateurs u
    JOIN public.executant e ON e.id = executant_id
    JOIN public.domaine_executant de ON de.id = e.id_domaine
    WHERE u.id = utilisateur_id
      AND u.statut = 1
      AND (
        u.role = 'admin'
        OR (
          u.role = 'coordinateur'
          AND (
            (de.nom ILIKE '%chambre%' AND 'chambres' = ANY(u.domaines_autorises))
            OR (de.nom ILIKE '%salle%' AND 'salles' = ANY(u.domaines_autorises))
            OR (de.nom ILIKE '%maintenance%' AND 'maintenance' = ANY(u.domaines_autorises))
          )
        )
      )
  );
END;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: tracer_chauffe_eau_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tracer_chauffe_eau_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.history_events(entity_type, entity_id, action, id_utilisateur, details)
  VALUES (
    TG_TABLE_NAME,
    NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END,
    auth.uid(),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;


--
-- Name: tracer_etat_planning_chambre(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tracer_etat_planning_chambre() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.id_etat IS DISTINCT FROM NEW.id_etat THEN
    INSERT INTO public.historique_etat_mouvement (
      id_planning_chambre,
      ancien_id_etat,
      nouveau_id_etat,
      motif,
      modifie_par
    )
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.id_etat END,
      NEW.id_etat,
      NEW.motif_blocage,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: tracer_etat_tache_chambre(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tracer_etat_tache_chambre() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  utilisateur_id uuid;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.id_etat IS DISTINCT FROM OLD.id_etat OR NEW.motif_blocage IS DISTINCT FROM OLD.motif_blocage THEN
    SELECT id INTO utilisateur_id
    FROM public.utilisateurs
    WHERE id = auth.uid();

    INSERT INTO public.historique_etat_tache_chambre (
      id_tache_chambre,
      ancien_id_etat,
      nouveau_id_etat,
      motif,
      modifie_par
    )
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.id_etat END,
      NEW.id_etat,
      NEW.motif_blocage,
      utilisateur_id
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: valider_chauffe_eau_action(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_chauffe_eau_action() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.etat = 'BLOQUE' AND NULLIF(trim(COALESCE(NEW.commentaire, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Un commentaire est obligatoire pour bloquer une action chauffe-eau.';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: valider_intervention_maintenance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_intervention_maintenance() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  etat_termine_id uuid;
  photos_apres integer;
BEGIN
  NEW.updated_at := now();

  SELECT id INTO etat_termine_id
  FROM public.etat_mouvement
  WHERE nom = 'TERMINE';

  IF NEW.id_etat = etat_termine_id THEN
    SELECT count(*)
    INTO photos_apres
    FROM public.photo_intervention
    WHERE id_intervention = NEW.id
      AND type_photo = 'apres';

    IF photos_apres = 0 THEN
      RAISE EXCEPTION 'Impossible de fermer une intervention sans photo apres.';
    END IF;

    IF NEW.date_fermeture IS NULL THEN
      NEW.date_fermeture := now();
    END IF;
  ELSE
    NEW.date_fermeture := NULL;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: valider_planning_chambre(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_planning_chambre() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  categorie_code text;
  etat_affecte_id uuid;
BEGIN
  SELECT c.code
  INTO categorie_code
  FROM public.lieux l
  JOIN public.categories_lieu c ON c.id = l.id_categorie
  WHERE l.id = NEW.id_lieu;

  IF categorie_code IS DISTINCT FROM 'chambre' THEN
    RAISE EXCEPTION 'Le planning chambre ne peut concerner que des lieux de categorie chambre.';
  END IF;

  IF NEW.id_etat IS NULL THEN
    SELECT id INTO etat_affecte_id
    FROM public.etat_mouvement
    WHERE nom = 'AFFECTE';

    NEW.id_etat := etat_affecte_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: valider_planning_executant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_planning_executant() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  type_nom text;
BEGIN
  SELECT lower(nom)
  INTO type_nom
  FROM public.type_planning
  WHERE id = NEW.id_type_planning;

  IF type_nom = 'travail' THEN
    IF NEW.heure_debut IS NULL OR NEW.heure_fin IS NULL THEN
      RAISE EXCEPTION 'Les horaires sont obligatoires pour un planning de type travail.';
    END IF;

    IF NEW.heure_fin <= NEW.heure_debut THEN
      RAISE EXCEPTION 'L''heure de fin doit etre superieure a l''heure de debut.';
    END IF;
  ELSE
    NEW.heure_debut := NULL;
    NEW.heure_fin := NULL;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: valider_suivi_planning_chambre(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_suivi_planning_chambre() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  nouveau_etat text;
BEGIN
  SELECT nom INTO nouveau_etat
  FROM public.etat_mouvement
  WHERE id = NEW.id_etat;

  IF nouveau_etat = 'BLOQUE' AND NULLIF(trim(COALESCE(NEW.motif_blocage, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Un motif est obligatoire pour marquer un mouvement comme bloque.';
  END IF;

  IF nouveau_etat <> 'BLOQUE' THEN
    NEW.motif_blocage := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: valider_suivi_tache_chambre(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_suivi_tache_chambre() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  nouveau_etat text;
BEGIN
  SELECT nom INTO nouveau_etat
  FROM public.etat_mouvement
  WHERE id = NEW.id_etat;

  IF nouveau_etat = 'BLOQUE' AND NULLIF(trim(COALESCE(NEW.motif_blocage, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Le motif est obligatoire pour bloquer une tâche chambre';
  END IF;

  IF nouveau_etat <> 'BLOQUE' THEN
    NEW.motif_blocage := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: valider_tache_chambre(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_tache_chambre() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.date_execution > NEW.date_limite THEN
    RAISE EXCEPTION 'La date execution doit etre avant ou egale a la date limite.';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: can_current_user_manage_catalog(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.can_current_user_manage_catalog() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
  select exists (
    select 1
    from stock.profiles
    where user_id = auth.uid()
      and role in ('direction', 'chef_cuisine', 'magasinier', 'acheteur')
      and status = 'active'
  );
$$;


--
-- Name: can_current_user_manage_recipes(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.can_current_user_manage_recipes() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
  select exists (
    select 1 from stock.profiles
    where user_id = auth.uid()
      and role in ('direction', 'chef_cuisine', 'fiche_technique')
      and status = 'active'
  );
$$;


--
-- Name: can_current_user_manage_suppliers(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.can_current_user_manage_suppliers() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
  select exists (
    select 1
    from stock.profiles
    where user_id = auth.uid()
      and role in ('direction', 'acheteur')
      and status = 'active'
  );
$$;


--
-- Name: can_current_user_view_suppliers(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.can_current_user_view_suppliers() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
  select exists (
    select 1
    from stock.profiles
    where user_id = auth.uid()
      and role in ('direction', 'acheteur', 'comptabilite', 'chef_cuisine', 'magasinier')
      and status = 'active'
  );
$$;


--
-- Name: generate_inventory_reference(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.generate_inventory_reference() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
DECLARE
  next_num INTEGER;
  prefix TEXT;
BEGIN
  prefix := 'INVST-' || TO_CHAR(NEW.inventory_date, 'YYYY-MM') || '-';
  SELECT COALESCE(MAX(CAST(REPLACE(reference, prefix, '') AS INTEGER)), 0) + 1
  INTO next_num
  FROM inventories
  WHERE reference LIKE prefix || '%';

  NEW.reference = prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generate_invoice_reference(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.generate_invoice_reference() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
DECLARE
  next_num INTEGER;
  prefix TEXT;
BEGIN
  prefix := 'INV-' || TO_CHAR(NEW.invoice_date, 'YYYY-MM') || '-';
  SELECT COALESCE(MAX(CAST(REPLACE(reference, prefix, '') AS INTEGER)), 0) + 1
  INTO next_num
  FROM invoices
  WHERE reference LIKE prefix || '%';

  NEW.reference = prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generate_movement_reference(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.generate_movement_reference() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
DECLARE
  next_num INTEGER;
  prefix TEXT;
BEGIN
  prefix := 'MV-' || TO_CHAR(NEW.movement_date, 'YYYY-MM-DD') || '-';

  SELECT COALESCE(MAX(CAST(REPLACE(movement_reference, prefix, '') AS INTEGER)), 0) + 1
  INTO next_num
  FROM stock_movements
  WHERE movement_reference LIKE prefix || '%';

  NEW.movement_reference = prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generate_recipe_code(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.generate_recipe_code() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
declare
  max_num integer;
  next_num text;
begin
  if new.status = 'validee' and new.code is null then
    select coalesce(max(cast(substring(code from 8) as integer)), 0) + 1
    into max_num
    from stock.recipes
    where type = new.type
      and main_ingredient = new.main_ingredient
      and status = 'validee'
      and code is not null;

    next_num = lpad(max_num::text, 3, '0');
    new.code = new.type || '-' || new.main_ingredient || '-' || next_num;
  end if;

  return new;
end;
$$;


--
-- Name: generate_sale_reference(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.generate_sale_reference() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
DECLARE
  next_num INTEGER;
  prefix TEXT;
BEGIN
  prefix := 'SALE-' || TO_CHAR(NEW.sale_date, 'YYYY-MM') || '-';
  SELECT COALESCE(MAX(CAST(REPLACE(reference, prefix, '') AS INTEGER)), 0) + 1
  INTO next_num
  FROM sales
  WHERE reference LIKE prefix || '%';

  NEW.reference = prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generate_stock_out_reference(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.generate_stock_out_reference() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
DECLARE
  next_num INTEGER;
  prefix TEXT;
BEGIN
  prefix := 'SO-' || TO_CHAR(NEW.out_date, 'YYYY-MM') || '-';
  SELECT COALESCE(MAX(CAST(REPLACE(reference, prefix, '') AS INTEGER)), 0) + 1
  INTO next_num
  FROM stock_outs
  WHERE reference LIKE prefix || '%';

  NEW.reference = prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$;


--
-- Name: handle_movement_cost(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.handle_movement_cost() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
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
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
begin
  insert into stock.profiles (user_id, email, full_name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'pending_validation'
  );
  return new;
end;
$$;


--
-- Name: is_current_user_direction(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.is_current_user_direction() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
  select exists (
    select 1
    from stock.profiles
    where user_id = auth.uid()
      and role = 'direction'
      and status = 'active'
  );
$$;


--
-- Name: recalculate_recipe_costs(uuid); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.recalculate_recipe_costs(recipe_uuid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
declare
  total decimal(14, 2) := 0;
  recipe_record record;
  suggested decimal(14, 2) := 0;
begin
  select * into recipe_record from stock.recipes where id = recipe_uuid;

  select coalesce(sum(total_cost), 0) into total
  from stock.recipe_ingredients
  where recipe_id = recipe_uuid;

  suggested = total * coalesce(recipe_record.margin_coefficient, 3);

  update stock.recipes
  set
    total_cost = total,
    cost_per_portion = total / nullif(portions, 0),
    suggested_price = suggested,
    cost_ratio = case when final_price > 0 then (total / final_price) * 100 else 0 end,
    margin_rate = case when final_price > 0 then ((final_price - total) / final_price) * 100 else 0 end
  where id = recipe_uuid;
end;
$$;


--
-- Name: recalculate_recipe_costs_trigger(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.recalculate_recipe_costs_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
begin
  perform stock.recalculate_recipe_costs(coalesce(new.recipe_id, old.recipe_id));
  return coalesce(new, old);
end;
$$;


--
-- Name: refresh_purchase_order_status_from_items(uuid, uuid); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.refresh_purchase_order_status_from_items(p_order_id uuid, p_profile_id uuid DEFAULT NULL::uuid) RETURNS stock.purchase_order_status
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
DECLARE
  v_status stock.purchase_order_status;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM stock.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'acheteur', 'magasinier')
      AND profiles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Non autorise a mettre a jour le statut de cette commande';
  END IF;

  SELECT
    CASE
      WHEN COUNT(*) > 0
       AND BOOL_AND(COALESCE(quantity_received, 0) >= COALESCE(quantity_ordered, 0))
        THEN 'livree'::stock.purchase_order_status
      WHEN BOOL_OR(COALESCE(quantity_received, 0) > 0)
        THEN 'partiellement_livree'::stock.purchase_order_status
      ELSE 'envoyee'::stock.purchase_order_status
    END
  INTO v_status
  FROM stock.purchase_order_items
  WHERE purchase_order_id = p_order_id;

  UPDATE stock.purchase_orders
  SET
    status = v_status,
    updated_by = p_profile_id,
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN v_status;
END;
$$;


--
-- Name: refresh_recipe_costs(uuid); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.refresh_recipe_costs(recipe_uuid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
declare
  total decimal(14, 2) := 0;
  suggested decimal(14, 2) := 0;
  recipe_record record;
begin
  select * into recipe_record from stock.recipes where id = recipe_uuid;

  select coalesce(sum(total_cost), 0) into total
  from stock.recipe_ingredients
  where recipe_id = recipe_uuid;

  suggested = total * coalesce(recipe_record.margin_coefficient, 3);

  update stock.recipes
  set
    total_cost = total,
    cost_per_portion = total / nullif(portions, 0),
    suggested_price = suggested,
    cost_ratio = case when final_price > 0 then (total / final_price) * 100 else 0 end,
    margin_rate = case when final_price > 0 then ((final_price - total) / final_price) * 100 else 0 end
  where id = recipe_uuid;
end;
$$;


--
-- Name: set_recipe_ingredient_total(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.set_recipe_ingredient_total() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
begin
  new.total_cost = coalesce(new.quantity_stored, new.quantity) * new.unit_price;
  return new;
end;
$$;


--
-- Name: update_cash_purchase_workflow_status(uuid, text, text, text, uuid); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.update_cash_purchase_workflow_status(p_cash_purchase_id uuid, p_cash_status text DEFAULT NULL::text, p_reception_status text DEFAULT NULL::text, p_stock_entry_status text DEFAULT NULL::text, p_profile_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
begin
  if not exists (
    select 1
    from stock.profiles
    where user_id = auth.uid()
      and status = 'active'
      and role in ('direction', 'acheteur', 'caisse', 'magasinier')
  ) then
    raise exception 'Action non autorisee';
  end if;

  update stock.cash_purchases
  set
    cash_status = coalesce(p_cash_status, cash_status),
    reception_status = coalesce(p_reception_status, reception_status),
    stock_entry_status = coalesce(p_stock_entry_status, stock_entry_status),
    updated_by = p_profile_id,
    updated_at = now()
  where id = p_cash_purchase_id;
end;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: stock; Owner: -
--

CREATE FUNCTION stock.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'stock', 'public', 'auth'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_claims_allowlist text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: batiments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batiments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(10) NOT NULL,
    nom character varying(100) NOT NULL,
    id_executant_defaut uuid
);


--
-- Name: categories_lieu; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories_lieu (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(20) NOT NULL,
    nom character varying(50) NOT NULL
);


--
-- Name: chauffe_eau; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chauffe_eau (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(80) NOT NULL,
    nom character varying(120) NOT NULL,
    description text,
    est_actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chauffe_eau_anomalie; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chauffe_eau_anomalie (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_chauffe_eau uuid NOT NULL,
    id_releve uuid,
    date_anomalie date NOT NULL,
    type_anomalie character varying(40) NOT NULL,
    statut character varying(20) DEFAULT 'a_faire'::character varying NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chauffe_eau_anomalie_statut_check CHECK (((statut)::text = ANY ((ARRAY['a_faire'::character varying, 'en_cours'::character varying, 'terminee'::character varying, 'validee'::character varying, 'refusee'::character varying, 'reprise'::character varying, 'annulee'::character varying])::text[]))),
    CONSTRAINT chauffe_eau_anomalie_type_anomalie_check CHECK (((type_anomalie)::text = ANY ((ARRAY['CRITIQUE_OFF_OCCUPE'::character varying, 'ENERGETIQUE_ON_VIDE'::character varying, 'CONTROLE_MANQUANT'::character varying])::text[])))
);


--
-- Name: chauffe_eau_lieu; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chauffe_eau_lieu (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_chauffe_eau uuid NOT NULL,
    id_lieu uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chauffe_eau_releve; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chauffe_eau_releve (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_chauffe_eau uuid NOT NULL,
    date_releve date NOT NULL,
    heure_demarrage time without time zone,
    temperature_debut numeric(5,2),
    heure_debranchement time without time zone,
    temperature_fin numeric(5,2),
    heure_controle_fin_matin time without time zone,
    temperature_fin_matin numeric(5,2),
    etat_constate character varying(10) NOT NULL,
    etat_attendu character varying(10) NOT NULL,
    conforme boolean DEFAULT true NOT NULL,
    id_utilisateur uuid,
    commentaire text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chauffe_eau_releve_etat_attendu_check CHECK (((etat_attendu)::text = ANY ((ARRAY['ON'::character varying, 'OFF'::character varying])::text[]))),
    CONSTRAINT chauffe_eau_releve_etat_constate_check CHECK (((etat_constate)::text = ANY ((ARRAY['ON'::character varying, 'OFF'::character varying])::text[])))
);


--
-- Name: commentaire_intervention; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commentaire_intervention (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_intervention uuid NOT NULL,
    id_utilisateur uuid,
    commentaire text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: domaine_executant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domaine_executant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom character varying(100) NOT NULL,
    capacite_max integer,
    CONSTRAINT check_domaine_executant_capacite_positive CHECK (((capacite_max IS NULL) OR (capacite_max > 0)))
);


--
-- Name: etat_mouvement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etat_mouvement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom character varying(50) NOT NULL
);


--
-- Name: executant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.executant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom character varying(100) NOT NULL,
    id_domaine uuid NOT NULL
);


--
-- Name: historique_etat_mouvement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historique_etat_mouvement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_planning_chambre uuid NOT NULL,
    ancien_id_etat uuid,
    nouveau_id_etat uuid NOT NULL,
    motif text,
    modifie_par uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: historique_etat_tache_chambre; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historique_etat_tache_chambre (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_tache_chambre uuid NOT NULL,
    ancien_id_etat uuid,
    nouveau_id_etat uuid NOT NULL,
    motif text,
    modifie_par uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: history_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.history_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type character varying(80) NOT NULL,
    entity_id uuid,
    action character varying(80) NOT NULL,
    id_utilisateur uuid,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: intervention_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intervention_maintenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titre character varying(200) NOT NULL,
    description text,
    id_lieu uuid NOT NULL,
    date_intervention date NOT NULL,
    priorite character varying(20) DEFAULT 'normale'::character varying NOT NULL,
    id_executant uuid,
    id_etat uuid NOT NULL,
    commentaire_fermeture text,
    date_fermeture timestamp with time zone,
    est_actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    travail_a_faire text,
    heure_debut time without time zone,
    date_fin date,
    heure_fin time without time zone,
    id_type_intervention uuid NOT NULL,
    CONSTRAINT intervention_maintenance_priorite_check CHECK (((priorite)::text = ANY ((ARRAY['basse'::character varying, 'normale'::character varying, 'urgente'::character varying])::text[])))
);


--
-- Name: lieux; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lieux (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom character varying(100) NOT NULL,
    code character varying(50),
    id_batiment uuid,
    id_categorie uuid NOT NULL,
    numero character varying(10),
    est_actif boolean DEFAULT true
);


--
-- Name: photo_intervention; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photo_intervention (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_intervention uuid NOT NULL,
    url_storage text NOT NULL,
    nom_fichier character varying(255) NOT NULL,
    type_photo character varying(20) NOT NULL,
    commentaire text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photo_intervention_type_photo_check CHECK (((type_photo)::text = ANY ((ARRAY['avant'::character varying, 'apres'::character varying, 'progression'::character varying, 'anomalie'::character varying, 'detail'::character varying])::text[])))
);


--
-- Name: planning_chambre; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planning_chambre (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_lieu uuid NOT NULL,
    date date NOT NULL,
    id_type_mouvement uuid NOT NULL,
    id_executant uuid,
    id_etat uuid NOT NULL,
    motif_blocage text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: planning_executant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planning_executant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_executant uuid NOT NULL,
    id_type_planning uuid NOT NULL,
    date date NOT NULL,
    heure_debut time without time zone,
    heure_fin time without time zone
);


--
-- Name: tache_chambre; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tache_chambre (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_planning_chambre uuid,
    id_lieu uuid NOT NULL,
    id_type_mouvement uuid NOT NULL,
    date_mouvement date NOT NULL,
    date_execution date NOT NULL,
    date_limite date NOT NULL,
    id_executant uuid,
    id_etat uuid NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    urgence character varying(20) DEFAULT 'normale'::character varying NOT NULL,
    commentaire text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    motif_blocage text,
    CONSTRAINT check_tache_chambre_execution_limite CHECK ((date_execution <= date_limite)),
    CONSTRAINT tache_chambre_points_check CHECK ((points >= 0)),
    CONSTRAINT tache_chambre_urgence_check CHECK (((urgence)::text = ANY ((ARRAY['haute'::character varying, 'normale'::character varying, 'basse'::character varying])::text[])))
);


--
-- Name: tache_periodique; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tache_periodique (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom character varying(100) NOT NULL,
    code character varying(50),
    description text,
    id_categorie_lieu uuid,
    frequence_jours integer NOT NULL,
    priorite character varying(20) DEFAULT 'normale'::character varying NOT NULL,
    niveau_lourdeur character varying(20) DEFAULT 'moyen'::character varying NOT NULL,
    nature character varying(30) DEFAULT 'entretien'::character varying NOT NULL,
    points_estimes integer NOT NULL,
    est_reportable boolean DEFAULT true,
    delai_alerte_jours integer DEFAULT 3,
    est_actif boolean DEFAULT true,
    CONSTRAINT tache_periodique_delai_alerte_jours_check CHECK ((delai_alerte_jours >= 0)),
    CONSTRAINT tache_periodique_frequence_jours_check CHECK ((frequence_jours > 0)),
    CONSTRAINT tache_periodique_nature_check CHECK (((nature)::text = ANY ((ARRAY['obligatoire'::character varying, 'entretien'::character varying, 'opportuniste'::character varying])::text[]))),
    CONSTRAINT tache_periodique_niveau_lourdeur_check CHECK (((niveau_lourdeur)::text = ANY ((ARRAY['leger'::character varying, 'moyen'::character varying, 'lourd'::character varying])::text[]))),
    CONSTRAINT tache_periodique_points_estimes_check CHECK ((points_estimes >= 0)),
    CONSTRAINT tache_periodique_priorite_check CHECK (((priorite)::text = ANY ((ARRAY['haute'::character varying, 'normale'::character varying, 'basse'::character varying])::text[])))
);


--
-- Name: tache_periodique_historique; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tache_periodique_historique (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_tache uuid NOT NULL,
    id_lieu uuid NOT NULL,
    id_executant uuid,
    date_realisation date NOT NULL,
    duree_minutes integer,
    commentaire text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tache_periodique_historique_duree_minutes_check CHECK (((duree_minutes IS NULL) OR (duree_minutes >= 0)))
);


--
-- Name: tache_periodique_planning; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tache_periodique_planning (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_tache uuid NOT NULL,
    id_lieu uuid NOT NULL,
    id_executant uuid,
    date_realisation date,
    date_echeance date NOT NULL,
    date_echeance_originale date,
    id_etat uuid NOT NULL,
    est_reportee boolean DEFAULT false,
    motif_report text,
    est_actif boolean DEFAULT true
);


--
-- Name: template_planning_chambre; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_planning_chambre (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom character varying(100) NOT NULL,
    description text
);


--
-- Name: template_planning_chambre_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_planning_chambre_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_template uuid NOT NULL,
    id_lieu uuid NOT NULL,
    jour_semaine integer NOT NULL,
    id_type_mouvement uuid NOT NULL,
    id_executant uuid,
    CONSTRAINT template_planning_chambre_item_jour_semaine_check CHECK (((jour_semaine >= 0) AND (jour_semaine <= 6)))
);


--
-- Name: type_intervention_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.type_intervention_maintenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom character varying(100) NOT NULL,
    est_actif boolean DEFAULT true
);


--
-- Name: type_mouvement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.type_mouvement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom character varying(50) NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    CONSTRAINT check_type_mouvement_points_positifs CHECK ((points >= 0))
);


--
-- Name: type_planning; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.type_planning (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom character varying(50) NOT NULL,
    couleur character varying(20) DEFAULT '#64748b'::character varying NOT NULL
);


--
-- Name: utilisateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.utilisateurs (
    id uuid NOT NULL,
    email text NOT NULL,
    nom text NOT NULL,
    role public.role_utilisateur DEFAULT 'coordinateur'::public.role_utilisateur NOT NULL,
    domaines_autorises public.domaine_operation[] DEFAULT '{}'::public.domaine_operation[] NOT NULL,
    statut integer DEFAULT 0 NOT NULL,
    CONSTRAINT check_coordinateur_domaines CHECK ((((role = 'admin'::public.role_utilisateur) AND (array_length(domaines_autorises, 1) IS NULL)) OR ((role = 'coordinateur'::public.role_utilisateur) AND ((statut = 0) OR (array_length(domaines_autorises, 1) > 0)))))
);


--
-- Name: article_locations; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.article_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    location_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: articles; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    family_id uuid NOT NULL,
    sub_family text,
    unit_id uuid NOT NULL,
    packaging text,
    default_supplier text,
    min_stock numeric(10,2) DEFAULT 0,
    status stock.article_status DEFAULT 'active'::stock.article_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    sellable_without_transformation boolean DEFAULT false NOT NULL,
    usable_in_recipes boolean DEFAULT false NOT NULL
);


--
-- Name: buffet_coefficients; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.buffet_coefficients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    number_of_items integer NOT NULL,
    interest_level stock.interest_level NOT NULL,
    min_coefficient numeric(7,2) NOT NULL,
    max_coefficient numeric(7,2) NOT NULL,
    default_coefficient numeric(7,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: cash_purchase_differences; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.cash_purchase_differences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cash_purchase_id uuid NOT NULL,
    difference_type stock.difference_type NOT NULL,
    amount numeric(14,2) NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'a_justifier'::text,
    justified_by uuid,
    justified_at timestamp with time zone,
    justification text,
    validated_by uuid,
    validated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cash_purchase_items; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.cash_purchase_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cash_purchase_id uuid NOT NULL,
    article_id uuid NOT NULL,
    purchase_need_id uuid,
    quantity_planned numeric(14,4) NOT NULL,
    quantity_bought numeric(14,4) DEFAULT 0,
    unit_id uuid NOT NULL,
    unit_price_estimated numeric(14,2),
    unit_price_real numeric(14,2),
    total_estimated numeric(14,2) DEFAULT 0,
    total_real numeric(14,2) DEFAULT 0,
    invoice_number text,
    invoice_date date,
    supplier text,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    stock_unit_id uuid,
    conversion_factor numeric(18,8) DEFAULT 1,
    quantity_planned_stock numeric(14,4),
    quantity_bought_stock numeric(14,4),
    unit_price_estimated_stock numeric(14,4),
    unit_price_real_stock numeric(14,4)
);


--
-- Name: cash_purchase_receipts; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.cash_purchase_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cash_purchase_id uuid NOT NULL,
    file_url text NOT NULL,
    file_name text NOT NULL,
    file_size integer,
    mime_type text,
    description text,
    uploaded_at timestamp with time zone DEFAULT now(),
    uploaded_by uuid
);


--
-- Name: cash_purchases; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.cash_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference text NOT NULL,
    buyer_id uuid NOT NULL,
    cash_source stock.cash_purchase_source NOT NULL,
    reason text NOT NULL,
    purchase_date date,
    request_date date DEFAULT CURRENT_DATE,
    total_estimated numeric(14,2) DEFAULT 0,
    amount_requested numeric(14,2) DEFAULT 0,
    amount_validated numeric(14,2) DEFAULT 0,
    amount_given numeric(14,2) DEFAULT 0,
    total_purchased numeric(14,2) DEFAULT 0,
    change_expected numeric(14,2) DEFAULT 0,
    change_returned numeric(14,2) DEFAULT 0,
    difference numeric(14,2) DEFAULT 0,
    validated_by uuid,
    validated_at timestamp with time zone,
    validation_comment text,
    given_by uuid,
    given_at timestamp with time zone,
    closed_by uuid,
    closed_at timestamp with time zone,
    closing_comment text,
    status stock.cash_purchase_status DEFAULT 'en_attente'::stock.cash_purchase_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    cash_status text DEFAULT 'especes_demandees'::text,
    reception_status text DEFAULT 'en_attente_reception'::text,
    stock_entry_status text DEFAULT 'non_entre_stock'::text,
    CONSTRAINT cash_purchases_cash_status_check CHECK ((cash_status = ANY (ARRAY['especes_demandees'::text, 'decaissement_valide'::text, 'especes_remises'::text, 'retour_achat_saisi'::text, 'justificatif_recu'::text, 'monnaie_rendue'::text, 'rendu_monnaie_a_suivre'::text, 'ecart_a_valider'::text, 'ecart_valide_direction'::text, 'cloture_caisse'::text, 'annule'::text]))),
    CONSTRAINT cash_purchases_reception_status_check CHECK ((reception_status = ANY (ARRAY['en_attente_reception'::text, 'reception_partielle'::text, 'reception_conforme'::text, 'reception_avec_anomalie'::text, 'reception_refusee'::text]))),
    CONSTRAINT cash_purchases_stock_entry_status_check CHECK ((stock_entry_status = ANY (ARRAY['non_entre_stock'::text, 'entree_stock_partielle'::text, 'entree_stock_faite'::text, 'bloque_stock'::text])))
);


--
-- Name: event_recipes; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.event_recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    service_type stock.service_type DEFAULT 'buffet'::stock.service_type,
    interest_level stock.interest_level DEFAULT 'normal'::stock.interest_level,
    suggested_coefficient numeric(7,2),
    selected_coefficient numeric(7,2),
    coefficient_modification_reason text,
    coefficient_modified_by uuid,
    coefficient_modified_at timestamp with time zone,
    portions_planned numeric(10,2),
    portions_produced numeric(10,2) DEFAULT 0,
    portions_consumed numeric(10,2) DEFAULT 0,
    portions_returned numeric(10,2) DEFAULT 0,
    portions_lost numeric(10,2) DEFAULT 0,
    portions_unsold numeric(10,2) DEFAULT 0,
    portions_additional numeric(10,2) DEFAULT 0,
    estimated_cost numeric(14,2) DEFAULT 0,
    real_cost numeric(14,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: events; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type stock.event_type NOT NULL,
    date timestamp with time zone NOT NULL,
    location text,
    description text,
    adults integer NOT NULL,
    children integer DEFAULT 0,
    child_coefficient numeric(5,2) DEFAULT 0.5,
    total_equivalent numeric(10,2),
    safety_margin numeric(5,2) DEFAULT 10,
    status stock.event_status DEFAULT 'planifie'::stock.event_status,
    total_estimated_cost numeric(14,2) DEFAULT 0,
    total_real_cost numeric(14,2) DEFAULT 0,
    total_estimated_price numeric(14,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid
);


--
-- Name: families; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.families (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: inventories; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.inventories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference text NOT NULL,
    location_id uuid NOT NULL,
    inventory_date date NOT NULL,
    type stock.inventory_type NOT NULL,
    comment text,
    status stock.inventory_status DEFAULT 'brouillon'::stock.inventory_status,
    total_positive_difference numeric(14,4) DEFAULT 0,
    total_negative_difference numeric(14,4) DEFAULT 0,
    total_difference numeric(14,4) DEFAULT 0,
    total_value_difference numeric(14,2) DEFAULT 0,
    validated_by uuid,
    validated_at timestamp with time zone,
    validation_comment text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid NOT NULL,
    updated_by uuid
);


--
-- Name: inventory_adjustment_requests; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.inventory_adjustment_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    article_id uuid NOT NULL,
    location_id uuid NOT NULL,
    original_counted_quantity numeric(14,4) NOT NULL,
    proposed_counted_quantity numeric(14,4) NOT NULL,
    adjustment_difference numeric(14,4) GENERATED ALWAYS AS ((proposed_counted_quantity - original_counted_quantity)) STORED,
    unit_id uuid NOT NULL,
    unit_price numeric(14,2) DEFAULT 0,
    reason text NOT NULL,
    status text DEFAULT 'en_attente'::text,
    stock_movement_id uuid,
    requested_by uuid,
    requested_at timestamp with time zone DEFAULT now(),
    validated_by uuid,
    validated_at timestamp with time zone,
    validation_comment text
);


--
-- Name: inventory_items; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_id uuid NOT NULL,
    article_id uuid NOT NULL,
    theoretical_quantity numeric(14,4) NOT NULL,
    counted_quantity numeric(14,4) NOT NULL,
    difference numeric(14,4) GENERATED ALWAYS AS ((counted_quantity - theoretical_quantity)) STORED,
    unit_id uuid NOT NULL,
    unit_price numeric(14,2),
    value_difference numeric(14,2) GENERATED ALWAYS AS (((counted_quantity - theoretical_quantity) * COALESCE(unit_price, (0)::numeric))) STORED,
    reason text,
    stock_movement_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: invoice_history; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.invoice_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    action text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: invoice_items; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    article_id uuid NOT NULL,
    quantity numeric(14,4) NOT NULL,
    unit_id uuid NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    total numeric(14,2) GENERATED ALWAYS AS ((quantity * unit_price)) STORED,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    supplier_tax_status stock.supplier_tax_status,
    invoice_tax_mode stock.invoice_tax_mode,
    invoice_amount_ht numeric(14,2),
    invoice_vat_amount numeric(14,2),
    invoice_amount_ttc numeric(14,2),
    vat_rate numeric(7,4) DEFAULT 20,
    vat_recoverable boolean DEFAULT true,
    recoverable_vat_amount numeric(14,2),
    non_recoverable_vat_amount numeric(14,2),
    declared_extra_tax_rate numeric(7,4) DEFAULT 0,
    declared_extra_tax_amount numeric(14,2),
    accounting_total_amount numeric(14,2),
    effective_material_cost_total numeric(14,2),
    effective_material_unit_cost numeric(14,4),
    effective_cost_method stock.effective_cost_method,
    effective_cost_source text,
    effective_cost_note text
);


--
-- Name: invoice_payments; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.invoice_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric(14,2) NOT NULL,
    payment_mode stock.payment_mode NOT NULL,
    payment_date date NOT NULL,
    payment_reference text,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    status stock.invoice_payment_status DEFAULT 'execute'::stock.invoice_payment_status,
    planned_payment_date date,
    planned_by uuid,
    planned_at timestamp with time zone,
    validated_by uuid,
    validated_at timestamp with time zone,
    validation_comment text,
    refused_by uuid,
    refused_at timestamp with time zone,
    refusal_reason text,
    executed_by uuid,
    executed_at timestamp with time zone,
    execution_comment text,
    cash_account text,
    beneficiary text
);


--
-- Name: invoices; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference text NOT NULL,
    supplier_id uuid NOT NULL,
    invoice_number text NOT NULL,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    comment text,
    amount_ht numeric(14,2) NOT NULL,
    amount_tva numeric(14,2) DEFAULT 0,
    amount_ttc numeric(14,2) GENERATED ALWAYS AS ((amount_ht + amount_tva)) STORED,
    amount_paid numeric(14,2) DEFAULT 0,
    amount_remaining numeric(14,2) GENERATED ALWAYS AS (((amount_ht + amount_tva) - amount_paid)) STORED,
    reception_id uuid,
    purchase_order_id uuid,
    cash_purchase_id uuid,
    status stock.invoice_status DEFAULT 'a_verifier'::stock.invoice_status,
    payment_mode stock.payment_mode,
    payment_date date,
    payment_reference text,
    validated_by uuid,
    validated_at timestamp with time zone,
    validation_comment text,
    file_url text,
    file_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    supplier_tax_status stock.supplier_tax_status,
    invoice_tax_mode stock.invoice_tax_mode DEFAULT 'invoice_with_recoverable_vat'::stock.invoice_tax_mode,
    vat_rate numeric(7,4) DEFAULT 20,
    vat_recoverable boolean DEFAULT true,
    recoverable_vat_amount numeric(14,2),
    non_recoverable_vat_amount numeric(14,2),
    declared_extra_tax_rate numeric(7,4) DEFAULT 0,
    declared_extra_tax_amount numeric(14,2),
    accounting_total_amount numeric(14,2),
    effective_material_cost_total numeric(14,2),
    effective_cost_method stock.effective_cost_method,
    effective_cost_source text,
    effective_cost_note text
);


--
-- Name: locations; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_magasin_general boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: pending_ingredients; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.pending_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_id uuid NOT NULL,
    imported_name text NOT NULL,
    quantity numeric(14,4) NOT NULL,
    unit_name text NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    status stock.pending_ingredient_status DEFAULT 'pending'::stock.pending_ingredient_status,
    resolved_article_id uuid,
    candidate_article_ids uuid[] DEFAULT '{}'::uuid[],
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    conversion_factor numeric(18,8)
);


--
-- Name: stock_movements; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit_id uuid NOT NULL,
    movement_type stock.movement_type NOT NULL,
    from_location_id uuid,
    to_location_id uuid,
    movement_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid NOT NULL,
    updated_by uuid,
    reference_type text,
    reference_id uuid,
    reception_item_id uuid,
    status stock.movement_status DEFAULT 'normal'::stock.movement_status,
    is_retroactive boolean DEFAULT false,
    retroactive_date date,
    retroactive_reason text,
    retroactive_validated_by uuid,
    retroactive_validated_at timestamp with time zone,
    is_manual boolean DEFAULT false,
    manual_reason text,
    manual_validated_by uuid,
    manual_validated_at timestamp with time zone,
    comment text,
    movement_reference text,
    unit_cost numeric(10,2),
    price_source stock.price_source_type DEFAULT 'reception'::stock.price_source_type,
    total_cost numeric(10,2) GENERATED ALWAYS AS ((quantity * COALESCE(unit_cost, (0)::numeric))) STORED,
    effective_material_unit_cost numeric(14,4),
    effective_material_cost_total numeric(14,2),
    effective_cost_method stock.effective_cost_method,
    effective_cost_source text
);


--
-- Name: price_history_view; Type: VIEW; Schema: stock; Owner: -
--

CREATE VIEW stock.price_history_view AS
 SELECT id,
    article_id,
    movement_date,
    COALESCE(effective_material_unit_cost, unit_cost) AS unit_cost,
    quantity,
    price_source,
    reference_type,
    reference_id,
    movement_reference,
    effective_cost_method,
    effective_cost_source,
    created_at,
    COALESCE(effective_material_cost_total, (quantity * COALESCE(effective_material_unit_cost, unit_cost))) AS total_cost,
    comment
   FROM stock.stock_movements
  WHERE ((movement_type = ANY (ARRAY['entree'::stock.movement_type, 'correction'::stock.movement_type, 'ajustement'::stock.movement_type])) AND (COALESCE(effective_material_unit_cost, unit_cost) IS NOT NULL) AND (status = ANY (ARRAY['normal'::stock.movement_status, 'retroactif'::stock.movement_status, 'valide'::stock.movement_status])))
  ORDER BY movement_date DESC;


--
-- Name: profiles; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text NOT NULL,
    full_name text NOT NULL,
    role stock.user_role DEFAULT 'consultation'::stock.user_role,
    status stock.user_status DEFAULT 'pending_validation'::stock.user_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    validated_by uuid,
    validated_at timestamp with time zone,
    rejected_at timestamp with time zone,
    rejection_reason text,
    created_by uuid
);


--
-- Name: purchase_groups; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.purchase_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    supplier_id uuid,
    total_estimated_cost numeric(14,2) DEFAULT 0,
    status text DEFAULT 'en_cours'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: purchase_needs; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.purchase_needs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid,
    article_id uuid NOT NULL,
    quantity_needed numeric(14,4) NOT NULL,
    unit_id uuid NOT NULL,
    estimated_cost numeric(14,2) DEFAULT 0,
    status stock.purchase_need_status DEFAULT 'a_faire'::stock.purchase_need_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    quantity numeric(14,4) NOT NULL,
    origin stock.need_origin DEFAULT 'evenement'::stock.need_origin NOT NULL,
    urgency stock.need_urgency DEFAULT 'normal'::stock.need_urgency,
    estimated_price numeric(14,2),
    budget numeric(14,2),
    requested_date date,
    comment text,
    recipe_id uuid,
    validated_by uuid,
    validated_at timestamp with time zone,
    validation_comment text,
    group_id uuid,
    supplier_id uuid,
    updated_by uuid,
    price_input_amount numeric(14,2),
    price_input_is_tax_excluded boolean DEFAULT true,
    vat_rate numeric(5,2) DEFAULT 20,
    estimated_vat_amount numeric(14,2),
    estimated_price_ttc numeric(14,2),
    type_de_besoin stock.need_type DEFAULT 'besoin_ponctuel'::stock.need_type,
    destination_prevue stock.need_destination DEFAULT 'stock_general'::stock.need_destination,
    source_du_calcul stock.need_calculation_source DEFAULT 'saisie_manuelle'::stock.need_calculation_source,
    service_demandeur stock.requesting_service DEFAULT 'cuisine'::stock.requesting_service
);


--
-- Name: purchase_order_documents; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.purchase_order_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    file_url text NOT NULL,
    file_name text NOT NULL,
    file_size integer,
    mime_type text,
    document_type text DEFAULT 'bon_livraison'::text,
    description text,
    uploaded_at timestamp with time zone DEFAULT now(),
    uploaded_by uuid
);


--
-- Name: purchase_order_history; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.purchase_order_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    action text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    article_id uuid NOT NULL,
    quantity_ordered numeric(10,2) NOT NULL,
    quantity_received numeric(10,2) DEFAULT 0,
    quantity_remaining numeric(10,2) GENERATED ALWAYS AS ((quantity_ordered - quantity_received)) STORED,
    unit_id uuid NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total numeric(10,2) GENERATED ALWAYS AS ((quantity_ordered * unit_price)) STORED,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    difference_type text,
    difference_comment text,
    difference_status text DEFAULT 'aucun'::text,
    difference_validated_by uuid,
    difference_validated_at timestamp with time zone,
    stock_unit_id uuid,
    conversion_factor numeric(18,8) DEFAULT 1,
    quantity_ordered_stock numeric(14,4),
    unit_price_stock numeric(14,4)
);


--
-- Name: purchase_order_needs; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.purchase_order_needs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    need_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: purchase_orders; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference text NOT NULL,
    supplier_id uuid NOT NULL,
    order_date date DEFAULT CURRENT_DATE,
    delivery_date date NOT NULL,
    supplier_reference text,
    payment_terms text,
    delivery_mode text,
    comment text,
    total_amount numeric(10,2) DEFAULT 0,
    validated_by uuid,
    validated_at timestamp with time zone,
    validation_comment text,
    sent_at timestamp with time zone,
    sent_by uuid,
    file_url text,
    status stock.purchase_order_status DEFAULT 'brouillon'::stock.purchase_order_status,
    cancellation_reason text,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    closed_by uuid,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid
);


--
-- Name: reception_anomalies; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.reception_anomalies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reception_item_id uuid NOT NULL,
    anomaly_type stock.anomaly_type NOT NULL,
    description text NOT NULL,
    photo_url text,
    resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    resolution_comment text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: reception_documents; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.reception_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reception_id uuid NOT NULL,
    file_url text NOT NULL,
    file_name text NOT NULL,
    file_size integer,
    mime_type text,
    document_type text DEFAULT 'facture'::text,
    description text,
    uploaded_at timestamp with time zone DEFAULT now(),
    uploaded_by uuid
);


--
-- Name: reception_history; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.reception_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reception_id uuid NOT NULL,
    action text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: reception_items; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.reception_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reception_id uuid NOT NULL,
    article_id uuid NOT NULL,
    quantity_ordered numeric(10,2) DEFAULT 0,
    quantity_delivered numeric(10,2) NOT NULL,
    quantity_accepted numeric(10,2) NOT NULL,
    quantity_refused numeric(10,2) GENERATED ALWAYS AS ((quantity_delivered - quantity_accepted)) STORED,
    unit_id uuid NOT NULL,
    unit_price_planned numeric(10,2),
    unit_price_real numeric(10,2) NOT NULL,
    total numeric(10,2) GENERATED ALWAYS AS ((quantity_accepted * unit_price_real)) STORED,
    quality stock.quality_status DEFAULT 'conforme'::stock.quality_status,
    quality_comment text,
    has_anomaly boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    quantity_delivered_display numeric(14,4),
    quantity_accepted_display numeric(14,4),
    unit_display_id uuid,
    conversion_factor numeric(18,8) DEFAULT 1,
    unit_price_display numeric(14,4),
    supplier_tax_status stock.supplier_tax_status,
    invoice_tax_mode stock.invoice_tax_mode,
    invoice_amount_ht numeric(14,2),
    invoice_vat_amount numeric(14,2),
    invoice_amount_ttc numeric(14,2),
    vat_rate numeric(7,4) DEFAULT 20,
    vat_recoverable boolean DEFAULT true,
    recoverable_vat_amount numeric(14,2),
    non_recoverable_vat_amount numeric(14,2),
    declared_extra_tax_rate numeric(7,4) DEFAULT 0,
    declared_extra_tax_amount numeric(14,2),
    accounting_total_amount numeric(14,2),
    effective_material_cost_total numeric(14,2),
    effective_material_unit_cost numeric(14,4),
    effective_cost_method stock.effective_cost_method,
    effective_cost_source text,
    effective_cost_note text
);


--
-- Name: receptions; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.receptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference text NOT NULL,
    supplier_id uuid NOT NULL,
    reception_date date DEFAULT CURRENT_DATE,
    invoice_number text NOT NULL,
    invoice_date date NOT NULL,
    location_id uuid,
    comment text,
    purchase_order_id uuid,
    cash_purchase_id uuid,
    validated_by uuid,
    validated_at timestamp with time zone,
    validation_comment text,
    total_amount numeric(10,2) DEFAULT 0,
    status stock.reception_status DEFAULT 'brouillon'::stock.reception_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    is_historical boolean DEFAULT false
);


--
-- Name: recipe_ingredients; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.recipe_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_id uuid NOT NULL,
    article_id uuid,
    imported_name text,
    quantity numeric(14,4) NOT NULL,
    unit_id uuid,
    unit_name text,
    unit_price numeric(14,2) NOT NULL,
    total_cost numeric(14,2) DEFAULT 0,
    resolution_status stock.pending_ingredient_status DEFAULT 'resolved'::stock.pending_ingredient_status,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    quantity_display numeric(14,4),
    unit_display uuid,
    quantity_stored numeric(14,4),
    unit_stored uuid,
    conversion_factor numeric(18,8)
);


--
-- Name: recipes; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text,
    name text NOT NULL,
    type stock.recipe_type NOT NULL,
    sub_type text,
    main_ingredient stock.recipe_main_ingredient NOT NULL,
    portions integer DEFAULT 1,
    description text,
    tags stock.recipe_tag[] DEFAULT '{}'::stock.recipe_tag[],
    total_cost numeric(14,2) DEFAULT 0,
    cost_per_portion numeric(14,2) DEFAULT 0,
    suggested_price numeric(14,2) DEFAULT 0,
    final_price numeric(14,2) DEFAULT 0,
    cost_ratio numeric(10,2) DEFAULT 0,
    margin_rate numeric(10,2) DEFAULT 0,
    margin_coefficient numeric(10,4) DEFAULT 3,
    status stock.recipe_status DEFAULT 'brouillon'::stock.recipe_status,
    version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    validated_by uuid,
    validated_at timestamp with time zone,
    archived_at timestamp with time zone,
    parent_version_id uuid
);


--
-- Name: sale_items; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    article_id uuid,
    product_type stock.product_type NOT NULL,
    quantity numeric(14,4) NOT NULL,
    quantity_offered numeric(14,4) DEFAULT 0,
    unit_price numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0,
    offer_reason text,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    recipe_id uuid,
    returned_quantity numeric(14,4) DEFAULT 0,
    return_reason text,
    unit_display_id uuid,
    unit_stock_id uuid,
    quantity_stock numeric(14,4),
    conversion_factor numeric(18,8) DEFAULT 1,
    total numeric(14,2) GENERATED ALWAYS AS (((quantity - quantity_offered) * unit_price)) STORED,
    total_after_discount numeric(14,2) GENERATED ALWAYS AS ((((quantity - quantity_offered) * unit_price) - discount)) STORED
);


--
-- Name: sale_returns; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.sale_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    sale_item_id uuid NOT NULL,
    quantity integer NOT NULL,
    reason text NOT NULL,
    stock_movement_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: sale_stock_outs; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.sale_stock_outs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    sale_item_id uuid NOT NULL,
    stock_out_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: sales; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference text NOT NULL,
    sale_date timestamp with time zone NOT NULL,
    channel stock.sales_channel NOT NULL,
    service_mode stock.service_mode NOT NULL,
    sales_point stock.sales_point NOT NULL,
    client_name text,
    comment text,
    total_before_discount numeric(10,2) DEFAULT 0,
    total_discount numeric(10,2) DEFAULT 0,
    total_after_discount numeric(10,2) DEFAULT 0,
    event_id uuid,
    status stock.sales_status DEFAULT 'validee'::stock.sales_status,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid
);


--
-- Name: stock_view; Type: VIEW; Schema: stock; Owner: -
--

CREATE VIEW stock.stock_view AS
 SELECT article_id,
    sum(quantity) AS total_quantity,
    ( SELECT COALESCE(sm.effective_material_unit_cost, sm.unit_cost) AS "coalesce"
           FROM stock.stock_movements sm
          WHERE ((sm.article_id = movements.article_id) AND (sm.movement_type = ANY (ARRAY['entree'::stock.movement_type, 'correction'::stock.movement_type, 'ajustement'::stock.movement_type])) AND (COALESCE(sm.effective_material_unit_cost, sm.unit_cost) IS NOT NULL) AND (sm.status = ANY (ARRAY['normal'::stock.movement_status, 'retroactif'::stock.movement_status, 'valide'::stock.movement_status])))
          ORDER BY sm.movement_date DESC, sm.created_at DESC
         LIMIT 1) AS last_price,
    ( SELECT COALESCE((sum((sm.quantity * COALESCE(sm.effective_material_unit_cost, sm.unit_cost))) / NULLIF(sum(sm.quantity), (0)::numeric)), (0)::numeric) AS "coalesce"
           FROM stock.stock_movements sm
          WHERE ((sm.article_id = movements.article_id) AND (sm.movement_type = ANY (ARRAY['entree'::stock.movement_type, 'correction'::stock.movement_type, 'ajustement'::stock.movement_type])) AND (COALESCE(sm.effective_material_unit_cost, sm.unit_cost) IS NOT NULL) AND (sm.quantity > (0)::numeric) AND (sm.status = ANY (ARRAY['normal'::stock.movement_status, 'retroactif'::stock.movement_status, 'valide'::stock.movement_status])))) AS average_price,
    ( SELECT sm.movement_date
           FROM stock.stock_movements sm
          WHERE ((sm.article_id = movements.article_id) AND (sm.movement_type = ANY (ARRAY['entree'::stock.movement_type, 'correction'::stock.movement_type, 'ajustement'::stock.movement_type])) AND (COALESCE(sm.effective_material_unit_cost, sm.unit_cost) IS NOT NULL) AND (sm.status = ANY (ARRAY['normal'::stock.movement_status, 'retroactif'::stock.movement_status, 'valide'::stock.movement_status])))
          ORDER BY sm.movement_date DESC, sm.created_at DESC
         LIMIT 1) AS last_entry_date,
    (sum(quantity) * ( SELECT COALESCE((sum((sm.quantity * COALESCE(sm.effective_material_unit_cost, sm.unit_cost))) / NULLIF(sum(sm.quantity), (0)::numeric)), (0)::numeric) AS "coalesce"
           FROM stock.stock_movements sm
          WHERE ((sm.article_id = movements.article_id) AND (sm.movement_type = ANY (ARRAY['entree'::stock.movement_type, 'correction'::stock.movement_type, 'ajustement'::stock.movement_type])) AND (COALESCE(sm.effective_material_unit_cost, sm.unit_cost) IS NOT NULL) AND (sm.quantity > (0)::numeric) AND (sm.status = ANY (ARRAY['normal'::stock.movement_status, 'retroactif'::stock.movement_status, 'valide'::stock.movement_status]))))) AS stock_value
   FROM ( SELECT stock_movements.article_id,
            stock_movements.unit_id,
            stock_movements.quantity,
            stock_movements.movement_type,
            COALESCE(stock_movements.effective_material_unit_cost, stock_movements.unit_cost) AS unit_cost
           FROM stock.stock_movements
          WHERE ((stock_movements.movement_type = ANY (ARRAY['entree'::stock.movement_type, 'retour'::stock.movement_type, 'correction'::stock.movement_type, 'ajustement'::stock.movement_type])) AND (stock_movements.status = ANY (ARRAY['normal'::stock.movement_status, 'retroactif'::stock.movement_status, 'valide'::stock.movement_status])))
        UNION ALL
         SELECT stock_movements.article_id,
            stock_movements.unit_id,
            (- stock_movements.quantity),
            stock_movements.movement_type,
            COALESCE(stock_movements.effective_material_unit_cost, stock_movements.unit_cost) AS unit_cost
           FROM stock.stock_movements
          WHERE ((stock_movements.movement_type = ANY (ARRAY['sortie'::stock.movement_type, 'perte'::stock.movement_type, 'consommation'::stock.movement_type])) AND (stock_movements.status = ANY (ARRAY['normal'::stock.movement_status, 'retroactif'::stock.movement_status, 'valide'::stock.movement_status])))
        UNION ALL
         SELECT stock_movements.article_id,
            stock_movements.unit_id,
            0,
            stock_movements.movement_type,
            COALESCE(stock_movements.effective_material_unit_cost, stock_movements.unit_cost) AS unit_cost
           FROM stock.stock_movements
          WHERE ((stock_movements.movement_type = 'transfert'::stock.movement_type) AND (stock_movements.status = ANY (ARRAY['normal'::stock.movement_status, 'retroactif'::stock.movement_status, 'valide'::stock.movement_status])))) movements
  GROUP BY article_id;


--
-- Name: stock_location_view; Type: VIEW; Schema: stock; Owner: -
--

CREATE VIEW stock.stock_location_view AS
 SELECT locations.article_id,
    locations.location_id,
    locations.unit_id,
    sum(locations.quantity) AS quantity,
    COALESCE(stock_values.average_price, (0)::numeric) AS average_price,
    (sum(locations.quantity) * COALESCE(stock_values.average_price, (0)::numeric)) AS stock_value
   FROM (( SELECT stock_movements.article_id,
            stock_movements.to_location_id AS location_id,
            stock_movements.unit_id,
            sum(stock_movements.quantity) AS quantity
           FROM stock.stock_movements
          WHERE ((stock_movements.movement_type = ANY (ARRAY['entree'::stock.movement_type, 'retour'::stock.movement_type, 'correction'::stock.movement_type, 'ajustement'::stock.movement_type])) AND (stock_movements.to_location_id IS NOT NULL) AND (stock_movements.status = ANY (ARRAY['normal'::stock.movement_status, 'retroactif'::stock.movement_status, 'valide'::stock.movement_status])))
          GROUP BY stock_movements.article_id, stock_movements.to_location_id, stock_movements.unit_id
        UNION ALL
         SELECT stock_movements.article_id,
            stock_movements.from_location_id AS location_id,
            stock_movements.unit_id,
            sum((- stock_movements.quantity)) AS quantity
           FROM stock.stock_movements
          WHERE ((stock_movements.movement_type = ANY (ARRAY['sortie'::stock.movement_type, 'perte'::stock.movement_type, 'consommation'::stock.movement_type, 'transfert'::stock.movement_type])) AND (stock_movements.from_location_id IS NOT NULL) AND (stock_movements.status = ANY (ARRAY['normal'::stock.movement_status, 'retroactif'::stock.movement_status, 'valide'::stock.movement_status])))
          GROUP BY stock_movements.article_id, stock_movements.from_location_id, stock_movements.unit_id
        UNION ALL
         SELECT stock_movements.article_id,
            stock_movements.to_location_id AS location_id,
            stock_movements.unit_id,
            sum(stock_movements.quantity) AS quantity
           FROM stock.stock_movements
          WHERE ((stock_movements.movement_type = 'transfert'::stock.movement_type) AND (stock_movements.to_location_id IS NOT NULL) AND (stock_movements.status = ANY (ARRAY['normal'::stock.movement_status, 'retroactif'::stock.movement_status, 'valide'::stock.movement_status])))
          GROUP BY stock_movements.article_id, stock_movements.to_location_id, stock_movements.unit_id) locations
     LEFT JOIN stock.stock_view stock_values ON ((stock_values.article_id = locations.article_id)))
  GROUP BY locations.article_id, locations.location_id, locations.unit_id, stock_values.average_price;


--
-- Name: stock_outs; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.stock_outs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference text NOT NULL,
    article_id uuid NOT NULL,
    quantity numeric(14,4) NOT NULL,
    unit_id uuid NOT NULL,
    location_id uuid NOT NULL,
    destination stock.stock_out_destination NOT NULL,
    out_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    recipe_id uuid,
    event_id uuid,
    production_id uuid,
    stock_movement_id uuid,
    return_movement_id uuid,
    theoretical_quantity numeric(14,4),
    difference numeric(14,4) GENERATED ALWAYS AS ((quantity - COALESCE(theoretical_quantity, (0)::numeric))) STORED,
    consumption_type stock.consumption_type,
    is_loss boolean DEFAULT false,
    loss_type stock.loss_type,
    loss_comment text,
    is_additional boolean DEFAULT false,
    is_return boolean DEFAULT false,
    return_quantity numeric(14,4),
    reason text NOT NULL,
    comment text,
    validated_by uuid,
    validated_at timestamp with time zone,
    created_by uuid NOT NULL,
    updated_by uuid,
    status text DEFAULT 'valide'::text
);


--
-- Name: stock_pending_movements; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.stock_pending_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reception_id uuid NOT NULL,
    reception_item_id uuid NOT NULL,
    article_id uuid NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit_id uuid NOT NULL,
    location_id uuid,
    movement_type text DEFAULT 'entree_reception'::text,
    status text DEFAULT 'pending_stock_module'::text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    effective_material_unit_cost numeric(14,4),
    effective_material_cost_total numeric(14,2),
    effective_cost_method stock.effective_cost_method,
    effective_cost_source text
);


--
-- Name: sub_categories; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.sub_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: suppliers; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact text,
    phone text,
    email text,
    address text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    nif text,
    stat text,
    supplier_tax_status stock.supplier_tax_status DEFAULT 'unknown'::stock.supplier_tax_status,
    default_vat_recoverable boolean DEFAULT true,
    default_invoice_tax_mode stock.invoice_tax_mode DEFAULT 'invoice_with_recoverable_vat'::stock.invoice_tax_mode,
    default_declared_extra_tax_rate numeric(7,4) DEFAULT 0,
    is_identified boolean DEFAULT false,
    usually_issues_vat_invoice boolean DEFAULT false,
    default_vat_rate numeric(7,4) DEFAULT 20,
    is_usual_without_nif_stat boolean DEFAULT false,
    default_declared_extra_tax_enabled boolean DEFAULT false,
    occasional_purchase_alert_threshold numeric(14,2) DEFAULT 1000000
);


--
-- Name: units; Type: TABLE; Schema: stock; Owner: -
--

CREATE TABLE stock.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    abbreviation text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: batiments batiments_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batiments
    ADD CONSTRAINT batiments_code_key UNIQUE (code);


--
-- Name: batiments batiments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batiments
    ADD CONSTRAINT batiments_pkey PRIMARY KEY (id);


--
-- Name: categories_lieu categories_lieu_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories_lieu
    ADD CONSTRAINT categories_lieu_code_key UNIQUE (code);


--
-- Name: categories_lieu categories_lieu_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories_lieu
    ADD CONSTRAINT categories_lieu_pkey PRIMARY KEY (id);


--
-- Name: chauffe_eau_anomalie chauffe_eau_anomalie_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau_anomalie
    ADD CONSTRAINT chauffe_eau_anomalie_pkey PRIMARY KEY (id);


--
-- Name: chauffe_eau chauffe_eau_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau
    ADD CONSTRAINT chauffe_eau_code_key UNIQUE (code);


--
-- Name: chauffe_eau_lieu chauffe_eau_lieu_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau_lieu
    ADD CONSTRAINT chauffe_eau_lieu_pkey PRIMARY KEY (id);


--
-- Name: chauffe_eau chauffe_eau_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau
    ADD CONSTRAINT chauffe_eau_pkey PRIMARY KEY (id);


--
-- Name: chauffe_eau_releve chauffe_eau_releve_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau_releve
    ADD CONSTRAINT chauffe_eau_releve_pkey PRIMARY KEY (id);


--
-- Name: commentaire_intervention commentaire_intervention_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentaire_intervention
    ADD CONSTRAINT commentaire_intervention_pkey PRIMARY KEY (id);


--
-- Name: domaine_executant domaine_executant_nom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domaine_executant
    ADD CONSTRAINT domaine_executant_nom_key UNIQUE (nom);


--
-- Name: domaine_executant domaine_executant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domaine_executant
    ADD CONSTRAINT domaine_executant_pkey PRIMARY KEY (id);


--
-- Name: etat_mouvement etat_mouvement_nom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etat_mouvement
    ADD CONSTRAINT etat_mouvement_nom_key UNIQUE (nom);


--
-- Name: etat_mouvement etat_mouvement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etat_mouvement
    ADD CONSTRAINT etat_mouvement_pkey PRIMARY KEY (id);


--
-- Name: executant executant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executant
    ADD CONSTRAINT executant_pkey PRIMARY KEY (id);


--
-- Name: historique_etat_mouvement historique_etat_mouvement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_etat_mouvement
    ADD CONSTRAINT historique_etat_mouvement_pkey PRIMARY KEY (id);


--
-- Name: historique_etat_tache_chambre historique_etat_tache_chambre_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_etat_tache_chambre
    ADD CONSTRAINT historique_etat_tache_chambre_pkey PRIMARY KEY (id);


--
-- Name: history_events history_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.history_events
    ADD CONSTRAINT history_events_pkey PRIMARY KEY (id);


--
-- Name: intervention_maintenance intervention_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intervention_maintenance
    ADD CONSTRAINT intervention_maintenance_pkey PRIMARY KEY (id);


--
-- Name: lieux lieux_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lieux
    ADD CONSTRAINT lieux_code_key UNIQUE (code);


--
-- Name: lieux lieux_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lieux
    ADD CONSTRAINT lieux_pkey PRIMARY KEY (id);


--
-- Name: photo_intervention photo_intervention_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photo_intervention
    ADD CONSTRAINT photo_intervention_pkey PRIMARY KEY (id);


--
-- Name: planning_chambre planning_chambre_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_chambre
    ADD CONSTRAINT planning_chambre_pkey PRIMARY KEY (id);


--
-- Name: planning_executant planning_executant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_executant
    ADD CONSTRAINT planning_executant_pkey PRIMARY KEY (id);


--
-- Name: tache_chambre tache_chambre_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_chambre
    ADD CONSTRAINT tache_chambre_pkey PRIMARY KEY (id);


--
-- Name: tache_periodique tache_periodique_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_periodique
    ADD CONSTRAINT tache_periodique_code_key UNIQUE (code);


--
-- Name: tache_periodique_historique tache_periodique_historique_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_periodique_historique
    ADD CONSTRAINT tache_periodique_historique_pkey PRIMARY KEY (id);


--
-- Name: tache_periodique tache_periodique_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_periodique
    ADD CONSTRAINT tache_periodique_pkey PRIMARY KEY (id);


--
-- Name: tache_periodique_planning tache_periodique_planning_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_periodique_planning
    ADD CONSTRAINT tache_periodique_planning_pkey PRIMARY KEY (id);


--
-- Name: template_planning_chambre_item template_planning_chambre_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_planning_chambre_item
    ADD CONSTRAINT template_planning_chambre_item_pkey PRIMARY KEY (id);


--
-- Name: template_planning_chambre template_planning_chambre_nom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_planning_chambre
    ADD CONSTRAINT template_planning_chambre_nom_key UNIQUE (nom);


--
-- Name: template_planning_chambre template_planning_chambre_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_planning_chambre
    ADD CONSTRAINT template_planning_chambre_pkey PRIMARY KEY (id);


--
-- Name: type_intervention_maintenance type_intervention_maintenance_nom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.type_intervention_maintenance
    ADD CONSTRAINT type_intervention_maintenance_nom_key UNIQUE (nom);


--
-- Name: type_intervention_maintenance type_intervention_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.type_intervention_maintenance
    ADD CONSTRAINT type_intervention_maintenance_pkey PRIMARY KEY (id);


--
-- Name: type_mouvement type_mouvement_nom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.type_mouvement
    ADD CONSTRAINT type_mouvement_nom_key UNIQUE (nom);


--
-- Name: type_mouvement type_mouvement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.type_mouvement
    ADD CONSTRAINT type_mouvement_pkey PRIMARY KEY (id);


--
-- Name: type_planning type_planning_nom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.type_planning
    ADD CONSTRAINT type_planning_nom_key UNIQUE (nom);


--
-- Name: type_planning type_planning_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.type_planning
    ADD CONSTRAINT type_planning_pkey PRIMARY KEY (id);


--
-- Name: chauffe_eau_anomalie unique_chauffe_eau_anomalie_jour; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau_anomalie
    ADD CONSTRAINT unique_chauffe_eau_anomalie_jour UNIQUE (id_chauffe_eau, date_anomalie, type_anomalie);


--
-- Name: chauffe_eau_lieu unique_chauffe_eau_lieu; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau_lieu
    ADD CONSTRAINT unique_chauffe_eau_lieu UNIQUE (id_chauffe_eau, id_lieu);


--
-- Name: chauffe_eau_releve unique_chauffe_eau_releve_jour; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau_releve
    ADD CONSTRAINT unique_chauffe_eau_releve_jour UNIQUE (id_chauffe_eau, date_releve);


--
-- Name: planning_chambre unique_mouvement_chambre_jour; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_chambre
    ADD CONSTRAINT unique_mouvement_chambre_jour UNIQUE (id_lieu, date, id_type_mouvement);


--
-- Name: planning_executant unique_planning_executant_jour; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_executant
    ADD CONSTRAINT unique_planning_executant_jour UNIQUE (id_executant, date);


--
-- Name: tache_chambre unique_tache_chambre_source; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_chambre
    ADD CONSTRAINT unique_tache_chambre_source UNIQUE (id_planning_chambre);


--
-- Name: tache_periodique_planning unique_tache_lieu; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_periodique_planning
    ADD CONSTRAINT unique_tache_lieu UNIQUE (id_tache, id_lieu);


--
-- Name: template_planning_chambre_item unique_template_chambre_jour_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_planning_chambre_item
    ADD CONSTRAINT unique_template_chambre_jour_type UNIQUE (id_template, id_lieu, jour_semaine, id_type_mouvement);


--
-- Name: utilisateurs utilisateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_pkey PRIMARY KEY (id);


--
-- Name: article_locations article_locations_article_id_location_id_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.article_locations
    ADD CONSTRAINT article_locations_article_id_location_id_key UNIQUE (article_id, location_id);


--
-- Name: article_locations article_locations_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.article_locations
    ADD CONSTRAINT article_locations_pkey PRIMARY KEY (id);


--
-- Name: articles articles_name_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.articles
    ADD CONSTRAINT articles_name_key UNIQUE (name);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: buffet_coefficients buffet_coefficients_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.buffet_coefficients
    ADD CONSTRAINT buffet_coefficients_pkey PRIMARY KEY (id);


--
-- Name: cash_purchase_differences cash_purchase_differences_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchase_differences
    ADD CONSTRAINT cash_purchase_differences_pkey PRIMARY KEY (id);


--
-- Name: cash_purchase_items cash_purchase_items_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchase_items
    ADD CONSTRAINT cash_purchase_items_pkey PRIMARY KEY (id);


--
-- Name: cash_purchase_receipts cash_purchase_receipts_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchase_receipts
    ADD CONSTRAINT cash_purchase_receipts_pkey PRIMARY KEY (id);


--
-- Name: cash_purchases cash_purchases_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchases
    ADD CONSTRAINT cash_purchases_pkey PRIMARY KEY (id);


--
-- Name: cash_purchases cash_purchases_reference_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchases
    ADD CONSTRAINT cash_purchases_reference_key UNIQUE (reference);


--
-- Name: event_recipes event_recipes_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.event_recipes
    ADD CONSTRAINT event_recipes_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: families families_name_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.families
    ADD CONSTRAINT families_name_key UNIQUE (name);


--
-- Name: families families_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.families
    ADD CONSTRAINT families_pkey PRIMARY KEY (id);


--
-- Name: inventories inventories_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventories
    ADD CONSTRAINT inventories_pkey PRIMARY KEY (id);


--
-- Name: inventories inventories_reference_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventories
    ADD CONSTRAINT inventories_reference_key UNIQUE (reference);


--
-- Name: inventory_adjustment_requests inventory_adjustment_requests_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_adjustment_requests
    ADD CONSTRAINT inventory_adjustment_requests_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_history invoice_history_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_history
    ADD CONSTRAINT invoice_history_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_payments invoice_payments_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_payments
    ADD CONSTRAINT invoice_payments_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_reference_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoices
    ADD CONSTRAINT invoices_reference_key UNIQUE (reference);


--
-- Name: invoices invoices_supplier_id_invoice_number_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoices
    ADD CONSTRAINT invoices_supplier_id_invoice_number_key UNIQUE (supplier_id, invoice_number);


--
-- Name: locations locations_name_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.locations
    ADD CONSTRAINT locations_name_key UNIQUE (name);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: pending_ingredients pending_ingredients_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.pending_ingredients
    ADD CONSTRAINT pending_ingredients_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: purchase_groups purchase_groups_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_groups
    ADD CONSTRAINT purchase_groups_pkey PRIMARY KEY (id);


--
-- Name: purchase_needs purchase_needs_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_needs
    ADD CONSTRAINT purchase_needs_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_documents purchase_order_documents_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_documents
    ADD CONSTRAINT purchase_order_documents_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_history purchase_order_history_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_history
    ADD CONSTRAINT purchase_order_history_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_needs purchase_order_needs_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_needs
    ADD CONSTRAINT purchase_order_needs_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_needs purchase_order_needs_purchase_order_id_need_id_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_needs
    ADD CONSTRAINT purchase_order_needs_purchase_order_id_need_id_key UNIQUE (purchase_order_id, need_id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_reference_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_orders
    ADD CONSTRAINT purchase_orders_reference_key UNIQUE (reference);


--
-- Name: reception_anomalies reception_anomalies_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_anomalies
    ADD CONSTRAINT reception_anomalies_pkey PRIMARY KEY (id);


--
-- Name: reception_documents reception_documents_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_documents
    ADD CONSTRAINT reception_documents_pkey PRIMARY KEY (id);


--
-- Name: reception_history reception_history_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_history
    ADD CONSTRAINT reception_history_pkey PRIMARY KEY (id);


--
-- Name: reception_items reception_items_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_items
    ADD CONSTRAINT reception_items_pkey PRIMARY KEY (id);


--
-- Name: receptions receptions_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.receptions
    ADD CONSTRAINT receptions_pkey PRIMARY KEY (id);


--
-- Name: receptions receptions_reference_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.receptions
    ADD CONSTRAINT receptions_reference_key UNIQUE (reference);


--
-- Name: recipe_ingredients recipe_ingredients_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_code_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.recipes
    ADD CONSTRAINT recipes_code_key UNIQUE (code);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sale_returns sale_returns_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_returns
    ADD CONSTRAINT sale_returns_pkey PRIMARY KEY (id);


--
-- Name: sale_stock_outs sale_stock_outs_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_stock_outs
    ADD CONSTRAINT sale_stock_outs_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: sales sales_reference_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sales
    ADD CONSTRAINT sales_reference_key UNIQUE (reference);


--
-- Name: stock_movements stock_movements_movement_reference_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_movements
    ADD CONSTRAINT stock_movements_movement_reference_key UNIQUE (movement_reference);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock_outs stock_outs_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_outs
    ADD CONSTRAINT stock_outs_pkey PRIMARY KEY (id);


--
-- Name: stock_outs stock_outs_reference_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_outs
    ADD CONSTRAINT stock_outs_reference_key UNIQUE (reference);


--
-- Name: stock_pending_movements stock_pending_movements_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_pending_movements
    ADD CONSTRAINT stock_pending_movements_pkey PRIMARY KEY (id);


--
-- Name: sub_categories sub_categories_family_id_name_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sub_categories
    ADD CONSTRAINT sub_categories_family_id_name_key UNIQUE (family_id, name);


--
-- Name: sub_categories sub_categories_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sub_categories
    ADD CONSTRAINT sub_categories_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_name_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.suppliers
    ADD CONSTRAINT suppliers_name_key UNIQUE (name);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: units units_abbreviation_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.units
    ADD CONSTRAINT units_abbreviation_key UNIQUE (abbreviation);


--
-- Name: units units_name_key; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.units
    ADD CONSTRAINT units_name_key UNIQUE (name);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: idx_users_created_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_created_at_desc ON auth.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_email ON auth.users USING btree (email);


--
-- Name: idx_users_last_sign_in_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_last_sign_in_at_desc ON auth.users USING btree (last_sign_in_at DESC);


--
-- Name: idx_users_name; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_name ON auth.users USING btree (((raw_user_meta_data ->> 'name'::text))) WHERE ((raw_user_meta_data ->> 'name'::text) IS NOT NULL);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: idx_batiments_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batiments_code ON public.batiments USING btree (code);


--
-- Name: idx_batiments_id_executant_defaut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batiments_id_executant_defaut ON public.batiments USING btree (id_executant_defaut);


--
-- Name: idx_categories_lieu_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_lieu_code ON public.categories_lieu USING btree (code);


--
-- Name: idx_chauffe_eau_actif; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chauffe_eau_actif ON public.chauffe_eau USING btree (est_actif);


--
-- Name: idx_chauffe_eau_anomalie_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chauffe_eau_anomalie_date ON public.chauffe_eau_anomalie USING btree (date_anomalie);


--
-- Name: idx_chauffe_eau_anomalie_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chauffe_eau_anomalie_statut ON public.chauffe_eau_anomalie USING btree (statut);


--
-- Name: idx_chauffe_eau_lieu_chauffe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chauffe_eau_lieu_chauffe ON public.chauffe_eau_lieu USING btree (id_chauffe_eau);


--
-- Name: idx_chauffe_eau_lieu_lieu; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chauffe_eau_lieu_lieu ON public.chauffe_eau_lieu USING btree (id_lieu);


--
-- Name: idx_chauffe_eau_releve_conforme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chauffe_eau_releve_conforme ON public.chauffe_eau_releve USING btree (conforme);


--
-- Name: idx_chauffe_eau_releve_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chauffe_eau_releve_date ON public.chauffe_eau_releve USING btree (date_releve);


--
-- Name: idx_commentaire_intervention_intervention; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commentaire_intervention_intervention ON public.commentaire_intervention USING btree (id_intervention);


--
-- Name: idx_domaine_executant_nom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_domaine_executant_nom ON public.domaine_executant USING btree (nom);


--
-- Name: idx_executant_id_domaine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_executant_id_domaine ON public.executant USING btree (id_domaine);


--
-- Name: idx_executant_nom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_executant_nom ON public.executant USING btree (nom);


--
-- Name: idx_historique_etat_mouvement_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historique_etat_mouvement_created_at ON public.historique_etat_mouvement USING btree (created_at);


--
-- Name: idx_historique_etat_mouvement_planning; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historique_etat_mouvement_planning ON public.historique_etat_mouvement USING btree (id_planning_chambre);


--
-- Name: idx_historique_etat_tache_chambre_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historique_etat_tache_chambre_created_at ON public.historique_etat_tache_chambre USING btree (created_at);


--
-- Name: idx_historique_etat_tache_chambre_tache; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historique_etat_tache_chambre_tache ON public.historique_etat_tache_chambre USING btree (id_tache_chambre);


--
-- Name: idx_history_events_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_history_events_entity ON public.history_events USING btree (entity_type, entity_id);


--
-- Name: idx_intervention_maintenance_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intervention_maintenance_date ON public.intervention_maintenance USING btree (date_intervention);


--
-- Name: idx_intervention_maintenance_etat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intervention_maintenance_etat ON public.intervention_maintenance USING btree (id_etat);


--
-- Name: idx_intervention_maintenance_lieu; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intervention_maintenance_lieu ON public.intervention_maintenance USING btree (id_lieu);


--
-- Name: idx_intervention_maintenance_priorite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intervention_maintenance_priorite ON public.intervention_maintenance USING btree (priorite);


--
-- Name: idx_intervention_maintenance_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intervention_maintenance_type ON public.intervention_maintenance USING btree (id_type_intervention);


--
-- Name: idx_lieux_est_actif; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lieux_est_actif ON public.lieux USING btree (est_actif);


--
-- Name: idx_lieux_id_batiment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lieux_id_batiment ON public.lieux USING btree (id_batiment);


--
-- Name: idx_lieux_id_categorie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lieux_id_categorie ON public.lieux USING btree (id_categorie);


--
-- Name: idx_lieux_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lieux_numero ON public.lieux USING btree (numero);


--
-- Name: idx_photo_intervention_intervention; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photo_intervention_intervention ON public.photo_intervention USING btree (id_intervention);


--
-- Name: idx_photo_intervention_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photo_intervention_type ON public.photo_intervention USING btree (type_photo);


--
-- Name: idx_planning_chambre_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planning_chambre_date ON public.planning_chambre USING btree (date);


--
-- Name: idx_planning_chambre_etat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planning_chambre_etat ON public.planning_chambre USING btree (id_etat);


--
-- Name: idx_planning_chambre_executant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planning_chambre_executant ON public.planning_chambre USING btree (id_executant);


--
-- Name: idx_planning_chambre_lieu; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planning_chambre_lieu ON public.planning_chambre USING btree (id_lieu);


--
-- Name: idx_planning_chambre_motif_blocage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planning_chambre_motif_blocage ON public.planning_chambre USING btree (motif_blocage) WHERE (motif_blocage IS NOT NULL);


--
-- Name: idx_planning_chambre_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planning_chambre_type ON public.planning_chambre USING btree (id_type_mouvement);


--
-- Name: idx_planning_executant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planning_executant_date ON public.planning_executant USING btree (date);


--
-- Name: idx_planning_executant_executant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planning_executant_executant ON public.planning_executant USING btree (id_executant);


--
-- Name: idx_planning_executant_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planning_executant_type ON public.planning_executant USING btree (id_type_planning);


--
-- Name: idx_tache_chambre_etat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tache_chambre_etat ON public.tache_chambre USING btree (id_etat);


--
-- Name: idx_tache_chambre_executant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tache_chambre_executant ON public.tache_chambre USING btree (id_executant);


--
-- Name: idx_tache_chambre_execution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tache_chambre_execution ON public.tache_chambre USING btree (date_execution);


--
-- Name: idx_tache_chambre_lieu; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tache_chambre_lieu ON public.tache_chambre USING btree (id_lieu);


--
-- Name: idx_tache_chambre_limite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tache_chambre_limite ON public.tache_chambre USING btree (date_limite);


--
-- Name: idx_tache_chambre_motif_blocage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tache_chambre_motif_blocage ON public.tache_chambre USING btree (motif_blocage) WHERE (motif_blocage IS NOT NULL);


--
-- Name: idx_tache_chambre_planning; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tache_chambre_planning ON public.tache_chambre USING btree (id_planning_chambre);


--
-- Name: idx_tache_periodique_actif; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tache_periodique_actif ON public.tache_periodique USING btree (est_actif);


--
-- Name: idx_tache_periodique_categorie_lieu; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tache_periodique_categorie_lieu ON public.tache_periodique USING btree (id_categorie_lieu);


--
-- Name: idx_tache_periodique_historique_tache_lieu; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tache_periodique_historique_tache_lieu ON public.tache_periodique_historique USING btree (id_tache, id_lieu);


--
-- Name: idx_tache_periodique_planning_echeance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tache_periodique_planning_echeance ON public.tache_periodique_planning USING btree (date_echeance);


--
-- Name: idx_tache_periodique_planning_etat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tache_periodique_planning_etat ON public.tache_periodique_planning USING btree (id_etat);


--
-- Name: idx_tache_periodique_planning_lieu; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tache_periodique_planning_lieu ON public.tache_periodique_planning USING btree (id_lieu);


--
-- Name: idx_template_planning_chambre_item_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_planning_chambre_item_template ON public.template_planning_chambre_item USING btree (id_template);


--
-- Name: idx_type_planning_nom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_type_planning_nom ON public.type_planning USING btree (nom);


--
-- Name: idx_utilisateurs_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_utilisateurs_email ON public.utilisateurs USING btree (email);


--
-- Name: idx_utilisateurs_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_utilisateurs_role ON public.utilisateurs USING btree (role);


--
-- Name: idx_utilisateurs_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_utilisateurs_statut ON public.utilisateurs USING btree (statut);


--
-- Name: idx_article_locations_article_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_article_locations_article_id ON stock.article_locations USING btree (article_id);


--
-- Name: idx_article_locations_location_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_article_locations_location_id ON stock.article_locations USING btree (location_id);


--
-- Name: idx_articles_family_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_articles_family_id ON stock.articles USING btree (family_id);


--
-- Name: idx_articles_name; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_articles_name ON stock.articles USING btree (name);


--
-- Name: idx_articles_sellable_without_transformation; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_articles_sellable_without_transformation ON stock.articles USING btree (sellable_without_transformation);


--
-- Name: idx_articles_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_articles_status ON stock.articles USING btree (status);


--
-- Name: idx_articles_unit_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_articles_unit_id ON stock.articles USING btree (unit_id);


--
-- Name: idx_articles_usable_in_recipes; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_articles_usable_in_recipes ON stock.articles USING btree (usable_in_recipes);


--
-- Name: idx_cash_purchase_items_article_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_cash_purchase_items_article_id ON stock.cash_purchase_items USING btree (article_id);


--
-- Name: idx_cash_purchase_items_purchase_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_cash_purchase_items_purchase_id ON stock.cash_purchase_items USING btree (cash_purchase_id);


--
-- Name: idx_cash_purchase_items_stock_unit_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_cash_purchase_items_stock_unit_id ON stock.cash_purchase_items USING btree (stock_unit_id);


--
-- Name: idx_cash_purchases_buyer_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_cash_purchases_buyer_id ON stock.cash_purchases USING btree (buyer_id);


--
-- Name: idx_cash_purchases_cash_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_cash_purchases_cash_status ON stock.cash_purchases USING btree (cash_status);


--
-- Name: idx_cash_purchases_created_at; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_cash_purchases_created_at ON stock.cash_purchases USING btree (created_at);


--
-- Name: idx_cash_purchases_reception_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_cash_purchases_reception_status ON stock.cash_purchases USING btree (reception_status);


--
-- Name: idx_cash_purchases_reference; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_cash_purchases_reference ON stock.cash_purchases USING btree (reference);


--
-- Name: idx_cash_purchases_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_cash_purchases_status ON stock.cash_purchases USING btree (status);


--
-- Name: idx_cash_purchases_stock_entry_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_cash_purchases_stock_entry_status ON stock.cash_purchases USING btree (stock_entry_status);


--
-- Name: idx_event_recipes_event_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_event_recipes_event_id ON stock.event_recipes USING btree (event_id);


--
-- Name: idx_event_recipes_recipe_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_event_recipes_recipe_id ON stock.event_recipes USING btree (recipe_id);


--
-- Name: idx_events_date; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_events_date ON stock.events USING btree (date);


--
-- Name: idx_events_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_events_status ON stock.events USING btree (status);


--
-- Name: idx_events_type; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_events_type ON stock.events USING btree (type);


--
-- Name: idx_inventories_inventory_date; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_inventories_inventory_date ON stock.inventories USING btree (inventory_date);


--
-- Name: idx_inventories_location_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_inventories_location_id ON stock.inventories USING btree (location_id);


--
-- Name: idx_inventories_reference; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_inventories_reference ON stock.inventories USING btree (reference);


--
-- Name: idx_inventories_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_inventories_status ON stock.inventories USING btree (status);


--
-- Name: idx_inventories_type; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_inventories_type ON stock.inventories USING btree (type);


--
-- Name: idx_inventory_adjustments_inventory_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_inventory_adjustments_inventory_id ON stock.inventory_adjustment_requests USING btree (inventory_id);


--
-- Name: idx_inventory_adjustments_item_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_inventory_adjustments_item_id ON stock.inventory_adjustment_requests USING btree (inventory_item_id);


--
-- Name: idx_inventory_adjustments_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_inventory_adjustments_status ON stock.inventory_adjustment_requests USING btree (status);


--
-- Name: idx_inventory_items_article_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_inventory_items_article_id ON stock.inventory_items USING btree (article_id);


--
-- Name: idx_inventory_items_inventory_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_inventory_items_inventory_id ON stock.inventory_items USING btree (inventory_id);


--
-- Name: idx_inventory_items_stock_movement_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_inventory_items_stock_movement_id ON stock.inventory_items USING btree (stock_movement_id);


--
-- Name: idx_invoice_history_invoice_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoice_history_invoice_id ON stock.invoice_history USING btree (invoice_id);


--
-- Name: idx_invoice_items_article_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoice_items_article_id ON stock.invoice_items USING btree (article_id);


--
-- Name: idx_invoice_items_effective_material_unit_cost; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoice_items_effective_material_unit_cost ON stock.invoice_items USING btree (effective_material_unit_cost);


--
-- Name: idx_invoice_items_invoice_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoice_items_invoice_id ON stock.invoice_items USING btree (invoice_id);


--
-- Name: idx_invoice_payments_executed_by; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoice_payments_executed_by ON stock.invoice_payments USING btree (executed_by);


--
-- Name: idx_invoice_payments_invoice_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoice_payments_invoice_id ON stock.invoice_payments USING btree (invoice_id);


--
-- Name: idx_invoice_payments_planned_date; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoice_payments_planned_date ON stock.invoice_payments USING btree (planned_payment_date);


--
-- Name: idx_invoice_payments_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoice_payments_status ON stock.invoice_payments USING btree (status);


--
-- Name: idx_invoice_payments_validated_by; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoice_payments_validated_by ON stock.invoice_payments USING btree (validated_by);


--
-- Name: idx_invoices_due_date; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoices_due_date ON stock.invoices USING btree (due_date);


--
-- Name: idx_invoices_invoice_date; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoices_invoice_date ON stock.invoices USING btree (invoice_date);


--
-- Name: idx_invoices_one_active_by_reception; Type: INDEX; Schema: stock; Owner: -
--

CREATE UNIQUE INDEX idx_invoices_one_active_by_reception ON stock.invoices USING btree (reception_id) WHERE ((reception_id IS NOT NULL) AND (status <> 'annulee'::stock.invoice_status));


--
-- Name: idx_invoices_reception_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoices_reception_id ON stock.invoices USING btree (reception_id);


--
-- Name: idx_invoices_reference; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoices_reference ON stock.invoices USING btree (reference);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoices_status ON stock.invoices USING btree (status);


--
-- Name: idx_invoices_supplier_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_invoices_supplier_id ON stock.invoices USING btree (supplier_id);


--
-- Name: idx_pending_ingredients_imported_name_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_pending_ingredients_imported_name_status ON stock.pending_ingredients USING btree (imported_name, status);


--
-- Name: idx_pending_ingredients_recipe_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_pending_ingredients_recipe_id ON stock.pending_ingredients USING btree (recipe_id);


--
-- Name: idx_pending_ingredients_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_pending_ingredients_status ON stock.pending_ingredients USING btree (status);


--
-- Name: idx_profiles_email; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_profiles_email ON stock.profiles USING btree (email);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_profiles_role ON stock.profiles USING btree (role);


--
-- Name: idx_profiles_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_profiles_status ON stock.profiles USING btree (status);


--
-- Name: idx_profiles_user_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_profiles_user_id ON stock.profiles USING btree (user_id);


--
-- Name: idx_purchase_needs_article_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_needs_article_id ON stock.purchase_needs USING btree (article_id);


--
-- Name: idx_purchase_needs_created_at; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_needs_created_at ON stock.purchase_needs USING btree (created_at);


--
-- Name: idx_purchase_needs_destination_prevue; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_needs_destination_prevue ON stock.purchase_needs USING btree (destination_prevue);


--
-- Name: idx_purchase_needs_event_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_needs_event_id ON stock.purchase_needs USING btree (event_id);


--
-- Name: idx_purchase_needs_group_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_needs_group_id ON stock.purchase_needs USING btree (group_id);


--
-- Name: idx_purchase_needs_origin; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_needs_origin ON stock.purchase_needs USING btree (origin);


--
-- Name: idx_purchase_needs_service_demandeur; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_needs_service_demandeur ON stock.purchase_needs USING btree (service_demandeur);


--
-- Name: idx_purchase_needs_source_du_calcul; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_needs_source_du_calcul ON stock.purchase_needs USING btree (source_du_calcul);


--
-- Name: idx_purchase_needs_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_needs_status ON stock.purchase_needs USING btree (status);


--
-- Name: idx_purchase_needs_supplier_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_needs_supplier_id ON stock.purchase_needs USING btree (supplier_id);


--
-- Name: idx_purchase_needs_type_de_besoin; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_needs_type_de_besoin ON stock.purchase_needs USING btree (type_de_besoin);


--
-- Name: idx_purchase_needs_urgency; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_needs_urgency ON stock.purchase_needs USING btree (urgency);


--
-- Name: idx_purchase_order_documents_order_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_order_documents_order_id ON stock.purchase_order_documents USING btree (purchase_order_id);


--
-- Name: idx_purchase_order_history_order_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_order_history_order_id ON stock.purchase_order_history USING btree (purchase_order_id);


--
-- Name: idx_purchase_order_items_article_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_order_items_article_id ON stock.purchase_order_items USING btree (article_id);


--
-- Name: idx_purchase_order_items_order_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_order_items_order_id ON stock.purchase_order_items USING btree (purchase_order_id);


--
-- Name: idx_purchase_order_items_stock_unit_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_order_items_stock_unit_id ON stock.purchase_order_items USING btree (stock_unit_id);


--
-- Name: idx_purchase_order_needs_need_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_order_needs_need_id ON stock.purchase_order_needs USING btree (need_id);


--
-- Name: idx_purchase_order_needs_order_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_order_needs_order_id ON stock.purchase_order_needs USING btree (purchase_order_id);


--
-- Name: idx_purchase_orders_delivery_date; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_orders_delivery_date ON stock.purchase_orders USING btree (delivery_date);


--
-- Name: idx_purchase_orders_order_date; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_orders_order_date ON stock.purchase_orders USING btree (order_date);


--
-- Name: idx_purchase_orders_reference; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_orders_reference ON stock.purchase_orders USING btree (reference);


--
-- Name: idx_purchase_orders_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_orders_status ON stock.purchase_orders USING btree (status);


--
-- Name: idx_purchase_orders_supplier_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_purchase_orders_supplier_id ON stock.purchase_orders USING btree (supplier_id);


--
-- Name: idx_reception_anomalies_item_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_reception_anomalies_item_id ON stock.reception_anomalies USING btree (reception_item_id);


--
-- Name: idx_reception_documents_reception_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_reception_documents_reception_id ON stock.reception_documents USING btree (reception_id);


--
-- Name: idx_reception_history_reception_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_reception_history_reception_id ON stock.reception_history USING btree (reception_id);


--
-- Name: idx_reception_items_article_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_reception_items_article_id ON stock.reception_items USING btree (article_id);


--
-- Name: idx_reception_items_effective_material_unit_cost; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_reception_items_effective_material_unit_cost ON stock.reception_items USING btree (effective_material_unit_cost);


--
-- Name: idx_reception_items_reception_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_reception_items_reception_id ON stock.reception_items USING btree (reception_id);


--
-- Name: idx_reception_items_unit_display_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_reception_items_unit_display_id ON stock.reception_items USING btree (unit_display_id);


--
-- Name: idx_receptions_is_historical; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_receptions_is_historical ON stock.receptions USING btree (is_historical);


--
-- Name: idx_receptions_purchase_order_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_receptions_purchase_order_id ON stock.receptions USING btree (purchase_order_id);


--
-- Name: idx_receptions_reception_date; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_receptions_reception_date ON stock.receptions USING btree (reception_date);


--
-- Name: idx_receptions_reference; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_receptions_reference ON stock.receptions USING btree (reference);


--
-- Name: idx_receptions_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_receptions_status ON stock.receptions USING btree (status);


--
-- Name: idx_receptions_supplier_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_receptions_supplier_id ON stock.receptions USING btree (supplier_id);


--
-- Name: idx_recipe_ingredients_article_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_recipe_ingredients_article_id ON stock.recipe_ingredients USING btree (article_id);


--
-- Name: idx_recipe_ingredients_recipe_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_recipe_ingredients_recipe_id ON stock.recipe_ingredients USING btree (recipe_id);


--
-- Name: idx_recipes_code; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_recipes_code ON stock.recipes USING btree (code);


--
-- Name: idx_recipes_main_ingredient; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_recipes_main_ingredient ON stock.recipes USING btree (main_ingredient);


--
-- Name: idx_recipes_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_recipes_status ON stock.recipes USING btree (status);


--
-- Name: idx_recipes_type; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_recipes_type ON stock.recipes USING btree (type);


--
-- Name: idx_sale_items_article_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sale_items_article_id ON stock.sale_items USING btree (article_id);


--
-- Name: idx_sale_items_recipe_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sale_items_recipe_id ON stock.sale_items USING btree (recipe_id);


--
-- Name: idx_sale_items_sale_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sale_items_sale_id ON stock.sale_items USING btree (sale_id);


--
-- Name: idx_sale_items_unit_display_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sale_items_unit_display_id ON stock.sale_items USING btree (unit_display_id);


--
-- Name: idx_sale_items_unit_stock_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sale_items_unit_stock_id ON stock.sale_items USING btree (unit_stock_id);


--
-- Name: idx_sale_returns_item_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sale_returns_item_id ON stock.sale_returns USING btree (sale_item_id);


--
-- Name: idx_sale_returns_sale_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sale_returns_sale_id ON stock.sale_returns USING btree (sale_id);


--
-- Name: idx_sale_returns_stock_movement_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sale_returns_stock_movement_id ON stock.sale_returns USING btree (stock_movement_id);


--
-- Name: idx_sale_stock_outs_sale_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sale_stock_outs_sale_id ON stock.sale_stock_outs USING btree (sale_id);


--
-- Name: idx_sale_stock_outs_stock_out_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sale_stock_outs_stock_out_id ON stock.sale_stock_outs USING btree (stock_out_id);


--
-- Name: idx_sales_channel; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sales_channel ON stock.sales USING btree (channel);


--
-- Name: idx_sales_event_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sales_event_id ON stock.sales USING btree (event_id);


--
-- Name: idx_sales_reference; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sales_reference ON stock.sales USING btree (reference);


--
-- Name: idx_sales_sale_date; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sales_sale_date ON stock.sales USING btree (sale_date);


--
-- Name: idx_sales_sales_point; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sales_sales_point ON stock.sales USING btree (sales_point);


--
-- Name: idx_sales_service_mode; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sales_service_mode ON stock.sales USING btree (service_mode);


--
-- Name: idx_sales_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sales_status ON stock.sales USING btree (status);


--
-- Name: idx_stock_movements_article_date; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_article_date ON stock.stock_movements USING btree (article_id, movement_date DESC);


--
-- Name: idx_stock_movements_article_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_article_id ON stock.stock_movements USING btree (article_id);


--
-- Name: idx_stock_movements_effective_cost_method; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_effective_cost_method ON stock.stock_movements USING btree (effective_cost_method);


--
-- Name: idx_stock_movements_effective_cost_source; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_effective_cost_source ON stock.stock_movements USING btree (effective_cost_source);


--
-- Name: idx_stock_movements_effective_material_unit_cost; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_effective_material_unit_cost ON stock.stock_movements USING btree (effective_material_unit_cost);


--
-- Name: idx_stock_movements_from_location; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_from_location ON stock.stock_movements USING btree (from_location_id);


--
-- Name: idx_stock_movements_movement_date; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_movement_date ON stock.stock_movements USING btree (movement_date);


--
-- Name: idx_stock_movements_movement_reference; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_movement_reference ON stock.stock_movements USING btree (movement_reference);


--
-- Name: idx_stock_movements_movement_type; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_movement_type ON stock.stock_movements USING btree (movement_type);


--
-- Name: idx_stock_movements_price_source; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_price_source ON stock.stock_movements USING btree (price_source);


--
-- Name: idx_stock_movements_reception_item_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_reception_item_id ON stock.stock_movements USING btree (reception_item_id);


--
-- Name: idx_stock_movements_reference_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_reference_id ON stock.stock_movements USING btree (reference_id);


--
-- Name: idx_stock_movements_reference_type; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_reference_type ON stock.stock_movements USING btree (reference_type);


--
-- Name: idx_stock_movements_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_status ON stock.stock_movements USING btree (status);


--
-- Name: idx_stock_movements_to_location; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_movements_to_location ON stock.stock_movements USING btree (to_location_id);


--
-- Name: idx_stock_outs_article_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_outs_article_id ON stock.stock_outs USING btree (article_id);


--
-- Name: idx_stock_outs_consumption_type; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_outs_consumption_type ON stock.stock_outs USING btree (consumption_type);


--
-- Name: idx_stock_outs_destination; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_outs_destination ON stock.stock_outs USING btree (destination);


--
-- Name: idx_stock_outs_event_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_outs_event_id ON stock.stock_outs USING btree (event_id);


--
-- Name: idx_stock_outs_location_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_outs_location_id ON stock.stock_outs USING btree (location_id);


--
-- Name: idx_stock_outs_out_date; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_outs_out_date ON stock.stock_outs USING btree (out_date);


--
-- Name: idx_stock_outs_recipe_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_outs_recipe_id ON stock.stock_outs USING btree (recipe_id);


--
-- Name: idx_stock_outs_reference; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_outs_reference ON stock.stock_outs USING btree (reference);


--
-- Name: idx_stock_outs_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_outs_status ON stock.stock_outs USING btree (status);


--
-- Name: idx_stock_pending_movements_reception_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_stock_pending_movements_reception_id ON stock.stock_pending_movements USING btree (reception_id);


--
-- Name: idx_sub_categories_family_id; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sub_categories_family_id ON stock.sub_categories USING btree (family_id);


--
-- Name: idx_sub_categories_name; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_sub_categories_name ON stock.sub_categories USING btree (name);


--
-- Name: idx_suppliers_is_identified; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_suppliers_is_identified ON stock.suppliers USING btree (is_identified);


--
-- Name: idx_suppliers_name; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_suppliers_name ON stock.suppliers USING btree (name);


--
-- Name: idx_suppliers_nif; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_suppliers_nif ON stock.suppliers USING btree (nif);


--
-- Name: idx_suppliers_stat; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_suppliers_stat ON stock.suppliers USING btree (stat);


--
-- Name: idx_suppliers_supplier_tax_status; Type: INDEX; Schema: stock; Owner: -
--

CREATE INDEX idx_suppliers_supplier_tax_status ON stock.suppliers USING btree (supplier_tax_status);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: users on_auth_user_created_stock_profile; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created_stock_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION stock.handle_new_user();


--
-- Name: planning_chambre trigger_creer_chauffe_eau_depuis_planning; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_creer_chauffe_eau_depuis_planning AFTER INSERT OR UPDATE OF id_lieu, date, id_type_mouvement ON public.planning_chambre FOR EACH ROW EXECUTE FUNCTION public.creer_chauffe_eau_depuis_planning();


--
-- Name: planning_chambre trigger_creer_tache_chambre_depuis_planning; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_creer_tache_chambre_depuis_planning AFTER INSERT OR UPDATE OF id_lieu, date, id_type_mouvement, id_executant, id_etat, motif_blocage ON public.planning_chambre FOR EACH ROW EXECUTE FUNCTION public.creer_tache_chambre_depuis_planning();


--
-- Name: chauffe_eau_anomalie trigger_history_chauffe_eau_anomalie; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_history_chauffe_eau_anomalie AFTER INSERT OR UPDATE ON public.chauffe_eau_anomalie FOR EACH ROW EXECUTE FUNCTION public.tracer_chauffe_eau_event();


--
-- Name: chauffe_eau_releve trigger_history_chauffe_eau_releve; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_history_chauffe_eau_releve AFTER INSERT OR UPDATE ON public.chauffe_eau_releve FOR EACH ROW EXECUTE FUNCTION public.tracer_chauffe_eau_event();


--
-- Name: tache_periodique_planning trigger_initialiser_tache_periodique_planning; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_initialiser_tache_periodique_planning BEFORE INSERT OR UPDATE ON public.tache_periodique_planning FOR EACH ROW EXECUTE FUNCTION public.initialiser_tache_periodique_planning();


--
-- Name: chauffe_eau trigger_touch_chauffe_eau; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_touch_chauffe_eau BEFORE UPDATE ON public.chauffe_eau FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: chauffe_eau_anomalie trigger_touch_chauffe_eau_anomalie; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_touch_chauffe_eau_anomalie BEFORE UPDATE ON public.chauffe_eau_anomalie FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: chauffe_eau_releve trigger_touch_chauffe_eau_releve; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_touch_chauffe_eau_releve BEFORE UPDATE ON public.chauffe_eau_releve FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: planning_chambre trigger_tracer_etat_planning_chambre; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_tracer_etat_planning_chambre AFTER INSERT OR UPDATE OF id_etat ON public.planning_chambre FOR EACH ROW EXECUTE FUNCTION public.tracer_etat_planning_chambre();


--
-- Name: tache_chambre trigger_tracer_etat_tache_chambre; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_tracer_etat_tache_chambre AFTER INSERT OR UPDATE OF id_etat, motif_blocage ON public.tache_chambre FOR EACH ROW EXECUTE FUNCTION public.tracer_etat_tache_chambre();


--
-- Name: intervention_maintenance trigger_valider_intervention_maintenance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_valider_intervention_maintenance BEFORE UPDATE ON public.intervention_maintenance FOR EACH ROW EXECUTE FUNCTION public.valider_intervention_maintenance();


--
-- Name: planning_chambre trigger_valider_planning_chambre; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_valider_planning_chambre BEFORE INSERT OR UPDATE ON public.planning_chambre FOR EACH ROW EXECUTE FUNCTION public.valider_planning_chambre();


--
-- Name: planning_executant trigger_valider_planning_executant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_valider_planning_executant BEFORE INSERT OR UPDATE ON public.planning_executant FOR EACH ROW EXECUTE FUNCTION public.valider_planning_executant();


--
-- Name: planning_chambre trigger_valider_suivi_planning_chambre; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_valider_suivi_planning_chambre BEFORE INSERT OR UPDATE OF id_etat, motif_blocage ON public.planning_chambre FOR EACH ROW EXECUTE FUNCTION public.valider_suivi_planning_chambre();


--
-- Name: tache_chambre trigger_valider_suivi_tache_chambre; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_valider_suivi_tache_chambre BEFORE INSERT OR UPDATE OF id_etat, motif_blocage ON public.tache_chambre FOR EACH ROW EXECUTE FUNCTION public.valider_suivi_tache_chambre();


--
-- Name: tache_chambre trigger_valider_tache_chambre; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_valider_tache_chambre BEFORE INSERT OR UPDATE ON public.tache_chambre FOR EACH ROW EXECUTE FUNCTION public.valider_tache_chambre();


--
-- Name: photo_intervention trigger_verrouiller_photos_intervention; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_verrouiller_photos_intervention BEFORE INSERT OR DELETE OR UPDATE ON public.photo_intervention FOR EACH ROW EXECUTE FUNCTION public.empecher_modification_photos_intervention_fermee();


--
-- Name: inventories generate_inventory_reference_trigger; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER generate_inventory_reference_trigger BEFORE INSERT ON stock.inventories FOR EACH ROW WHEN ((new.reference IS NULL)) EXECUTE FUNCTION stock.generate_inventory_reference();


--
-- Name: invoices generate_invoice_reference_trigger; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER generate_invoice_reference_trigger BEFORE INSERT ON stock.invoices FOR EACH ROW WHEN ((new.reference IS NULL)) EXECUTE FUNCTION stock.generate_invoice_reference();


--
-- Name: stock_movements generate_movement_reference_trigger; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER generate_movement_reference_trigger BEFORE INSERT ON stock.stock_movements FOR EACH ROW WHEN ((new.movement_reference IS NULL)) EXECUTE FUNCTION stock.generate_movement_reference();


--
-- Name: recipes generate_recipe_code_before_insert; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER generate_recipe_code_before_insert BEFORE INSERT ON stock.recipes FOR EACH ROW EXECUTE FUNCTION stock.generate_recipe_code();


--
-- Name: recipes generate_recipe_code_before_update; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER generate_recipe_code_before_update BEFORE UPDATE OF status ON stock.recipes FOR EACH ROW EXECUTE FUNCTION stock.generate_recipe_code();


--
-- Name: sales generate_sale_reference_trigger; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER generate_sale_reference_trigger BEFORE INSERT ON stock.sales FOR EACH ROW WHEN ((new.reference IS NULL)) EXECUTE FUNCTION stock.generate_sale_reference();


--
-- Name: stock_outs generate_stock_out_reference_trigger; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER generate_stock_out_reference_trigger BEFORE INSERT ON stock.stock_outs FOR EACH ROW WHEN ((new.reference IS NULL)) EXECUTE FUNCTION stock.generate_stock_out_reference();


--
-- Name: stock_movements handle_movement_cost_trigger; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER handle_movement_cost_trigger BEFORE INSERT ON stock.stock_movements FOR EACH ROW EXECUTE FUNCTION stock.handle_movement_cost();


--
-- Name: recipe_ingredients recalculate_recipe_costs_after_ingredient_change; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER recalculate_recipe_costs_after_ingredient_change AFTER INSERT OR DELETE OR UPDATE ON stock.recipe_ingredients FOR EACH ROW EXECUTE FUNCTION stock.recalculate_recipe_costs_trigger();


--
-- Name: recipe_ingredients set_recipe_ingredient_total_trigger; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER set_recipe_ingredient_total_trigger BEFORE INSERT OR UPDATE ON stock.recipe_ingredients FOR EACH ROW EXECUTE FUNCTION stock.set_recipe_ingredient_total();


--
-- Name: articles update_articles_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON stock.articles FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: buffet_coefficients update_buffet_coefficients_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_buffet_coefficients_updated_at BEFORE UPDATE ON stock.buffet_coefficients FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: cash_purchase_items update_cash_purchase_items_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_cash_purchase_items_updated_at BEFORE UPDATE ON stock.cash_purchase_items FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: cash_purchases update_cash_purchases_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_cash_purchases_updated_at BEFORE UPDATE ON stock.cash_purchases FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: event_recipes update_event_recipes_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_event_recipes_updated_at BEFORE UPDATE ON stock.event_recipes FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: events update_events_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON stock.events FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: families update_families_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON stock.families FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: inventories update_inventories_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_inventories_updated_at BEFORE UPDATE ON stock.inventories FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: inventory_items update_inventory_items_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON stock.inventory_items FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON stock.invoices FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: locations update_locations_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON stock.locations FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: pending_ingredients update_pending_ingredients_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_pending_ingredients_updated_at BEFORE UPDATE ON stock.pending_ingredients FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON stock.profiles FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: purchase_groups update_purchase_groups_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_purchase_groups_updated_at BEFORE UPDATE ON stock.purchase_groups FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: purchase_needs update_purchase_needs_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_purchase_needs_updated_at BEFORE UPDATE ON stock.purchase_needs FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: purchase_order_items update_purchase_order_items_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_purchase_order_items_updated_at BEFORE UPDATE ON stock.purchase_order_items FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: purchase_orders update_purchase_orders_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON stock.purchase_orders FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: reception_items update_reception_items_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_reception_items_updated_at BEFORE UPDATE ON stock.reception_items FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: receptions update_receptions_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_receptions_updated_at BEFORE UPDATE ON stock.receptions FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: recipe_ingredients update_recipe_ingredients_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_recipe_ingredients_updated_at BEFORE UPDATE ON stock.recipe_ingredients FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: recipes update_recipes_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON stock.recipes FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: sales update_sales_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON stock.sales FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: stock_movements update_stock_movements_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_stock_movements_updated_at BEFORE UPDATE ON stock.stock_movements FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: stock_outs update_stock_outs_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_stock_outs_updated_at BEFORE UPDATE ON stock.stock_outs FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: sub_categories update_sub_categories_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_sub_categories_updated_at BEFORE UPDATE ON stock.sub_categories FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: suppliers update_suppliers_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON stock.suppliers FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: units update_units_updated_at; Type: TRIGGER; Schema: stock; Owner: -
--

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON stock.units FOR EACH ROW EXECUTE FUNCTION stock.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: batiments batiments_id_executant_defaut_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batiments
    ADD CONSTRAINT batiments_id_executant_defaut_fkey FOREIGN KEY (id_executant_defaut) REFERENCES public.executant(id) ON DELETE SET NULL;


--
-- Name: chauffe_eau_anomalie chauffe_eau_anomalie_id_chauffe_eau_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau_anomalie
    ADD CONSTRAINT chauffe_eau_anomalie_id_chauffe_eau_fkey FOREIGN KEY (id_chauffe_eau) REFERENCES public.chauffe_eau(id) ON DELETE CASCADE;


--
-- Name: chauffe_eau_anomalie chauffe_eau_anomalie_id_releve_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau_anomalie
    ADD CONSTRAINT chauffe_eau_anomalie_id_releve_fkey FOREIGN KEY (id_releve) REFERENCES public.chauffe_eau_releve(id) ON DELETE SET NULL;


--
-- Name: chauffe_eau_lieu chauffe_eau_lieu_id_chauffe_eau_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau_lieu
    ADD CONSTRAINT chauffe_eau_lieu_id_chauffe_eau_fkey FOREIGN KEY (id_chauffe_eau) REFERENCES public.chauffe_eau(id) ON DELETE CASCADE;


--
-- Name: chauffe_eau_lieu chauffe_eau_lieu_id_lieu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau_lieu
    ADD CONSTRAINT chauffe_eau_lieu_id_lieu_fkey FOREIGN KEY (id_lieu) REFERENCES public.lieux(id) ON DELETE CASCADE;


--
-- Name: chauffe_eau_releve chauffe_eau_releve_id_chauffe_eau_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau_releve
    ADD CONSTRAINT chauffe_eau_releve_id_chauffe_eau_fkey FOREIGN KEY (id_chauffe_eau) REFERENCES public.chauffe_eau(id) ON DELETE CASCADE;


--
-- Name: chauffe_eau_releve chauffe_eau_releve_id_utilisateur_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chauffe_eau_releve
    ADD CONSTRAINT chauffe_eau_releve_id_utilisateur_fkey FOREIGN KEY (id_utilisateur) REFERENCES public.utilisateurs(id) ON DELETE SET NULL;


--
-- Name: commentaire_intervention commentaire_intervention_id_intervention_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentaire_intervention
    ADD CONSTRAINT commentaire_intervention_id_intervention_fkey FOREIGN KEY (id_intervention) REFERENCES public.intervention_maintenance(id) ON DELETE CASCADE;


--
-- Name: commentaire_intervention commentaire_intervention_id_utilisateur_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentaire_intervention
    ADD CONSTRAINT commentaire_intervention_id_utilisateur_fkey FOREIGN KEY (id_utilisateur) REFERENCES public.utilisateurs(id) ON DELETE SET NULL;


--
-- Name: executant executant_id_domaine_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executant
    ADD CONSTRAINT executant_id_domaine_fkey FOREIGN KEY (id_domaine) REFERENCES public.domaine_executant(id) ON DELETE CASCADE;


--
-- Name: historique_etat_mouvement historique_etat_mouvement_ancien_id_etat_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_etat_mouvement
    ADD CONSTRAINT historique_etat_mouvement_ancien_id_etat_fkey FOREIGN KEY (ancien_id_etat) REFERENCES public.etat_mouvement(id) ON DELETE SET NULL;


--
-- Name: historique_etat_mouvement historique_etat_mouvement_id_planning_chambre_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_etat_mouvement
    ADD CONSTRAINT historique_etat_mouvement_id_planning_chambre_fkey FOREIGN KEY (id_planning_chambre) REFERENCES public.planning_chambre(id) ON DELETE CASCADE;


--
-- Name: historique_etat_mouvement historique_etat_mouvement_modifie_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_etat_mouvement
    ADD CONSTRAINT historique_etat_mouvement_modifie_par_fkey FOREIGN KEY (modifie_par) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: historique_etat_mouvement historique_etat_mouvement_nouveau_id_etat_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_etat_mouvement
    ADD CONSTRAINT historique_etat_mouvement_nouveau_id_etat_fkey FOREIGN KEY (nouveau_id_etat) REFERENCES public.etat_mouvement(id) ON DELETE RESTRICT;


--
-- Name: historique_etat_tache_chambre historique_etat_tache_chambre_ancien_id_etat_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_etat_tache_chambre
    ADD CONSTRAINT historique_etat_tache_chambre_ancien_id_etat_fkey FOREIGN KEY (ancien_id_etat) REFERENCES public.etat_mouvement(id) ON DELETE SET NULL;


--
-- Name: historique_etat_tache_chambre historique_etat_tache_chambre_id_tache_chambre_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_etat_tache_chambre
    ADD CONSTRAINT historique_etat_tache_chambre_id_tache_chambre_fkey FOREIGN KEY (id_tache_chambre) REFERENCES public.tache_chambre(id) ON DELETE CASCADE;


--
-- Name: historique_etat_tache_chambre historique_etat_tache_chambre_modifie_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_etat_tache_chambre
    ADD CONSTRAINT historique_etat_tache_chambre_modifie_par_fkey FOREIGN KEY (modifie_par) REFERENCES public.utilisateurs(id) ON DELETE SET NULL;


--
-- Name: historique_etat_tache_chambre historique_etat_tache_chambre_nouveau_id_etat_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_etat_tache_chambre
    ADD CONSTRAINT historique_etat_tache_chambre_nouveau_id_etat_fkey FOREIGN KEY (nouveau_id_etat) REFERENCES public.etat_mouvement(id) ON DELETE CASCADE;


--
-- Name: history_events history_events_id_utilisateur_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.history_events
    ADD CONSTRAINT history_events_id_utilisateur_fkey FOREIGN KEY (id_utilisateur) REFERENCES public.utilisateurs(id) ON DELETE SET NULL;


--
-- Name: intervention_maintenance intervention_maintenance_id_etat_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intervention_maintenance
    ADD CONSTRAINT intervention_maintenance_id_etat_fkey FOREIGN KEY (id_etat) REFERENCES public.etat_mouvement(id);


--
-- Name: intervention_maintenance intervention_maintenance_id_executant_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intervention_maintenance
    ADD CONSTRAINT intervention_maintenance_id_executant_fkey FOREIGN KEY (id_executant) REFERENCES public.executant(id) ON DELETE SET NULL;


--
-- Name: intervention_maintenance intervention_maintenance_id_lieu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intervention_maintenance
    ADD CONSTRAINT intervention_maintenance_id_lieu_fkey FOREIGN KEY (id_lieu) REFERENCES public.lieux(id) ON DELETE CASCADE;


--
-- Name: intervention_maintenance intervention_maintenance_id_type_intervention_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intervention_maintenance
    ADD CONSTRAINT intervention_maintenance_id_type_intervention_fkey FOREIGN KEY (id_type_intervention) REFERENCES public.type_intervention_maintenance(id);


--
-- Name: lieux lieux_id_batiment_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lieux
    ADD CONSTRAINT lieux_id_batiment_fkey FOREIGN KEY (id_batiment) REFERENCES public.batiments(id) ON DELETE SET NULL;


--
-- Name: lieux lieux_id_categorie_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lieux
    ADD CONSTRAINT lieux_id_categorie_fkey FOREIGN KEY (id_categorie) REFERENCES public.categories_lieu(id);


--
-- Name: photo_intervention photo_intervention_id_intervention_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photo_intervention
    ADD CONSTRAINT photo_intervention_id_intervention_fkey FOREIGN KEY (id_intervention) REFERENCES public.intervention_maintenance(id) ON DELETE CASCADE;


--
-- Name: planning_chambre planning_chambre_id_etat_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_chambre
    ADD CONSTRAINT planning_chambre_id_etat_fkey FOREIGN KEY (id_etat) REFERENCES public.etat_mouvement(id);


--
-- Name: planning_chambre planning_chambre_id_executant_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_chambre
    ADD CONSTRAINT planning_chambre_id_executant_fkey FOREIGN KEY (id_executant) REFERENCES public.executant(id) ON DELETE SET NULL;


--
-- Name: planning_chambre planning_chambre_id_lieu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_chambre
    ADD CONSTRAINT planning_chambre_id_lieu_fkey FOREIGN KEY (id_lieu) REFERENCES public.lieux(id) ON DELETE CASCADE;


--
-- Name: planning_chambre planning_chambre_id_type_mouvement_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_chambre
    ADD CONSTRAINT planning_chambre_id_type_mouvement_fkey FOREIGN KEY (id_type_mouvement) REFERENCES public.type_mouvement(id);


--
-- Name: planning_executant planning_executant_id_executant_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_executant
    ADD CONSTRAINT planning_executant_id_executant_fkey FOREIGN KEY (id_executant) REFERENCES public.executant(id) ON DELETE CASCADE;


--
-- Name: planning_executant planning_executant_id_type_planning_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_executant
    ADD CONSTRAINT planning_executant_id_type_planning_fkey FOREIGN KEY (id_type_planning) REFERENCES public.type_planning(id) ON DELETE RESTRICT;


--
-- Name: tache_chambre tache_chambre_id_etat_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_chambre
    ADD CONSTRAINT tache_chambre_id_etat_fkey FOREIGN KEY (id_etat) REFERENCES public.etat_mouvement(id);


--
-- Name: tache_chambre tache_chambre_id_executant_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_chambre
    ADD CONSTRAINT tache_chambre_id_executant_fkey FOREIGN KEY (id_executant) REFERENCES public.executant(id) ON DELETE SET NULL;


--
-- Name: tache_chambre tache_chambre_id_lieu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_chambre
    ADD CONSTRAINT tache_chambre_id_lieu_fkey FOREIGN KEY (id_lieu) REFERENCES public.lieux(id) ON DELETE CASCADE;


--
-- Name: tache_chambre tache_chambre_id_planning_chambre_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_chambre
    ADD CONSTRAINT tache_chambre_id_planning_chambre_fkey FOREIGN KEY (id_planning_chambre) REFERENCES public.planning_chambre(id) ON DELETE SET NULL;


--
-- Name: tache_chambre tache_chambre_id_type_mouvement_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_chambre
    ADD CONSTRAINT tache_chambre_id_type_mouvement_fkey FOREIGN KEY (id_type_mouvement) REFERENCES public.type_mouvement(id);


--
-- Name: tache_periodique_historique tache_periodique_historique_id_executant_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_periodique_historique
    ADD CONSTRAINT tache_periodique_historique_id_executant_fkey FOREIGN KEY (id_executant) REFERENCES public.executant(id) ON DELETE SET NULL;


--
-- Name: tache_periodique_historique tache_periodique_historique_id_lieu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_periodique_historique
    ADD CONSTRAINT tache_periodique_historique_id_lieu_fkey FOREIGN KEY (id_lieu) REFERENCES public.lieux(id) ON DELETE CASCADE;


--
-- Name: tache_periodique_historique tache_periodique_historique_id_tache_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_periodique_historique
    ADD CONSTRAINT tache_periodique_historique_id_tache_fkey FOREIGN KEY (id_tache) REFERENCES public.tache_periodique(id) ON DELETE CASCADE;


--
-- Name: tache_periodique tache_periodique_id_categorie_lieu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_periodique
    ADD CONSTRAINT tache_periodique_id_categorie_lieu_fkey FOREIGN KEY (id_categorie_lieu) REFERENCES public.categories_lieu(id);


--
-- Name: tache_periodique_planning tache_periodique_planning_id_etat_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_periodique_planning
    ADD CONSTRAINT tache_periodique_planning_id_etat_fkey FOREIGN KEY (id_etat) REFERENCES public.etat_mouvement(id);


--
-- Name: tache_periodique_planning tache_periodique_planning_id_executant_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_periodique_planning
    ADD CONSTRAINT tache_periodique_planning_id_executant_fkey FOREIGN KEY (id_executant) REFERENCES public.executant(id) ON DELETE SET NULL;


--
-- Name: tache_periodique_planning tache_periodique_planning_id_lieu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_periodique_planning
    ADD CONSTRAINT tache_periodique_planning_id_lieu_fkey FOREIGN KEY (id_lieu) REFERENCES public.lieux(id) ON DELETE CASCADE;


--
-- Name: tache_periodique_planning tache_periodique_planning_id_tache_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tache_periodique_planning
    ADD CONSTRAINT tache_periodique_planning_id_tache_fkey FOREIGN KEY (id_tache) REFERENCES public.tache_periodique(id) ON DELETE CASCADE;


--
-- Name: template_planning_chambre_item template_planning_chambre_item_id_executant_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_planning_chambre_item
    ADD CONSTRAINT template_planning_chambre_item_id_executant_fkey FOREIGN KEY (id_executant) REFERENCES public.executant(id) ON DELETE SET NULL;


--
-- Name: template_planning_chambre_item template_planning_chambre_item_id_lieu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_planning_chambre_item
    ADD CONSTRAINT template_planning_chambre_item_id_lieu_fkey FOREIGN KEY (id_lieu) REFERENCES public.lieux(id) ON DELETE CASCADE;


--
-- Name: template_planning_chambre_item template_planning_chambre_item_id_template_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_planning_chambre_item
    ADD CONSTRAINT template_planning_chambre_item_id_template_fkey FOREIGN KEY (id_template) REFERENCES public.template_planning_chambre(id) ON DELETE CASCADE;


--
-- Name: template_planning_chambre_item template_planning_chambre_item_id_type_mouvement_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_planning_chambre_item
    ADD CONSTRAINT template_planning_chambre_item_id_type_mouvement_fkey FOREIGN KEY (id_type_mouvement) REFERENCES public.type_mouvement(id);


--
-- Name: utilisateurs utilisateurs_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: article_locations article_locations_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.article_locations
    ADD CONSTRAINT article_locations_article_id_fkey FOREIGN KEY (article_id) REFERENCES stock.articles(id) ON DELETE CASCADE;


--
-- Name: article_locations article_locations_location_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.article_locations
    ADD CONSTRAINT article_locations_location_id_fkey FOREIGN KEY (location_id) REFERENCES stock.locations(id) ON DELETE CASCADE;


--
-- Name: articles articles_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.articles
    ADD CONSTRAINT articles_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: articles articles_family_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.articles
    ADD CONSTRAINT articles_family_id_fkey FOREIGN KEY (family_id) REFERENCES stock.families(id);


--
-- Name: articles articles_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.articles
    ADD CONSTRAINT articles_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES stock.units(id);


--
-- Name: articles articles_updated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.articles
    ADD CONSTRAINT articles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES stock.profiles(id);


--
-- Name: buffet_coefficients buffet_coefficients_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.buffet_coefficients
    ADD CONSTRAINT buffet_coefficients_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: cash_purchase_differences cash_purchase_differences_cash_purchase_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchase_differences
    ADD CONSTRAINT cash_purchase_differences_cash_purchase_id_fkey FOREIGN KEY (cash_purchase_id) REFERENCES stock.cash_purchases(id) ON DELETE CASCADE;


--
-- Name: cash_purchase_differences cash_purchase_differences_justified_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchase_differences
    ADD CONSTRAINT cash_purchase_differences_justified_by_fkey FOREIGN KEY (justified_by) REFERENCES stock.profiles(id);


--
-- Name: cash_purchase_differences cash_purchase_differences_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchase_differences
    ADD CONSTRAINT cash_purchase_differences_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES stock.profiles(id);


--
-- Name: cash_purchase_items cash_purchase_items_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchase_items
    ADD CONSTRAINT cash_purchase_items_article_id_fkey FOREIGN KEY (article_id) REFERENCES stock.articles(id);


--
-- Name: cash_purchase_items cash_purchase_items_cash_purchase_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchase_items
    ADD CONSTRAINT cash_purchase_items_cash_purchase_id_fkey FOREIGN KEY (cash_purchase_id) REFERENCES stock.cash_purchases(id) ON DELETE CASCADE;


--
-- Name: cash_purchase_items cash_purchase_items_purchase_need_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchase_items
    ADD CONSTRAINT cash_purchase_items_purchase_need_id_fkey FOREIGN KEY (purchase_need_id) REFERENCES stock.purchase_needs(id);


--
-- Name: cash_purchase_items cash_purchase_items_stock_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchase_items
    ADD CONSTRAINT cash_purchase_items_stock_unit_id_fkey FOREIGN KEY (stock_unit_id) REFERENCES stock.units(id);


--
-- Name: cash_purchase_items cash_purchase_items_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchase_items
    ADD CONSTRAINT cash_purchase_items_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES stock.units(id);


--
-- Name: cash_purchase_receipts cash_purchase_receipts_cash_purchase_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchase_receipts
    ADD CONSTRAINT cash_purchase_receipts_cash_purchase_id_fkey FOREIGN KEY (cash_purchase_id) REFERENCES stock.cash_purchases(id) ON DELETE CASCADE;


--
-- Name: cash_purchase_receipts cash_purchase_receipts_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchase_receipts
    ADD CONSTRAINT cash_purchase_receipts_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES stock.profiles(id);


--
-- Name: cash_purchases cash_purchases_buyer_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchases
    ADD CONSTRAINT cash_purchases_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES stock.profiles(id);


--
-- Name: cash_purchases cash_purchases_closed_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchases
    ADD CONSTRAINT cash_purchases_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES stock.profiles(id);


--
-- Name: cash_purchases cash_purchases_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchases
    ADD CONSTRAINT cash_purchases_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: cash_purchases cash_purchases_given_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchases
    ADD CONSTRAINT cash_purchases_given_by_fkey FOREIGN KEY (given_by) REFERENCES stock.profiles(id);


--
-- Name: cash_purchases cash_purchases_updated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchases
    ADD CONSTRAINT cash_purchases_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES stock.profiles(id);


--
-- Name: cash_purchases cash_purchases_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.cash_purchases
    ADD CONSTRAINT cash_purchases_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES stock.profiles(id);


--
-- Name: event_recipes event_recipes_coefficient_modified_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.event_recipes
    ADD CONSTRAINT event_recipes_coefficient_modified_by_fkey FOREIGN KEY (coefficient_modified_by) REFERENCES stock.profiles(id);


--
-- Name: event_recipes event_recipes_event_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.event_recipes
    ADD CONSTRAINT event_recipes_event_id_fkey FOREIGN KEY (event_id) REFERENCES stock.events(id) ON DELETE CASCADE;


--
-- Name: event_recipes event_recipes_recipe_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.event_recipes
    ADD CONSTRAINT event_recipes_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES stock.recipes(id);


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: events events_updated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.events
    ADD CONSTRAINT events_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES stock.profiles(id);


--
-- Name: families families_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.families
    ADD CONSTRAINT families_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: inventories inventories_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventories
    ADD CONSTRAINT inventories_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: inventories inventories_location_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventories
    ADD CONSTRAINT inventories_location_id_fkey FOREIGN KEY (location_id) REFERENCES stock.locations(id);


--
-- Name: inventories inventories_updated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventories
    ADD CONSTRAINT inventories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES stock.profiles(id);


--
-- Name: inventories inventories_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventories
    ADD CONSTRAINT inventories_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES stock.profiles(id);


--
-- Name: inventory_adjustment_requests inventory_adjustment_requests_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_adjustment_requests
    ADD CONSTRAINT inventory_adjustment_requests_article_id_fkey FOREIGN KEY (article_id) REFERENCES stock.articles(id);


--
-- Name: inventory_adjustment_requests inventory_adjustment_requests_inventory_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_adjustment_requests
    ADD CONSTRAINT inventory_adjustment_requests_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES stock.inventories(id) ON DELETE CASCADE;


--
-- Name: inventory_adjustment_requests inventory_adjustment_requests_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_adjustment_requests
    ADD CONSTRAINT inventory_adjustment_requests_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES stock.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_adjustment_requests inventory_adjustment_requests_location_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_adjustment_requests
    ADD CONSTRAINT inventory_adjustment_requests_location_id_fkey FOREIGN KEY (location_id) REFERENCES stock.locations(id);


--
-- Name: inventory_adjustment_requests inventory_adjustment_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_adjustment_requests
    ADD CONSTRAINT inventory_adjustment_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES stock.profiles(id);


--
-- Name: inventory_adjustment_requests inventory_adjustment_requests_stock_movement_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_adjustment_requests
    ADD CONSTRAINT inventory_adjustment_requests_stock_movement_id_fkey FOREIGN KEY (stock_movement_id) REFERENCES stock.stock_movements(id);


--
-- Name: inventory_adjustment_requests inventory_adjustment_requests_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_adjustment_requests
    ADD CONSTRAINT inventory_adjustment_requests_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES stock.units(id);


--
-- Name: inventory_adjustment_requests inventory_adjustment_requests_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_adjustment_requests
    ADD CONSTRAINT inventory_adjustment_requests_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES stock.profiles(id);


--
-- Name: inventory_items inventory_items_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_items
    ADD CONSTRAINT inventory_items_article_id_fkey FOREIGN KEY (article_id) REFERENCES stock.articles(id);


--
-- Name: inventory_items inventory_items_inventory_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_items
    ADD CONSTRAINT inventory_items_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES stock.inventories(id) ON DELETE CASCADE;


--
-- Name: inventory_items inventory_items_stock_movement_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_items
    ADD CONSTRAINT inventory_items_stock_movement_id_fkey FOREIGN KEY (stock_movement_id) REFERENCES stock.stock_movements(id);


--
-- Name: inventory_items inventory_items_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.inventory_items
    ADD CONSTRAINT inventory_items_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES stock.units(id);


--
-- Name: invoice_history invoice_history_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_history
    ADD CONSTRAINT invoice_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: invoice_history invoice_history_invoice_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_history
    ADD CONSTRAINT invoice_history_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES stock.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_items
    ADD CONSTRAINT invoice_items_article_id_fkey FOREIGN KEY (article_id) REFERENCES stock.articles(id);


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES stock.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_items
    ADD CONSTRAINT invoice_items_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES stock.units(id);


--
-- Name: invoice_payments invoice_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_payments
    ADD CONSTRAINT invoice_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: invoice_payments invoice_payments_executed_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_payments
    ADD CONSTRAINT invoice_payments_executed_by_fkey FOREIGN KEY (executed_by) REFERENCES stock.profiles(id);


--
-- Name: invoice_payments invoice_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_payments
    ADD CONSTRAINT invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES stock.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_payments invoice_payments_planned_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_payments
    ADD CONSTRAINT invoice_payments_planned_by_fkey FOREIGN KEY (planned_by) REFERENCES stock.profiles(id);


--
-- Name: invoice_payments invoice_payments_refused_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_payments
    ADD CONSTRAINT invoice_payments_refused_by_fkey FOREIGN KEY (refused_by) REFERENCES stock.profiles(id);


--
-- Name: invoice_payments invoice_payments_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoice_payments
    ADD CONSTRAINT invoice_payments_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES stock.profiles(id);


--
-- Name: invoices invoices_cash_purchase_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoices
    ADD CONSTRAINT invoices_cash_purchase_id_fkey FOREIGN KEY (cash_purchase_id) REFERENCES stock.cash_purchases(id);


--
-- Name: invoices invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoices
    ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: invoices invoices_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoices
    ADD CONSTRAINT invoices_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES stock.purchase_orders(id);


--
-- Name: invoices invoices_reception_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoices
    ADD CONSTRAINT invoices_reception_id_fkey FOREIGN KEY (reception_id) REFERENCES stock.receptions(id);


--
-- Name: invoices invoices_supplier_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoices
    ADD CONSTRAINT invoices_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES stock.suppliers(id);


--
-- Name: invoices invoices_updated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoices
    ADD CONSTRAINT invoices_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES stock.profiles(id);


--
-- Name: invoices invoices_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.invoices
    ADD CONSTRAINT invoices_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES stock.profiles(id);


--
-- Name: locations locations_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.locations
    ADD CONSTRAINT locations_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: pending_ingredients pending_ingredients_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.pending_ingredients
    ADD CONSTRAINT pending_ingredients_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: pending_ingredients pending_ingredients_recipe_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.pending_ingredients
    ADD CONSTRAINT pending_ingredients_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES stock.recipes(id) ON DELETE CASCADE;


--
-- Name: pending_ingredients pending_ingredients_resolved_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.pending_ingredients
    ADD CONSTRAINT pending_ingredients_resolved_article_id_fkey FOREIGN KEY (resolved_article_id) REFERENCES stock.articles(id);


--
-- Name: profiles profiles_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.profiles
    ADD CONSTRAINT profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.profiles
    ADD CONSTRAINT profiles_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES stock.profiles(id);


--
-- Name: purchase_groups purchase_groups_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_groups
    ADD CONSTRAINT purchase_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: purchase_groups purchase_groups_supplier_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_groups
    ADD CONSTRAINT purchase_groups_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES stock.suppliers(id);


--
-- Name: purchase_needs purchase_needs_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_needs
    ADD CONSTRAINT purchase_needs_article_id_fkey FOREIGN KEY (article_id) REFERENCES stock.articles(id);


--
-- Name: purchase_needs purchase_needs_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_needs
    ADD CONSTRAINT purchase_needs_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: purchase_needs purchase_needs_event_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_needs
    ADD CONSTRAINT purchase_needs_event_id_fkey FOREIGN KEY (event_id) REFERENCES stock.events(id) ON DELETE CASCADE;


--
-- Name: purchase_needs purchase_needs_recipe_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_needs
    ADD CONSTRAINT purchase_needs_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES stock.recipes(id);


--
-- Name: purchase_needs purchase_needs_supplier_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_needs
    ADD CONSTRAINT purchase_needs_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES stock.suppliers(id);


--
-- Name: purchase_needs purchase_needs_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_needs
    ADD CONSTRAINT purchase_needs_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES stock.units(id);


--
-- Name: purchase_needs purchase_needs_updated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_needs
    ADD CONSTRAINT purchase_needs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES stock.profiles(id);


--
-- Name: purchase_needs purchase_needs_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_needs
    ADD CONSTRAINT purchase_needs_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES stock.profiles(id);


--
-- Name: purchase_order_documents purchase_order_documents_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_documents
    ADD CONSTRAINT purchase_order_documents_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES stock.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_documents purchase_order_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_documents
    ADD CONSTRAINT purchase_order_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES stock.profiles(id);


--
-- Name: purchase_order_history purchase_order_history_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_history
    ADD CONSTRAINT purchase_order_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: purchase_order_history purchase_order_history_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_history
    ADD CONSTRAINT purchase_order_history_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES stock.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_items
    ADD CONSTRAINT purchase_order_items_article_id_fkey FOREIGN KEY (article_id) REFERENCES stock.articles(id);


--
-- Name: purchase_order_items purchase_order_items_difference_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_items
    ADD CONSTRAINT purchase_order_items_difference_validated_by_fkey FOREIGN KEY (difference_validated_by) REFERENCES stock.profiles(id);


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES stock.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_stock_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_items
    ADD CONSTRAINT purchase_order_items_stock_unit_id_fkey FOREIGN KEY (stock_unit_id) REFERENCES stock.units(id);


--
-- Name: purchase_order_items purchase_order_items_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_items
    ADD CONSTRAINT purchase_order_items_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES stock.units(id);


--
-- Name: purchase_order_needs purchase_order_needs_need_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_needs
    ADD CONSTRAINT purchase_order_needs_need_id_fkey FOREIGN KEY (need_id) REFERENCES stock.purchase_needs(id) ON DELETE CASCADE;


--
-- Name: purchase_order_needs purchase_order_needs_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_order_needs
    ADD CONSTRAINT purchase_order_needs_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES stock.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_orders
    ADD CONSTRAINT purchase_orders_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES stock.profiles(id);


--
-- Name: purchase_orders purchase_orders_closed_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_orders
    ADD CONSTRAINT purchase_orders_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES stock.profiles(id);


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: purchase_orders purchase_orders_sent_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_orders
    ADD CONSTRAINT purchase_orders_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES stock.profiles(id);


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES stock.suppliers(id);


--
-- Name: purchase_orders purchase_orders_updated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_orders
    ADD CONSTRAINT purchase_orders_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES stock.profiles(id);


--
-- Name: purchase_orders purchase_orders_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.purchase_orders
    ADD CONSTRAINT purchase_orders_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES stock.profiles(id);


--
-- Name: reception_anomalies reception_anomalies_reception_item_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_anomalies
    ADD CONSTRAINT reception_anomalies_reception_item_id_fkey FOREIGN KEY (reception_item_id) REFERENCES stock.reception_items(id) ON DELETE CASCADE;


--
-- Name: reception_anomalies reception_anomalies_resolved_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_anomalies
    ADD CONSTRAINT reception_anomalies_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES stock.profiles(id);


--
-- Name: reception_documents reception_documents_reception_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_documents
    ADD CONSTRAINT reception_documents_reception_id_fkey FOREIGN KEY (reception_id) REFERENCES stock.receptions(id) ON DELETE CASCADE;


--
-- Name: reception_documents reception_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_documents
    ADD CONSTRAINT reception_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES stock.profiles(id);


--
-- Name: reception_history reception_history_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_history
    ADD CONSTRAINT reception_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: reception_history reception_history_reception_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_history
    ADD CONSTRAINT reception_history_reception_id_fkey FOREIGN KEY (reception_id) REFERENCES stock.receptions(id) ON DELETE CASCADE;


--
-- Name: reception_items reception_items_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_items
    ADD CONSTRAINT reception_items_article_id_fkey FOREIGN KEY (article_id) REFERENCES stock.articles(id);


--
-- Name: reception_items reception_items_reception_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_items
    ADD CONSTRAINT reception_items_reception_id_fkey FOREIGN KEY (reception_id) REFERENCES stock.receptions(id) ON DELETE CASCADE;


--
-- Name: reception_items reception_items_unit_display_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_items
    ADD CONSTRAINT reception_items_unit_display_id_fkey FOREIGN KEY (unit_display_id) REFERENCES stock.units(id);


--
-- Name: reception_items reception_items_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.reception_items
    ADD CONSTRAINT reception_items_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES stock.units(id);


--
-- Name: receptions receptions_cash_purchase_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.receptions
    ADD CONSTRAINT receptions_cash_purchase_id_fkey FOREIGN KEY (cash_purchase_id) REFERENCES stock.cash_purchases(id);


--
-- Name: receptions receptions_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.receptions
    ADD CONSTRAINT receptions_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: receptions receptions_location_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.receptions
    ADD CONSTRAINT receptions_location_id_fkey FOREIGN KEY (location_id) REFERENCES stock.locations(id);


--
-- Name: receptions receptions_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.receptions
    ADD CONSTRAINT receptions_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES stock.purchase_orders(id);


--
-- Name: receptions receptions_supplier_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.receptions
    ADD CONSTRAINT receptions_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES stock.suppliers(id);


--
-- Name: receptions receptions_updated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.receptions
    ADD CONSTRAINT receptions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES stock.profiles(id);


--
-- Name: receptions receptions_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.receptions
    ADD CONSTRAINT receptions_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES stock.profiles(id);


--
-- Name: recipe_ingredients recipe_ingredients_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_article_id_fkey FOREIGN KEY (article_id) REFERENCES stock.articles(id);


--
-- Name: recipe_ingredients recipe_ingredients_recipe_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES stock.recipes(id) ON DELETE CASCADE;


--
-- Name: recipe_ingredients recipe_ingredients_unit_display_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_unit_display_fkey FOREIGN KEY (unit_display) REFERENCES stock.units(id);


--
-- Name: recipe_ingredients recipe_ingredients_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES stock.units(id);


--
-- Name: recipe_ingredients recipe_ingredients_unit_stored_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_unit_stored_fkey FOREIGN KEY (unit_stored) REFERENCES stock.units(id);


--
-- Name: recipes recipes_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.recipes
    ADD CONSTRAINT recipes_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: recipes recipes_parent_version_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.recipes
    ADD CONSTRAINT recipes_parent_version_id_fkey FOREIGN KEY (parent_version_id) REFERENCES stock.recipes(id);


--
-- Name: recipes recipes_updated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.recipes
    ADD CONSTRAINT recipes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES stock.profiles(id);


--
-- Name: recipes recipes_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.recipes
    ADD CONSTRAINT recipes_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES stock.profiles(id);


--
-- Name: sale_items sale_items_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_items
    ADD CONSTRAINT sale_items_article_id_fkey FOREIGN KEY (article_id) REFERENCES stock.articles(id);


--
-- Name: sale_items sale_items_recipe_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_items
    ADD CONSTRAINT sale_items_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES stock.recipes(id);


--
-- Name: sale_items sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_items
    ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES stock.sales(id) ON DELETE CASCADE;


--
-- Name: sale_items sale_items_unit_display_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_items
    ADD CONSTRAINT sale_items_unit_display_id_fkey FOREIGN KEY (unit_display_id) REFERENCES stock.units(id);


--
-- Name: sale_items sale_items_unit_stock_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_items
    ADD CONSTRAINT sale_items_unit_stock_id_fkey FOREIGN KEY (unit_stock_id) REFERENCES stock.units(id);


--
-- Name: sale_returns sale_returns_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_returns
    ADD CONSTRAINT sale_returns_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: sale_returns sale_returns_sale_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_returns
    ADD CONSTRAINT sale_returns_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES stock.sales(id) ON DELETE CASCADE;


--
-- Name: sale_returns sale_returns_sale_item_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_returns
    ADD CONSTRAINT sale_returns_sale_item_id_fkey FOREIGN KEY (sale_item_id) REFERENCES stock.sale_items(id) ON DELETE CASCADE;


--
-- Name: sale_returns sale_returns_stock_movement_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_returns
    ADD CONSTRAINT sale_returns_stock_movement_id_fkey FOREIGN KEY (stock_movement_id) REFERENCES stock.stock_movements(id);


--
-- Name: sale_stock_outs sale_stock_outs_sale_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_stock_outs
    ADD CONSTRAINT sale_stock_outs_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES stock.sales(id) ON DELETE CASCADE;


--
-- Name: sale_stock_outs sale_stock_outs_sale_item_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_stock_outs
    ADD CONSTRAINT sale_stock_outs_sale_item_id_fkey FOREIGN KEY (sale_item_id) REFERENCES stock.sale_items(id) ON DELETE CASCADE;


--
-- Name: sale_stock_outs sale_stock_outs_stock_out_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sale_stock_outs
    ADD CONSTRAINT sale_stock_outs_stock_out_id_fkey FOREIGN KEY (stock_out_id) REFERENCES stock.stock_outs(id) ON DELETE CASCADE;


--
-- Name: sales sales_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sales
    ADD CONSTRAINT sales_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES stock.profiles(id);


--
-- Name: sales sales_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sales
    ADD CONSTRAINT sales_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: sales sales_event_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sales
    ADD CONSTRAINT sales_event_id_fkey FOREIGN KEY (event_id) REFERENCES stock.events(id);


--
-- Name: sales sales_updated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sales
    ADD CONSTRAINT sales_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES stock.profiles(id);


--
-- Name: stock_movements stock_movements_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_movements
    ADD CONSTRAINT stock_movements_article_id_fkey FOREIGN KEY (article_id) REFERENCES stock.articles(id);


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: stock_movements stock_movements_from_location_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_movements
    ADD CONSTRAINT stock_movements_from_location_id_fkey FOREIGN KEY (from_location_id) REFERENCES stock.locations(id);


--
-- Name: stock_movements stock_movements_manual_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_movements
    ADD CONSTRAINT stock_movements_manual_validated_by_fkey FOREIGN KEY (manual_validated_by) REFERENCES stock.profiles(id);


--
-- Name: stock_movements stock_movements_reception_item_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_movements
    ADD CONSTRAINT stock_movements_reception_item_id_fkey FOREIGN KEY (reception_item_id) REFERENCES stock.reception_items(id);


--
-- Name: stock_movements stock_movements_retroactive_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_movements
    ADD CONSTRAINT stock_movements_retroactive_validated_by_fkey FOREIGN KEY (retroactive_validated_by) REFERENCES stock.profiles(id);


--
-- Name: stock_movements stock_movements_to_location_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_movements
    ADD CONSTRAINT stock_movements_to_location_id_fkey FOREIGN KEY (to_location_id) REFERENCES stock.locations(id);


--
-- Name: stock_movements stock_movements_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_movements
    ADD CONSTRAINT stock_movements_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES stock.units(id);


--
-- Name: stock_movements stock_movements_updated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_movements
    ADD CONSTRAINT stock_movements_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES stock.profiles(id);


--
-- Name: stock_outs stock_outs_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_outs
    ADD CONSTRAINT stock_outs_article_id_fkey FOREIGN KEY (article_id) REFERENCES stock.articles(id);


--
-- Name: stock_outs stock_outs_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_outs
    ADD CONSTRAINT stock_outs_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: stock_outs stock_outs_event_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_outs
    ADD CONSTRAINT stock_outs_event_id_fkey FOREIGN KEY (event_id) REFERENCES stock.events(id);


--
-- Name: stock_outs stock_outs_location_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_outs
    ADD CONSTRAINT stock_outs_location_id_fkey FOREIGN KEY (location_id) REFERENCES stock.locations(id);


--
-- Name: stock_outs stock_outs_recipe_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_outs
    ADD CONSTRAINT stock_outs_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES stock.recipes(id);


--
-- Name: stock_outs stock_outs_return_movement_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_outs
    ADD CONSTRAINT stock_outs_return_movement_id_fkey FOREIGN KEY (return_movement_id) REFERENCES stock.stock_movements(id);


--
-- Name: stock_outs stock_outs_stock_movement_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_outs
    ADD CONSTRAINT stock_outs_stock_movement_id_fkey FOREIGN KEY (stock_movement_id) REFERENCES stock.stock_movements(id);


--
-- Name: stock_outs stock_outs_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_outs
    ADD CONSTRAINT stock_outs_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES stock.units(id);


--
-- Name: stock_outs stock_outs_updated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_outs
    ADD CONSTRAINT stock_outs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES stock.profiles(id);


--
-- Name: stock_outs stock_outs_validated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_outs
    ADD CONSTRAINT stock_outs_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES stock.profiles(id);


--
-- Name: stock_pending_movements stock_pending_movements_article_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_pending_movements
    ADD CONSTRAINT stock_pending_movements_article_id_fkey FOREIGN KEY (article_id) REFERENCES stock.articles(id);


--
-- Name: stock_pending_movements stock_pending_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_pending_movements
    ADD CONSTRAINT stock_pending_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: stock_pending_movements stock_pending_movements_location_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_pending_movements
    ADD CONSTRAINT stock_pending_movements_location_id_fkey FOREIGN KEY (location_id) REFERENCES stock.locations(id);


--
-- Name: stock_pending_movements stock_pending_movements_reception_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_pending_movements
    ADD CONSTRAINT stock_pending_movements_reception_id_fkey FOREIGN KEY (reception_id) REFERENCES stock.receptions(id) ON DELETE CASCADE;


--
-- Name: stock_pending_movements stock_pending_movements_reception_item_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_pending_movements
    ADD CONSTRAINT stock_pending_movements_reception_item_id_fkey FOREIGN KEY (reception_item_id) REFERENCES stock.reception_items(id) ON DELETE CASCADE;


--
-- Name: stock_pending_movements stock_pending_movements_unit_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.stock_pending_movements
    ADD CONSTRAINT stock_pending_movements_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES stock.units(id);


--
-- Name: sub_categories sub_categories_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sub_categories
    ADD CONSTRAINT sub_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: sub_categories sub_categories_family_id_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.sub_categories
    ADD CONSTRAINT sub_categories_family_id_fkey FOREIGN KEY (family_id) REFERENCES stock.families(id) ON DELETE CASCADE;


--
-- Name: suppliers suppliers_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.suppliers
    ADD CONSTRAINT suppliers_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: suppliers suppliers_updated_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.suppliers
    ADD CONSTRAINT suppliers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES stock.profiles(id);


--
-- Name: units units_created_by_fkey; Type: FK CONSTRAINT; Schema: stock; Owner: -
--

ALTER TABLE ONLY stock.units
    ADD CONSTRAINT units_created_by_fkey FOREIGN KEY (created_by) REFERENCES stock.profiles(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: etat_mouvement Admin delete etat mouvement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin delete etat mouvement" ON public.etat_mouvement FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: type_mouvement Admin delete type mouvement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin delete type mouvement" ON public.type_mouvement FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: etat_mouvement Admin insert etat mouvement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin insert etat mouvement" ON public.etat_mouvement FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: type_mouvement Admin insert type mouvement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin insert type mouvement" ON public.type_mouvement FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: etat_mouvement Admin update etat mouvement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin update etat mouvement" ON public.etat_mouvement FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: type_mouvement Admin update type mouvement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin update type mouvement" ON public.type_mouvement FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: executant Admins et coordinateurs chambres salles peuvent creer les execu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins et coordinateurs chambres salles peuvent creer les execu" ON public.executant FOR INSERT TO authenticated WITH CHECK (public.peut_gerer_executants(auth.uid()));


--
-- Name: executant Admins et coordinateurs chambres salles peuvent modifier les ex; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins et coordinateurs chambres salles peuvent modifier les ex" ON public.executant FOR UPDATE TO authenticated USING (public.peut_gerer_executants(auth.uid())) WITH CHECK (public.peut_gerer_executants(auth.uid()));


--
-- Name: chauffe_eau_anomalie Gestion anomalies chauffe eau; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion anomalies chauffe eau" ON public.chauffe_eau_anomalie TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid())) WITH CHECK (public.peut_gerer_chauffe_eau(auth.uid()));


--
-- Name: chauffe_eau Gestion chauffe eau; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion chauffe eau" ON public.chauffe_eau TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid())) WITH CHECK (public.peut_gerer_chauffe_eau(auth.uid()));


--
-- Name: chauffe_eau_lieu Gestion chauffe eau lieu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion chauffe eau lieu" ON public.chauffe_eau_lieu TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid())) WITH CHECK (public.peut_gerer_chauffe_eau(auth.uid()));


--
-- Name: commentaire_intervention Gestion commentaires intervention; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion commentaires intervention" ON public.commentaire_intervention FOR INSERT TO authenticated WITH CHECK (public.peut_gerer_interventions_maintenance(auth.uid()));


--
-- Name: tache_periodique_historique Gestion historique tache periodique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion historique tache periodique" ON public.tache_periodique_historique FOR INSERT TO authenticated WITH CHECK (public.peut_gerer_taches_periodiques(auth.uid()));


--
-- Name: intervention_maintenance Gestion interventions maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion interventions maintenance" ON public.intervention_maintenance FOR INSERT TO authenticated WITH CHECK (public.peut_gerer_interventions_maintenance(auth.uid()));


--
-- Name: photo_intervention Gestion photos intervention; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion photos intervention" ON public.photo_intervention FOR INSERT TO authenticated WITH CHECK (public.peut_gerer_interventions_maintenance(auth.uid()));


--
-- Name: planning_chambre Gestion planning chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion planning chambre" ON public.planning_chambre FOR INSERT TO authenticated WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));


--
-- Name: tache_periodique_planning Gestion planning tache periodique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion planning tache periodique" ON public.tache_periodique_planning FOR INSERT TO authenticated WITH CHECK (public.peut_gerer_taches_periodiques(auth.uid()));


--
-- Name: chauffe_eau_releve Gestion releves chauffe eau; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion releves chauffe eau" ON public.chauffe_eau_releve TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid())) WITH CHECK (public.peut_gerer_chauffe_eau(auth.uid()));


--
-- Name: tache_chambre Gestion tache chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion tache chambre" ON public.tache_chambre FOR INSERT TO authenticated WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));


--
-- Name: tache_periodique Gestion tache periodique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion tache periodique" ON public.tache_periodique FOR INSERT TO authenticated WITH CHECK (public.peut_gerer_taches_periodiques(auth.uid()));


--
-- Name: template_planning_chambre Gestion template planning chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion template planning chambre" ON public.template_planning_chambre FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: template_planning_chambre_item Gestion template planning chambre item; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion template planning chambre item" ON public.template_planning_chambre_item FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: type_intervention_maintenance Gestion types intervention maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion types intervention maintenance" ON public.type_intervention_maintenance FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: historique_etat_mouvement Insertion historique etat mouvement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Insertion historique etat mouvement" ON public.historique_etat_mouvement FOR INSERT TO authenticated WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));


--
-- Name: historique_etat_tache_chambre Insertion historique etat tache chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Insertion historique etat tache chambre" ON public.historique_etat_tache_chambre FOR INSERT TO authenticated WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));


--
-- Name: history_events Insertion history events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Insertion history events" ON public.history_events FOR INSERT TO authenticated WITH CHECK (public.peut_gerer_chauffe_eau(auth.uid()));


--
-- Name: chauffe_eau_anomalie Lecture anomalies chauffe eau; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture anomalies chauffe eau" ON public.chauffe_eau_anomalie FOR SELECT TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid()));


--
-- Name: chauffe_eau Lecture chauffe eau; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture chauffe eau" ON public.chauffe_eau FOR SELECT TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid()));


--
-- Name: chauffe_eau_lieu Lecture chauffe eau lieu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture chauffe eau lieu" ON public.chauffe_eau_lieu FOR SELECT TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid()));


--
-- Name: commentaire_intervention Lecture commentaires intervention; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture commentaires intervention" ON public.commentaire_intervention FOR SELECT TO authenticated USING (public.peut_gerer_interventions_maintenance(auth.uid()));


--
-- Name: etat_mouvement Lecture etat mouvement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture etat mouvement" ON public.etat_mouvement FOR SELECT TO authenticated USING (true);


--
-- Name: historique_etat_mouvement Lecture historique etat mouvement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture historique etat mouvement" ON public.historique_etat_mouvement FOR SELECT TO authenticated USING (public.peut_gerer_planning_chambre(auth.uid()));


--
-- Name: historique_etat_tache_chambre Lecture historique etat tache chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture historique etat tache chambre" ON public.historique_etat_tache_chambre FOR SELECT TO authenticated USING (true);


--
-- Name: tache_periodique_historique Lecture historique tache periodique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture historique tache periodique" ON public.tache_periodique_historique FOR SELECT TO authenticated USING (public.peut_gerer_taches_periodiques(auth.uid()));


--
-- Name: history_events Lecture history events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture history events" ON public.history_events FOR SELECT TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid()));


--
-- Name: intervention_maintenance Lecture interventions maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture interventions maintenance" ON public.intervention_maintenance FOR SELECT TO authenticated USING (public.peut_gerer_interventions_maintenance(auth.uid()));


--
-- Name: photo_intervention Lecture photos intervention; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture photos intervention" ON public.photo_intervention FOR SELECT TO authenticated USING (public.peut_gerer_interventions_maintenance(auth.uid()));


--
-- Name: planning_chambre Lecture planning chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture planning chambre" ON public.planning_chambre FOR SELECT TO authenticated USING (public.peut_gerer_planning_chambre(auth.uid()));


--
-- Name: tache_periodique_planning Lecture planning tache periodique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture planning tache periodique" ON public.tache_periodique_planning FOR SELECT TO authenticated USING (public.peut_gerer_taches_periodiques(auth.uid()));


--
-- Name: chauffe_eau_releve Lecture releves chauffe eau; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture releves chauffe eau" ON public.chauffe_eau_releve FOR SELECT TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid()));


--
-- Name: tache_chambre Lecture tache chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture tache chambre" ON public.tache_chambre FOR SELECT TO authenticated USING (public.peut_gerer_planning_chambre(auth.uid()));


--
-- Name: tache_periodique Lecture tache periodique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture tache periodique" ON public.tache_periodique FOR SELECT TO authenticated USING (public.peut_gerer_taches_periodiques(auth.uid()));


--
-- Name: template_planning_chambre Lecture template planning chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture template planning chambre" ON public.template_planning_chambre FOR SELECT TO authenticated USING (public.peut_gerer_planning_chambre(auth.uid()));


--
-- Name: template_planning_chambre_item Lecture template planning chambre item; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture template planning chambre item" ON public.template_planning_chambre_item FOR SELECT TO authenticated USING (public.peut_gerer_planning_chambre(auth.uid()));


--
-- Name: type_mouvement Lecture type mouvement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture type mouvement" ON public.type_mouvement FOR SELECT TO authenticated USING (true);


--
-- Name: type_intervention_maintenance Lecture types intervention maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture types intervention maintenance" ON public.type_intervention_maintenance FOR SELECT TO authenticated USING (public.peut_gerer_interventions_maintenance(auth.uid()));


--
-- Name: utilisateurs Les admins peuvent modifier les utilisateurs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les admins peuvent modifier les utilisateurs" ON public.utilisateurs FOR UPDATE USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: utilisateurs Les admins peuvent voir tous les utilisateurs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les admins peuvent voir tous les utilisateurs" ON public.utilisateurs FOR SELECT USING (public.est_admin(auth.uid()));


--
-- Name: batiments Les utilisateurs authentifies peuvent voir les batiments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs authentifies peuvent voir les batiments" ON public.batiments FOR SELECT TO authenticated USING (true);


--
-- Name: categories_lieu Les utilisateurs authentifies peuvent voir les categories lieu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs authentifies peuvent voir les categories lieu" ON public.categories_lieu FOR SELECT TO authenticated USING (true);


--
-- Name: domaine_executant Les utilisateurs authentifies peuvent voir les domaines executa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs authentifies peuvent voir les domaines executa" ON public.domaine_executant FOR SELECT TO authenticated USING (true);


--
-- Name: executant Les utilisateurs authentifies peuvent voir les executants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs authentifies peuvent voir les executants" ON public.executant FOR SELECT TO authenticated USING (true);


--
-- Name: lieux Les utilisateurs authentifies peuvent voir les lieux; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs authentifies peuvent voir les lieux" ON public.lieux FOR SELECT TO authenticated USING (true);


--
-- Name: type_planning Les utilisateurs authentifies peuvent voir les types planning; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs authentifies peuvent voir les types planning" ON public.type_planning FOR SELECT TO authenticated USING (true);


--
-- Name: planning_executant Les utilisateurs autorises peuvent voir le planning; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs autorises peuvent voir le planning" ON public.planning_executant FOR SELECT TO authenticated USING (true);


--
-- Name: utilisateurs Les utilisateurs peuvent voir leur propre profil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs peuvent voir leur propre profil" ON public.utilisateurs FOR SELECT USING ((auth.uid() = id));


--
-- Name: intervention_maintenance Modification interventions maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification interventions maintenance" ON public.intervention_maintenance FOR UPDATE TO authenticated USING (public.peut_gerer_interventions_maintenance(auth.uid())) WITH CHECK (public.peut_gerer_interventions_maintenance(auth.uid()));


--
-- Name: photo_intervention Modification photos intervention; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification photos intervention" ON public.photo_intervention FOR UPDATE TO authenticated USING (public.peut_gerer_interventions_maintenance(auth.uid())) WITH CHECK (public.peut_gerer_interventions_maintenance(auth.uid()));


--
-- Name: planning_chambre Modification planning chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification planning chambre" ON public.planning_chambre FOR UPDATE TO authenticated USING (public.peut_gerer_planning_chambre(auth.uid())) WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));


--
-- Name: tache_periodique_planning Modification planning tache periodique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification planning tache periodique" ON public.tache_periodique_planning FOR UPDATE TO authenticated USING (public.peut_gerer_taches_periodiques(auth.uid())) WITH CHECK (public.peut_gerer_taches_periodiques(auth.uid()));


--
-- Name: tache_chambre Modification tache chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification tache chambre" ON public.tache_chambre FOR UPDATE TO authenticated USING (public.peut_gerer_planning_chambre(auth.uid())) WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));


--
-- Name: tache_periodique Modification tache periodique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification tache periodique" ON public.tache_periodique FOR UPDATE TO authenticated USING (public.peut_gerer_taches_periodiques(auth.uid())) WITH CHECK (public.peut_gerer_taches_periodiques(auth.uid()));


--
-- Name: template_planning_chambre Modification template planning chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification template planning chambre" ON public.template_planning_chambre FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: template_planning_chambre_item Modification template planning chambre item; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification template planning chambre item" ON public.template_planning_chambre_item FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: type_intervention_maintenance Modification types intervention maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification types intervention maintenance" ON public.type_intervention_maintenance FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: domaine_executant Seuls les admins peuvent creer des domaines executants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent creer des domaines executants" ON public.domaine_executant FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: planning_executant Seuls les admins peuvent creer le planning; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent creer le planning" ON public.planning_executant FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: batiments Seuls les admins peuvent creer les batiments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent creer les batiments" ON public.batiments FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: categories_lieu Seuls les admins peuvent creer les categories lieu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent creer les categories lieu" ON public.categories_lieu FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: lieux Seuls les admins peuvent creer les lieux; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent creer les lieux" ON public.lieux FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: type_planning Seuls les admins peuvent creer les types planning; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent creer les types planning" ON public.type_planning FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: planning_executant Seuls les admins peuvent modifier le planning; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent modifier le planning" ON public.planning_executant FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: batiments Seuls les admins peuvent modifier les batiments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent modifier les batiments" ON public.batiments FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: categories_lieu Seuls les admins peuvent modifier les categories lieu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent modifier les categories lieu" ON public.categories_lieu FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: domaine_executant Seuls les admins peuvent modifier les domaines executants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent modifier les domaines executants" ON public.domaine_executant FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: lieux Seuls les admins peuvent modifier les lieux; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent modifier les lieux" ON public.lieux FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: type_planning Seuls les admins peuvent modifier les types planning; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent modifier les types planning" ON public.type_planning FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));


--
-- Name: utilisateurs Seuls les admins peuvent supprimer des utilisateurs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent supprimer des utilisateurs" ON public.utilisateurs FOR DELETE USING (public.est_admin(auth.uid()));


--
-- Name: planning_executant Seuls les admins peuvent supprimer le planning; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent supprimer le planning" ON public.planning_executant FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: batiments Seuls les admins peuvent supprimer les batiments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent supprimer les batiments" ON public.batiments FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: categories_lieu Seuls les admins peuvent supprimer les categories lieu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent supprimer les categories lieu" ON public.categories_lieu FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: domaine_executant Seuls les admins peuvent supprimer les domaines executants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent supprimer les domaines executants" ON public.domaine_executant FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: executant Seuls les admins peuvent supprimer les executants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent supprimer les executants" ON public.executant FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: lieux Seuls les admins peuvent supprimer les lieux; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent supprimer les lieux" ON public.lieux FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: type_planning Seuls les admins peuvent supprimer les types planning; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seuls les admins peuvent supprimer les types planning" ON public.type_planning FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: historique_etat_mouvement Suppression historique etat mouvement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression historique etat mouvement" ON public.historique_etat_mouvement FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: historique_etat_tache_chambre Suppression historique etat tache chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression historique etat tache chambre" ON public.historique_etat_tache_chambre FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: intervention_maintenance Suppression interventions maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression interventions maintenance" ON public.intervention_maintenance FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: photo_intervention Suppression photos intervention; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression photos intervention" ON public.photo_intervention FOR DELETE TO authenticated USING (public.peut_gerer_interventions_maintenance(auth.uid()));


--
-- Name: planning_chambre Suppression planning chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression planning chambre" ON public.planning_chambre FOR DELETE TO authenticated USING (public.peut_gerer_planning_chambre(auth.uid()));


--
-- Name: tache_periodique_planning Suppression planning tache periodique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression planning tache periodique" ON public.tache_periodique_planning FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: tache_chambre Suppression tache chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression tache chambre" ON public.tache_chambre FOR DELETE TO authenticated USING (public.peut_gerer_planning_chambre(auth.uid()));


--
-- Name: tache_periodique Suppression tache periodique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression tache periodique" ON public.tache_periodique FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: template_planning_chambre Suppression template planning chambre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression template planning chambre" ON public.template_planning_chambre FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: template_planning_chambre_item Suppression template planning chambre item; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression template planning chambre item" ON public.template_planning_chambre_item FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: type_intervention_maintenance Suppression types intervention maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression types intervention maintenance" ON public.type_intervention_maintenance FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));


--
-- Name: batiments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.batiments ENABLE ROW LEVEL SECURITY;

--
-- Name: categories_lieu; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories_lieu ENABLE ROW LEVEL SECURITY;

--
-- Name: chauffe_eau; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chauffe_eau ENABLE ROW LEVEL SECURITY;

--
-- Name: chauffe_eau_anomalie; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chauffe_eau_anomalie ENABLE ROW LEVEL SECURITY;

--
-- Name: chauffe_eau_lieu; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chauffe_eau_lieu ENABLE ROW LEVEL SECURITY;

--
-- Name: chauffe_eau_releve; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chauffe_eau_releve ENABLE ROW LEVEL SECURITY;

--
-- Name: commentaire_intervention; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commentaire_intervention ENABLE ROW LEVEL SECURITY;

--
-- Name: domaine_executant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.domaine_executant ENABLE ROW LEVEL SECURITY;

--
-- Name: etat_mouvement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.etat_mouvement ENABLE ROW LEVEL SECURITY;

--
-- Name: executant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.executant ENABLE ROW LEVEL SECURITY;

--
-- Name: historique_etat_mouvement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.historique_etat_mouvement ENABLE ROW LEVEL SECURITY;

--
-- Name: historique_etat_tache_chambre; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.historique_etat_tache_chambre ENABLE ROW LEVEL SECURITY;

--
-- Name: history_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.history_events ENABLE ROW LEVEL SECURITY;

--
-- Name: intervention_maintenance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intervention_maintenance ENABLE ROW LEVEL SECURITY;

--
-- Name: lieux; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lieux ENABLE ROW LEVEL SECURITY;

--
-- Name: photo_intervention; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.photo_intervention ENABLE ROW LEVEL SECURITY;

--
-- Name: planning_chambre; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.planning_chambre ENABLE ROW LEVEL SECURITY;

--
-- Name: planning_executant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.planning_executant ENABLE ROW LEVEL SECURITY;

--
-- Name: tache_chambre; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tache_chambre ENABLE ROW LEVEL SECURITY;

--
-- Name: tache_periodique; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tache_periodique ENABLE ROW LEVEL SECURITY;

--
-- Name: tache_periodique_historique; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tache_periodique_historique ENABLE ROW LEVEL SECURITY;

--
-- Name: tache_periodique_planning; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tache_periodique_planning ENABLE ROW LEVEL SECURITY;

--
-- Name: template_planning_chambre; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_planning_chambre ENABLE ROW LEVEL SECURITY;

--
-- Name: template_planning_chambre_item; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_planning_chambre_item ENABLE ROW LEVEL SECURITY;

--
-- Name: type_intervention_maintenance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.type_intervention_maintenance ENABLE ROW LEVEL SECURITY;

--
-- Name: type_mouvement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.type_mouvement ENABLE ROW LEVEL SECURITY;

--
-- Name: type_planning; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.type_planning ENABLE ROW LEVEL SECURITY;

--
-- Name: utilisateurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.utilisateurs ENABLE ROW LEVEL SECURITY;

--
-- Name: buffet_coefficients All active users can view buffet coefficients; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All active users can view buffet coefficients" ON stock.buffet_coefficients FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: cash_purchase_differences All active users can view cash purchase differences; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All active users can view cash purchase differences" ON stock.cash_purchase_differences FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: cash_purchase_items All active users can view cash purchase items; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All active users can view cash purchase items" ON stock.cash_purchase_items FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: cash_purchase_receipts All active users can view cash purchase receipts; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All active users can view cash purchase receipts" ON stock.cash_purchase_receipts FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: cash_purchases All active users can view cash purchases; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All active users can view cash purchases" ON stock.cash_purchases FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: event_recipes All active users can view event recipes; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All active users can view event recipes" ON stock.event_recipes FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: events All active users can view events; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All active users can view events" ON stock.events FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: purchase_groups All active users can view purchase groups; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All active users can view purchase groups" ON stock.purchase_groups FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: purchase_needs All active users can view purchase needs; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All active users can view purchase needs" ON stock.purchase_needs FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: recipes All active users can view recipes; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All active users can view recipes" ON stock.recipes FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: articles All users can view articles; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All users can view articles" ON stock.articles FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: families All users can view families; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All users can view families" ON stock.families FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: inventories All users can view inventories; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All users can view inventories" ON stock.inventories FOR SELECT USING (true);


--
-- Name: invoices All users can view invoices; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All users can view invoices" ON stock.invoices FOR SELECT USING (true);


--
-- Name: locations All users can view locations; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All users can view locations" ON stock.locations FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: stock_movements All users can view movements; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All users can view movements" ON stock.stock_movements FOR SELECT USING (true);


--
-- Name: purchase_orders All users can view orders; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All users can view orders" ON stock.purchase_orders FOR SELECT USING (true);


--
-- Name: receptions All users can view receptions; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All users can view receptions" ON stock.receptions FOR SELECT USING (true);


--
-- Name: sales All users can view sales; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All users can view sales" ON stock.sales FOR SELECT USING (true);


--
-- Name: stock_outs All users can view stock outs; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All users can view stock outs" ON stock.stock_outs FOR SELECT USING (true);


--
-- Name: sub_categories All users can view sub categories; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All users can view sub categories" ON stock.sub_categories FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: units All users can view units; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "All users can view units" ON stock.units FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: suppliers Allowed users can view suppliers; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Allowed users can view suppliers" ON stock.suppliers FOR SELECT USING (stock.can_current_user_view_suppliers());


--
-- Name: purchase_orders Buyers can manage orders; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Buyers can manage orders" ON stock.purchase_orders USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'acheteur'::stock.user_role) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: purchase_needs Buyers can manage purchase needs; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Buyers can manage purchase needs" ON stock.purchase_needs USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'acheteur'::stock.user_role) AND (profiles.status = 'active'::stock.user_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'acheteur'::stock.user_role) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: cash_purchase_differences Cash purchase managers can manage differences; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Cash purchase managers can manage differences" ON stock.cash_purchase_differences USING ((EXISTS ( SELECT 1
   FROM (stock.cash_purchases purchase
     JOIN stock.profiles current_profile ON ((current_profile.user_id = auth.uid())))
  WHERE ((purchase.id = cash_purchase_differences.cash_purchase_id) AND (current_profile.status = 'active'::stock.user_status) AND (current_profile.role = ANY (ARRAY['direction'::stock.user_role, 'acheteur'::stock.user_role]))))));


--
-- Name: cash_purchase_items Cash purchase managers can manage items; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Cash purchase managers can manage items" ON stock.cash_purchase_items USING ((EXISTS ( SELECT 1
   FROM (stock.cash_purchases purchase
     JOIN stock.profiles current_profile ON ((current_profile.user_id = auth.uid())))
  WHERE ((purchase.id = cash_purchase_items.cash_purchase_id) AND (current_profile.status = 'active'::stock.user_status) AND ((current_profile.role = ANY (ARRAY['direction'::stock.user_role, 'acheteur'::stock.user_role, 'caisse'::stock.user_role])) OR (current_profile.id = purchase.created_by) OR (current_profile.id = purchase.buyer_id))))));


--
-- Name: cash_purchase_receipts Cash purchase managers can manage receipts; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Cash purchase managers can manage receipts" ON stock.cash_purchase_receipts USING ((EXISTS ( SELECT 1
   FROM (stock.cash_purchases purchase
     JOIN stock.profiles current_profile ON ((current_profile.user_id = auth.uid())))
  WHERE ((purchase.id = cash_purchase_receipts.cash_purchase_id) AND (current_profile.status = 'active'::stock.user_status) AND (current_profile.role = ANY (ARRAY['direction'::stock.user_role, 'acheteur'::stock.user_role]))))));


--
-- Name: cash_purchases Cash staff can manage cash purchases; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Cash staff can manage cash purchases" ON stock.cash_purchases USING ((EXISTS ( SELECT 1
   FROM stock.profiles current_profile
  WHERE ((current_profile.user_id = auth.uid()) AND (current_profile.status = 'active'::stock.user_status) AND ((current_profile.role = 'acheteur'::stock.user_role) OR ((current_profile.role = 'caisse'::stock.user_role) AND (cash_purchases.status = 'valide'::stock.cash_purchase_status))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles current_profile
  WHERE ((current_profile.user_id = auth.uid()) AND (current_profile.status = 'active'::stock.user_status) AND ((current_profile.role = 'acheteur'::stock.user_role) OR ((current_profile.role = 'caisse'::stock.user_role) AND (cash_purchases.status = ANY (ARRAY['valide'::stock.cash_purchase_status, 'especes_remises'::stock.cash_purchase_status]))))))));


--
-- Name: cash_purchases Cashiers can give cash on validated purchases; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Cashiers can give cash on validated purchases" ON stock.cash_purchases FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM stock.profiles current_profile
  WHERE ((current_profile.user_id = auth.uid()) AND (current_profile.role = 'caisse'::stock.user_role) AND (current_profile.status = 'active'::stock.user_status)))) AND (status = 'valide'::stock.cash_purchase_status))) WITH CHECK (((EXISTS ( SELECT 1
   FROM stock.profiles current_profile
  WHERE ((current_profile.user_id = auth.uid()) AND (current_profile.role = 'caisse'::stock.user_role) AND (current_profile.status = 'active'::stock.user_status)))) AND (status = 'especes_remises'::stock.cash_purchase_status)));


--
-- Name: article_locations Catalog managers can manage article locations; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Catalog managers can manage article locations" ON stock.article_locations USING (stock.can_current_user_manage_catalog()) WITH CHECK (stock.can_current_user_manage_catalog());


--
-- Name: articles Catalog managers can manage articles; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Catalog managers can manage articles" ON stock.articles USING (stock.can_current_user_manage_catalog()) WITH CHECK (stock.can_current_user_manage_catalog());


--
-- Name: buffet_coefficients Chef and direction can manage buffet coefficients; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Chef and direction can manage buffet coefficients" ON stock.buffet_coefficients USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'chef_cuisine'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'chef_cuisine'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: invoices Directors and Accounting can manage invoices; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors and Accounting can manage invoices" ON stock.invoices USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'comptabilite'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: stock_outs Directors and Chef can manage stock outs; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors and Chef can manage stock outs" ON stock.stock_outs USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'chef_cuisine'::stock.user_role, 'magasinier'::stock.user_role, 'point_vente'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'chef_cuisine'::stock.user_role, 'magasinier'::stock.user_role, 'point_vente'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: receptions Directors and magasinier can manage receptions; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors and magasinier can manage receptions" ON stock.receptions USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'magasinier'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: cash_purchases Directors can manage all cash purchases; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can manage all cash purchases" ON stock.cash_purchases USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'direction'::stock.user_role) AND (profiles.status = 'active'::stock.user_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'direction'::stock.user_role) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: inventories Directors can manage all inventories; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can manage all inventories" ON stock.inventories USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'direction'::stock.user_role) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: stock_movements Directors can manage all movements; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can manage all movements" ON stock.stock_movements USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'direction'::stock.user_role) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: purchase_orders Directors can manage all orders; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can manage all orders" ON stock.purchase_orders USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'direction'::stock.user_role) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: purchase_needs Directors can manage all purchase needs; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can manage all purchase needs" ON stock.purchase_needs USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'direction'::stock.user_role) AND (profiles.status = 'active'::stock.user_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'direction'::stock.user_role) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: sales Directors can manage all sales; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can manage all sales" ON stock.sales USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'direction'::stock.user_role) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: families Directors can manage families; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can manage families" ON stock.families USING (stock.is_current_user_direction()) WITH CHECK (stock.is_current_user_direction());


--
-- Name: inventory_adjustment_requests Directors can manage inventory adjustment requests; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can manage inventory adjustment requests" ON stock.inventory_adjustment_requests USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'direction'::stock.user_role) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: locations Directors can manage locations; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can manage locations" ON stock.locations USING (stock.is_current_user_direction()) WITH CHECK (stock.is_current_user_direction());


--
-- Name: sale_returns Directors can manage sale returns; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can manage sale returns" ON stock.sale_returns USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'direction'::stock.user_role) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: sub_categories Directors can manage sub categories; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can manage sub categories" ON stock.sub_categories USING (stock.is_current_user_direction()) WITH CHECK (stock.is_current_user_direction());


--
-- Name: units Directors can manage units; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can manage units" ON stock.units USING (stock.is_current_user_direction()) WITH CHECK (stock.is_current_user_direction());


--
-- Name: profiles Directors can update all profiles; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can update all profiles" ON stock.profiles FOR UPDATE USING (stock.is_current_user_direction()) WITH CHECK (stock.is_current_user_direction());


--
-- Name: profiles Directors can view all profiles; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Directors can view all profiles" ON stock.profiles FOR SELECT USING (stock.is_current_user_direction());


--
-- Name: event_recipes Event managers can manage event recipes; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Event managers can manage event recipes" ON stock.event_recipes USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'chef_cuisine'::stock.user_role, 'fiche_technique'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'chef_cuisine'::stock.user_role, 'fiche_technique'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: events Event managers can manage events; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Event managers can manage events" ON stock.events USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'chef_cuisine'::stock.user_role, 'fiche_technique'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'chef_cuisine'::stock.user_role, 'fiche_technique'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: inventories Magasinier can manage inventories; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Magasinier can manage inventories" ON stock.inventories USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'magasinier'::stock.user_role) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: purchase_needs Operational staff can manage own purchase needs; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Operational staff can manage own purchase needs" ON stock.purchase_needs USING ((EXISTS ( SELECT 1
   FROM stock.profiles current_profile
  WHERE ((current_profile.user_id = auth.uid()) AND (current_profile.role = ANY (ARRAY['chef_cuisine'::stock.user_role, 'fiche_technique'::stock.user_role, 'maintenance'::stock.user_role, 'magasinier'::stock.user_role])) AND (current_profile.status = 'active'::stock.user_status) AND (current_profile.id = purchase_needs.created_by))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles current_profile
  WHERE ((current_profile.user_id = auth.uid()) AND (current_profile.role = ANY (ARRAY['chef_cuisine'::stock.user_role, 'fiche_technique'::stock.user_role, 'maintenance'::stock.user_role, 'magasinier'::stock.user_role])) AND (current_profile.status = 'active'::stock.user_status) AND (current_profile.id = purchase_needs.created_by)))));


--
-- Name: purchase_groups Purchase group managers can manage groups; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Purchase group managers can manage groups" ON stock.purchase_groups USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'acheteur'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'acheteur'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: pending_ingredients Recipe managers can manage pending ingredients; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Recipe managers can manage pending ingredients" ON stock.pending_ingredients USING (stock.can_current_user_manage_recipes()) WITH CHECK (stock.can_current_user_manage_recipes());


--
-- Name: recipe_ingredients Recipe managers can manage recipe ingredients; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Recipe managers can manage recipe ingredients" ON stock.recipe_ingredients USING (stock.can_current_user_manage_recipes()) WITH CHECK (stock.can_current_user_manage_recipes());


--
-- Name: recipes Recipe managers can manage recipes; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Recipe managers can manage recipes" ON stock.recipes USING (stock.can_current_user_manage_recipes()) WITH CHECK (stock.can_current_user_manage_recipes());


--
-- Name: sales Sales staff can manage sales; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Sales staff can manage sales" ON stock.sales USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['point_vente'::stock.user_role, 'chef_cuisine'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: inventory_adjustment_requests Staff can create inventory adjustment requests; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can create inventory adjustment requests" ON stock.inventory_adjustment_requests FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'magasinier'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: invoice_history Staff can insert invoice history; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can insert invoice history" ON stock.invoice_history FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'comptabilite'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: purchase_order_history Staff can insert order history; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can insert order history" ON stock.purchase_order_history FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'acheteur'::stock.user_role, 'magasinier'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: reception_history Staff can insert reception history; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can insert reception history" ON stock.reception_history FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'magasinier'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: reception_anomalies Staff can manage anomalies; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can manage anomalies" ON stock.reception_anomalies USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'magasinier'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: inventory_items Staff can manage inventory items; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can manage inventory items" ON stock.inventory_items USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'magasinier'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: invoice_items Staff can manage invoice items; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can manage invoice items" ON stock.invoice_items USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'comptabilite'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: stock_movements Staff can manage movements; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can manage movements" ON stock.stock_movements USING (((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['magasinier'::stock.user_role, 'chef_cuisine'::stock.user_role, 'point_vente'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))) AND (status <> 'annule'::stock.movement_status))) WITH CHECK (((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['magasinier'::stock.user_role, 'chef_cuisine'::stock.user_role, 'point_vente'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))) AND (status <> 'annule'::stock.movement_status)));


--
-- Name: purchase_order_documents Staff can manage order documents; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can manage order documents" ON stock.purchase_order_documents USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'acheteur'::stock.user_role, 'magasinier'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: purchase_order_items Staff can manage order items; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can manage order items" ON stock.purchase_order_items USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'acheteur'::stock.user_role, 'magasinier'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: purchase_order_needs Staff can manage order-need links; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can manage order-need links" ON stock.purchase_order_needs USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'acheteur'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: invoice_payments Staff can manage payments; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can manage payments" ON stock.invoice_payments USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'comptabilite'::stock.user_role, 'caisse'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: stock_pending_movements Staff can manage pending stock movements; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can manage pending stock movements" ON stock.stock_pending_movements USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'magasinier'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: reception_documents Staff can manage reception documents; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can manage reception documents" ON stock.reception_documents USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'magasinier'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: reception_items Staff can manage reception items; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can manage reception items" ON stock.reception_items USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'magasinier'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: sale_items Staff can manage sale items; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can manage sale items" ON stock.sale_items USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'point_vente'::stock.user_role, 'chef_cuisine'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: sale_stock_outs Staff can manage sale stock outs; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Staff can manage sale stock outs" ON stock.sale_stock_outs USING ((EXISTS ( SELECT 1
   FROM stock.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::stock.user_role, 'point_vente'::stock.user_role, 'chef_cuisine'::stock.user_role])) AND (profiles.status = 'active'::stock.user_status)))));


--
-- Name: suppliers Supplier managers can manage suppliers; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Supplier managers can manage suppliers" ON stock.suppliers USING (stock.can_current_user_manage_suppliers()) WITH CHECK (stock.can_current_user_manage_suppliers());


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can update own profile" ON stock.profiles FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: reception_anomalies Users can view anomalies; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view anomalies" ON stock.reception_anomalies FOR SELECT USING (true);


--
-- Name: article_locations Users can view article locations; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view article locations" ON stock.article_locations FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: inventory_adjustment_requests Users can view inventory adjustment requests; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view inventory adjustment requests" ON stock.inventory_adjustment_requests FOR SELECT USING (true);


--
-- Name: inventory_items Users can view inventory items; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view inventory items" ON stock.inventory_items FOR SELECT USING (true);


--
-- Name: invoice_history Users can view invoice history; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view invoice history" ON stock.invoice_history FOR SELECT USING (true);


--
-- Name: invoice_items Users can view invoice items; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view invoice items" ON stock.invoice_items FOR SELECT USING (true);


--
-- Name: purchase_order_documents Users can view order documents; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view order documents" ON stock.purchase_order_documents FOR SELECT USING (true);


--
-- Name: purchase_order_history Users can view order history; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view order history" ON stock.purchase_order_history FOR SELECT USING (true);


--
-- Name: purchase_order_items Users can view order items; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view order items" ON stock.purchase_order_items FOR SELECT USING (true);


--
-- Name: purchase_order_needs Users can view order-need links; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view order-need links" ON stock.purchase_order_needs FOR SELECT USING (true);


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view own profile" ON stock.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: invoice_payments Users can view payments; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view payments" ON stock.invoice_payments FOR SELECT USING (true);


--
-- Name: pending_ingredients Users can view pending ingredients; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view pending ingredients" ON stock.pending_ingredients FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: stock_pending_movements Users can view pending stock movements; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view pending stock movements" ON stock.stock_pending_movements FOR SELECT USING (true);


--
-- Name: reception_documents Users can view reception documents; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view reception documents" ON stock.reception_documents FOR SELECT USING (true);


--
-- Name: reception_history Users can view reception history; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view reception history" ON stock.reception_history FOR SELECT USING (true);


--
-- Name: reception_items Users can view reception items; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view reception items" ON stock.reception_items FOR SELECT USING (true);


--
-- Name: recipe_ingredients Users can view recipe ingredients; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view recipe ingredients" ON stock.recipe_ingredients FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: sale_items Users can view sale items; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view sale items" ON stock.sale_items FOR SELECT USING (true);


--
-- Name: sale_returns Users can view sale returns; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view sale returns" ON stock.sale_returns FOR SELECT USING (true);


--
-- Name: sale_stock_outs Users can view sale stock outs; Type: POLICY; Schema: stock; Owner: -
--

CREATE POLICY "Users can view sale stock outs" ON stock.sale_stock_outs FOR SELECT USING (true);


--
-- Name: article_locations; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.article_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: articles; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.articles ENABLE ROW LEVEL SECURITY;

--
-- Name: buffet_coefficients; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.buffet_coefficients ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_purchase_differences; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.cash_purchase_differences ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_purchase_items; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.cash_purchase_items ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_purchase_receipts; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.cash_purchase_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_purchases; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.cash_purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: event_recipes; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.event_recipes ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.events ENABLE ROW LEVEL SECURITY;

--
-- Name: families; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.families ENABLE ROW LEVEL SECURITY;

--
-- Name: inventories; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.inventories ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_adjustment_requests; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.inventory_adjustment_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_history; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.invoice_history ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_items; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.invoice_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_payments; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.invoice_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: locations; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.locations ENABLE ROW LEVEL SECURITY;

--
-- Name: pending_ingredients; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.pending_ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_groups; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.purchase_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_needs; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.purchase_needs ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_documents; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.purchase_order_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_history; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.purchase_order_history ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_items; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.purchase_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_needs; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.purchase_order_needs ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: reception_anomalies; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.reception_anomalies ENABLE ROW LEVEL SECURITY;

--
-- Name: reception_documents; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.reception_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: reception_history; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.reception_history ENABLE ROW LEVEL SECURITY;

--
-- Name: reception_items; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.reception_items ENABLE ROW LEVEL SECURITY;

--
-- Name: receptions; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.receptions ENABLE ROW LEVEL SECURITY;

--
-- Name: recipe_ingredients; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.recipe_ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: recipes; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.recipes ENABLE ROW LEVEL SECURITY;

--
-- Name: sale_items; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.sale_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sale_returns; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.sale_returns ENABLE ROW LEVEL SECURITY;

--
-- Name: sale_stock_outs; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.sale_stock_outs ENABLE ROW LEVEL SECURITY;

--
-- Name: sales; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.sales ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_outs; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.stock_outs ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_pending_movements; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.stock_pending_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: sub_categories; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.sub_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: units; Type: ROW SECURITY; Schema: stock; Owner: -
--

ALTER TABLE stock.units ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 4XZ4xjsBEMAwLhjo1xTARYajUhgN4Hp99wj2O0aRazEMdt96IkZwh3fPe9CkiLI

