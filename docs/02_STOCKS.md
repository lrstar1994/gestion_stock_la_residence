# Module Stocks / Inventaires

## Objets propriétaires

Le module Stocks possède le référentiel articles/unités/localisations, les mouvements et les inventaires : `stock.articles`, `stock.units`, `stock.locations`, `stock.article_locations`, `stock.stock_movements`, vues de stock, `stock.inventories` et leurs lignes.

Les réceptions et transferts consomment ces objets, mais ne doivent pas créer une seconde source de vérité pour le stock. Le stock courant est dérivé des mouvements validés.

## Localisations et accès

Direction conserve une lecture globale. Contrôleur conserve la lecture globale prévue par son rôle. Les autres profils opérationnels sont restreints par `profile_location_access` lorsqu’une affectation est requise. `EN TRANSIT` est une localisation technique pour le suivi des transferts, exclue des sélecteurs opérationnels ordinaires.

La règle article cible est : un article stockable et actif est disponible dans toutes les localisations actives par défaut ; une restriction explicite est nécessaire pour limiter cette disponibilité. Une autorisation ne crée aucune quantité.

## Inventaires

Chaîne cible : Brouillon → Soumis → Validation Direction → Corrections générées → Contrôle final → Clôturé. Les corrections générées à la validation sont des mouvements historiques ; la clôture ne doit pas en recréer. Après clôture, le dossier est consultable et verrouillé.

## Mouvements et transferts

Les mouvements portent article, unité, quantité signée par le type, origine/destination, date, référence source, statut et utilisateur. Les transferts groupés s’appuient sur un dossier et des lignes ; préparation, remise et réception passent par des RPC sécurisées. Quantités jusqu’à trois décimales sont prévues. Pour les achats espèces, plusieurs présentations physiques d’un même achat restent possibles ; l’idempotence porte sur `receptions.handover_id`, identifiant de la passation Contrôleur → Magasinier, et non sur `cash_purchase_id` seul. Les contraintes de quantité séparent le contrôle, le physique reçu et l’entrée stock, tout en conservant les NULL historiques.

Pendant un transfert normal, la quantité quitte l’origine et entre techniquement en transit, puis arrive à destination ; le total établissement reste constant. Une perte définitivement confirmée est un cas distinct qui peut diminuer le total physique, avec double confirmation PIN et audit.

### Réservations OP et révisions à la baisse

**VALIDÉ MÉTIER** : lors d’une révision OP à la baisse, le Chef peut libérer immédiatement les réservations excédentaires de produits finis et sous-recettes après confirmation et vérification des nouvelles quantités ; la validation Direction de la révision n’est pas un préalable à cette libération. La libération ne peut jamais toucher les quantités déjà sorties ou consommées, doit être atomique et historiser l’ancienne quantité, la nouvelle quantité, l’OP, la révision, le Chef et l’horodatage.

RES-1 et RES-2 fournissent désormais sur TEST les structures de réservation, le verrouillage article/localisation et les RPC article-only. Aucun raccordement OP n’est toutefois actif : INT-1 reste séparé, non déployé, et aucune réservation de recette n’est supportée. Les décisions OP décrites ici ne sont donc pas encore activables par les parcours applicatifs.

**VALIDÉ MÉTIER — révision OP à la hausse** : les réservations déjà approuvées sont conservées. Le Chef peut réserver immédiatement la quantité supplémentaire réellement libre ; si elle est insuffisante, seule la quantité disponible est réservée et le manque prévisionnel est affiché séparément. La production déjà approuvée continue seule. Aucune fabrication supplémentaire ni nouveau besoin d’achat ne peut être déclenché avant validation Direction de la révision ; après cette validation, les besoins passent par `purchase_needs` et ses décisions indépendantes.

Un OP ne peut avoir qu’une seule proposition de révision active en attente. Une nouvelle modification actualise cette proposition active ; les propositions précédentes restent historisées mais ne sont jamais additionnées. Les besoins sont recalculés par rapport à la dernière révision approuvée, en tenant compte des réservations existantes et des mouvements physiques.

RES-2 verrouille la disponibilité article au moment de la réservation, accepte les réservations partielles et déduplique les opérations par `request_id`. En cas de refus Direction, aucune libération automatique ni expiration liée à l’âge du brouillon n’est déclenchée : les réservations de la dernière révision approuvée restent intactes ; le Chef décide ensuite de libérer ou de maintenir temporairement les réservations supplémentaires, avec revue quotidienne et audit de cette décision.

### Contrat STOCK-RES V1 — installé et validé sur TEST

Le contrat consolidé distingue la réservation principale, ses segments de localisation, les allocations de contributions, les mouvements physiques et les snapshots. Les structures RES-1 et les RPC article-only RES-2 sont installées et validées sur TEST. Le raccordement OP, VENTES et transferts reste absent ; INT-1 demeure un chantier séparé.

Les quantités courantes sont séparées des cumuls historiques :

```text
shortage_quantity = max(0, target_quantity - reserved_quantity - delivered_quantity)
excess_quantity = max(0, reserved_quantity + delivered_quantity - target_quantity)
```

`delivered_quantity` désigne uniquement la quantité nette effectivement délivrée à la production. Les transferts intermédiaires, `released_quantity_total` et `transferred_quantity_total` ne sont jamais soustraits une seconde fois. Une réduction peut donc laisser un excédent temporaire ; seule la quantité encore réellement réservée peut être libérée explicitement par le Chef.

Une réservation principale conserve son identité entre localisations. Ses segments portent les quantités par magasin ou en transit et leur somme représente la quantité actuellement protégée. Les allocations de contributions distinguent le programme approuvé, la proposition active et les suppléments maintenus après refus. Une nouvelle révision fournit une nouvelle cible ; elle n'est jamais additionnée aux calculs précédents.

L'idempotence repose sur une table centrale contenant `request_id`, opération, hash des paramètres et résultat. Le journal historique peut contenir plusieurs événements pour une même opération ; `request_id` n'y est donc pas une clé unique. `change_sequence` protège les changements de cible FT-OP, mais les transferts, libérations, maintiens et consommations n'imposent pas une nouvelle séquence FT-OP ni une unicité globale `(reservation_id, change_sequence)`.

Le verrou commun par article et localisation doit être partagé par réservations, Ventes, transferts, sorties et retours. La vérification de couverture et l'écriture associée doivent être atomiques. Les snapshots consultatifs restent immuables et distincts des vérifications transactionnelles utilisées pour préparer les besoins `purchase_needs`.

Les quantités communes restent en `numeric(14,4)`, les coefficients en `numeric(14,6)`, sans arrondi intermédiaire. Les contrôles de transfert limités à trois décimales devront faire l'objet d'une adaptation additive avant activation du contrat.

**État :** RES-1 et RES-2 sont installés et validés sur TEST `mcvchrqgubccgddcalpk`. RES-1 reste intact. RES-2 (`202610010001_stock_reservation_operations.sql`) est **DÉPLOYÉ TEST / HISTORIQUE SYNCHRONISÉ / VALIDÉ TEST / CLÔTURÉ** : 234 contrôles obligatoires PASS, 1 INFO PASS, 0 FAIL, ROLLBACK confirmé et code 0. `202610010001` : exactement 1 occurrence, historique synchronisé. Aucune réparation supplémentaire nécessaire. OP-1 et Storage restent intacts. Aucune activation OP, VENTES ou transferts n’est présente ; INT-1 n’est pas déployé.

Cette validation clôt le socle technique RES-2, sans mise en service des parcours intermodules. L’activation reste soumise au raccordement séparé d’OP, de Ventes, des transferts et des autres sorties physiques au verrou commun.

## Corrections

La page Corrections de stock liste les mouvements existants, y compris ceux issus d’inventaires, avec origine, motif, utilisateur, validation et dossier source. Le Magasinier constate ou demande ; la Direction valide avant mouvement effectif selon les droits actuels.

## États

Les dépendances Stocks consommées par le Lot A FT sont **VALIDÉES TEST** : `articles.locations_restricted`, `article_locations`, `units`, les colonnes de conversion de `recipe_ingredients` (`quantity_display`, `unit_display`, `quantity_stored`, `unit_stored`, `conversion_factor`) et leurs FK attendues. Le runtime de conversion sur une recette réelle reste à valider lorsqu’une ligne `recipe_ingredients` de test existera ; cette réserve ne bloque pas le Lot A.

- Restrictions par localisation : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST déclaré ; VALIDÉ TEST à recontrôler après application manuelle.
- Inventaire et clôture : VALIDÉ MÉTIER ; CODÉ LOCALEMENT selon migrations 170001 ; état TEST dépendant de l’historique manuel.
- Transferts groupés/brouillons : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST déclaré pour 180002/180004 ; VALIDÉ TEST à confirmer par scénarios complets.
- Articles toutes localisations : VALIDÉ MÉTIER ; CODÉ LOCALEMENT dans 180001 ; migration isolée localement, statut de déploiement à vérifier.

=== SYNCHRO CODEX ===
Module principal: Stocks / Inventaires
Décisions validées: stock dérivé des mouvements, accès par localisation, transit technique, contrôle Direction
Impacts sur les autres modules: achats/réceptions, recettes/OP, consommation et coûts
Objets partagés concernés: articles, unités, localisations, stock_movements, receptions, purchase_needs
État d’implémentation: mixte, voir les états ci-dessus
Documents à mettre à jour: 00_MASTER_APP, 04_LIAISONS_ENTRE_MODULES, 05_DECISIONS_VALIDEES
Points ouverts: alignement définitif des migrations hold, validation runtime des RPC transferts, modèle OP

## RES-2 — déployé, synchronisé et validé sur TEST

**DÉPLOYÉ TEST — HISTORIQUE SYNCHRONISÉ — VALIDÉ TEST — CLÔTURÉ.** La migration additive reste conservée dans
`supabase/migrations_hold/202610010001_stock_reservation_operations.sql`.
Elle ajoute uniquement `stock_reservations.last_target_change_sequence bigint NOT NULL DEFAULT 0`
au schéma RES-1, onze helpers privés et quatre RPC. Aucune contrainte RES-1 n'est
modifiée. La validation finale compte 234 contrôles obligatoires PASS, 1 INFO PASS,
0 FAIL, ROLLBACK confirmé et code 0. `202610010001` : exactement 1 occurrence, historique synchronisé.
Aucune réparation supplémentaire nécessaire. Les indications antérieures
« RES-2 prochain lot » ou « non déployé » décrivent l’état avant cette clôture.

### Signatures publiques (retour JSONB)

```sql
stock.reserve_resource(
  p_request_id uuid, p_resource_type text, p_resource_id uuid,
  p_target_quantity numeric(14,4), p_location_id uuid, p_change_sequence bigint,
  p_op_id uuid DEFAULT NULL, p_revision_id uuid DEFAULT NULL
) RETURNS jsonb

stock.change_reservation_target(
  p_request_id uuid, p_reservation_id uuid, p_target_quantity numeric(14,4),
  p_change_sequence bigint, p_location_id uuid DEFAULT NULL
) RETURNS jsonb

stock.release_reservation(
  p_request_id uuid, p_reservation_id uuid, p_release_quantity numeric(14,4),
  p_segment_id uuid DEFAULT NULL
) RETURNS jsonb

stock.get_reservation_state(p_reservation_id uuid) RETURNS jsonb
```

PostgreSQL conserve `numeric` dans les signatures de catalogue, sans appliquer
le typmod des arguments. RES-2 contrôle donc explicitement la finitude, la plage
numeric(14,4) et les quatre décimales : aucun arrondi silencieux d'une entrée.

### Sécurité et rôles

| Rôle actif | Réserver / changer la cible / libérer | Lire l'état |
|---|---|---|
| direction | Oui | Oui |
| chef_cuisine | Oui, localisations accessibles | Oui, localisations accessibles |
| magasinier | Non | Oui, localisations accessibles |
| acheteur | Non | Oui, localisations accessibles |
| controleur | Non | Oui, selon le mécanisme existant de lecture |
| point_vente, fiche_technique, autres | Non | Non |

Acteur dérivé exclusivement de `auth.uid()` et du profil actif dans `stock.profiles`.
Les RPC sont SECURITY DEFINER, propriétaire postgres existant avec BYPASSRLS,
`search_path=pg_catalog,stock,auth`. Elles contrôlent elles-mêmes rôle et accès ;
aucun identifiant d'acteur client n'est accepté. Seul authenticated reçoit EXECUTE,
PUBLIC et anon sont révoqués. Les helpers SECURITY INVOKER n'ont aucun EXECUTE
PUBLIC/anon/authenticated. RLS/FORCE RLS, absence de policy et absence d'accès direct
aux six tables RES-1 sont préservées. La migration exige le propriétaire existant
postgres et son BYPASSRLS ; elle ne crée ni ne modifie aucun rôle.

L'accès réutilise `stock.can_access_stock_location(uuid,boolean)` ; l'admissibilité
article réutilise `stock.article_location_allowed(uuid,uuid)`, complétée par les
contrôles article actif/stockable et localisation active pour créer/augmenter.
Pour une réservation multi-localisation, lire son état détaillé ou la modifier
exige l'accès à toutes les localisations de ses segments, historiques compris :
aucun total ou segment d'une localisation interdite n'est renvoyé. Les rejeux
revérifient le profil, le rôle et les accès aux localisations du résultat enregistré.

### Quantités et localisation

Seul `resource_type='article'` est supporté. `recipe` et toute autre valeur sont
refusés par `RESERVATION_RESOURCE_TYPE_UNSUPPORTED`. Aucun stock recipe estimé.
Les références OP/révision sont conservées comme UUID opaques RES-1 : aucune FK,
validation OP, réservation contributionnelle ou action automatique FT-OP ajoutée.

La disponibilité se calcule après verrou métier depuis `stock.stock_location_view`,
moins les protections des segments **active/in_transit** des autres réservations.
Les segments released/delivered/cancelled et les allocations analytiques n'enlèvent
rien. Une unité physique différente de l'unité de réservation est refusée, sans
conversion inventée. Les cumuls released/transferred et le delivered déjà reflété
dans la vue physique ne sont jamais soustraits une seconde fois.

À la création, la quantité réservée est plafonnée au disponible non négatif. La
cible demandée est conservée, y compris si rien n'est disponible. Un segment
**active de quantité zéro** conserve alors la localisation de création ; il ne
protège aucune quantité. RES-1 reste multi-localisation.

Une hausse exige `p_location_id` explicite, actif, autorisé et compatible avec
l'article. Le supplément n'est recherché que dans cette localisation. Il est
plafonné à la hausse de cible, au manque restant après les quantités réservées et
délivrées, et au stock libre local. Les propres protections locales, exclues de la
sommes des autres réservations, sont ensuite déduites une seule fois pour obtenir
la capacité supplémentaire. Une hausse couverte crée un nouveau segment actif ;
une hausse sans disponibilité conserve le manque sans créer de segment fictif.

Une baisse modifie uniquement la cible, la séquence et les métadonnées d'audit ;
elle ne libère aucun segment, même en multi-localisation. L'excédent reste visible.
Une cible inchangée est refusée (`RESERVATION_TARGET_UNCHANGED`) : aucune fonction
de réapprovisionnement du shortage n'est introduite. Si une localisation optionnelle
est fournie pour une baisse, elle reste validée et incluse dans le payload/verrouillage.

La libération exige une quantité strictement positive et ne touche qu'un segment
active/in_transit réellement protégé. Plusieurs segments libérables sans segment_id
donnent `RESERVATION_SEGMENT_REQUIRED` ; aucune sélection FIFO/LIFO. Le segment
entièrement libéré passe à released avec quantité zéro ; une libération partielle
conserve son statut. Le cumul released augmente, la séquence ne change pas. La
réservation principale reste active/suspended : aucune fermeture automatique d'une
cible encore existante ; les états released/completed/cancelled ne sont pas mutables.

Les formules générées RES-1 restent inchangées :
`shortage=max(0,target-reserved-delivered)` et `excess=max(0,reserved+delivered-target)`.

### Idempotence et concurrence

Chaque écriture commence par vérifier request_id puis prend un advisory lock
transactionnel dérivé de `RES-2/request/<uuid>`. Aucun effet métier ne le précède.
Le payload JSONB **serveur** contient opération, contrat `RES-2/2.0`, acteur réel,
auth.uid et tous les paramètres typés, y compris les options NULL explicites.
UUID normalisés, quantités numeric(14,4), séquences bigint et ordre JSONB déterministe.
Le SHA-256 est calculé en UTF-8 avec digest de l'extension pgcrypto existante : son
schéma et l'appartenance de digest(bytea,text) à l'extension sont vérifiés dans les
catalogues, jamais supposés à partir d'un search_path client.

Même request_id/hash : retour du JSONB enregistré, sans mutation/événement/segment.
Hash différent : `RESERVATION_REQUEST_PAYLOAD_MISMATCH`. Le rejeu précède les
contrôles de séquence/cible. La ligne request append-only est insérée uniquement
après toutes les mutations et l'événement, avec le résultat final. Chaque succès
nouveau écrit un événement created/target_changed/released, traçable par request_id.
Aucune unicité n'est ajoutée au request_id des événements.

Le verrou métier utilise **exclusivement stock.stock_reservation_locks**. Les clés
sont insérées idempotemment puis verrouillées FOR UPDATE dans l'ordre
resource_type/resource_id/location_id, insertion comprise. Pour une réservation
existante, toutes les localisations des segments et l'éventuelle localisation
explicite sont verrouillées avant la ligne de réservation ; le segment libéré
est ensuite verrouillé. Un changement concurrent de l'ensemble des localisations
déclenche `RESERVATION_CONCURRENT_CHANGE` plutôt qu'un verrou supplémentaire hors
ordre : annuler/rejouer la transaction avec le même request_id inchangé.

Les écritures exigent READ COMMITTED afin d'observer après attente les commits
précédents. Une transaction applicative par RPC est le contrat de concurrence ;
une composition arbitraire de plusieurs RPC dans une transaction nécessite un
protocole global ultérieur. Les séquences de création sont >0, puis strictement
croissantes pour chaque changement de cible. Aucun integer intermédiaire.

### Helpers privés

`_res2_fail(text)`, `_res2_actor(boolean)`, `_res2_quantity(numeric)`,
`_res2_lock_request(uuid)`, `_res2_check_locations(jsonb,boolean)`,
`_res2_request(uuid,text,uuid,jsonb)`, `_res2_lock_resources(jsonb)`,
`_res2_article_location(uuid,uuid)`, `_res2_lock_reservation(uuid,uuid)`,
`_res2_available(uuid,uuid,uuid,uuid)`, `_res2_state(uuid)` ; tous dans stock.

### Résultats et erreurs

Les retours contiennent les quantités RES-1, statut, séquence bigint, références
OP/révision, segments triés et allocations actives triées. Les écritures ajoutent
request_id et location_id de l'opération (NULL pour une baisse sans localisation).
Pas de mouvements internes, profils, emails ou journal technique dans ces retours.

Convention : SQLSTATE `P0001`, MESSAGE égal au code stable, **DETAIL JSON**
`{"code":"RESERVATION_…","contract":"RES-2/2.0"}`. Le client doit lire le champ
code de DETAIL ; le texte libre n'est pas le contrat applicatif.

Codes : RESOURCE_TYPE_UNSUPPORTED, REQUEST_PAYLOAD_MISMATCH, PROFILE_REQUIRED,
ROLE_FORBIDDEN, LOCATION_FORBIDDEN, RESOURCE_NOT_FOUND, NOT_FOUND,
STALE_CHANGE_SEQUENCE, RELEASE_EXCEEDS_RESERVED, SEGMENT_REQUIRED, SEGMENT_NOT_FOUND,
LOCATION_REQUIRED, TARGET_UNCHANGED, REQUEST_REQUIRED, QUANTITY_INVALID,
RESOURCE_UNAVAILABLE, STOCK_UNIT_MISMATCH, STATUS_FORBIDDEN, CONCURRENT_CHANGE,
ISOLATION_UNSUPPORTED ; tous préfixés `RESERVATION_`.

### Validation et limites intermodules

Scripts : `tests/res2-static.test.mjs`, `tests/res2-transactional-validation.sql`,
`tests/res2-local-fixture.sql`, `tests/run-res2-local.mjs` et protocole
`tests/res2-concurrency-protocol.md`. Le lanceur refuse toute configuration de
connexion distante, crée un cluster loopback jetable et utilise deux processus
psql distincts pour la concurrence. La fixture minimale importe les véritables
helpers existants, la vue physique et les migrations RES-1/RES-2 ; elle ne reproduit
pas tout Supabase ni le service Auth. Les résultats effectifs sont consignés dans
le rapport de validation locale du lot. La validation TEST finale est désormais acquise : 234 contrôles obligatoires PASS, 1 INFO PASS et 0 FAIL.

OP-1 `202609290001` est installé et vérifié TEST (71/71 selon synchronisation
ratifiée), mais absent de ce worktree : aucune modification ni certification locale
de sa structure. Aucun changement ACHATS, VENTES, transferts ou stock physique.
RES-2 est le socle technique article-only validé sur TEST ; aucun raccordement opérationnel FT-OP n’est activé dans ce lot. INT-1 reste séparé et non déployé.
Les réservations restent **non activables dans les parcours** tant que VENTES,
transferts et les autres writers physiques ne partagent pas le verrou métier.
Pas de maintain, delivery, consommation, couverture ACHATS ou génération de besoin.

=== SYNCHRO CODEX ===
Module principal: STOCK / RES-2
Décisions validées: article uniquement ; hausse localisée explicitement ; baisse multi-localisation sans libération ; segment zéro de création
Impacts: aucun raccordement ACHATS / VENTES / transferts / FT-OP ; verrou commun à intégrer ultérieurement
Objets partagés: six tables RES-1, vue physique et contrôles d'accès existants
État: DÉPLOYÉ TEST ; HISTORIQUE SYNCHRONISÉ ; VALIDÉ TEST ; CLÔTURÉ
Points ouverts: INT-1 séparé et raccordement futur des writers OP, VENTES, transferts et autres sorties physiques
