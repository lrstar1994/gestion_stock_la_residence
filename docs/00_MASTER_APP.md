# Référentiel transversal de l’application

Date de l’audit documentaire : 2026-09-20. Ce dossier est la source documentaire commune pour Achats, Stocks et Fiches techniques / Production / OP.

## Règle de lecture des statuts

Chaque sujet important porte un état explicite : **VALIDÉ MÉTIER**, **CODÉ LOCALEMENT**, **DÉPLOYÉ TEST** ou **VALIDÉ TEST**. Un état ne remplace pas un autre : une fonctionnalité peut être codée localement sans être déployée, ou déployée TEST sans validation fonctionnelle TEST.

## État transversal connu

| Domaine | État connu | Preuve / limite |
|---|---|---|
| Besoins d’achat, décisions Direction et achats espèces / commandes | VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; plusieurs lots DÉPLOYÉ TEST et VALIDÉ TEST | Rapports `RAPPORT_LOT_*`, migrations 202608–202609 et code `src/pages/purchase-needs`, `src/pages/cash-purchases`, `src/pages/purchase-orders` |
| TVA par ligne et montant payable | VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST déclaré dans la session | Migration 202609100006 et code `purchaseNeeds.api.ts` |
| Journal financier / comptes Caisse | VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST selon les rapports C1 | `SPEC_C1_JOURNAL_CAISSE_V2_20260909.md`, migrations 202609100001–008 |
| Réceptions, contrôle achat espèces, régularisations fournisseur | VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST par lots 3B déclarés | Migrations 202609110001–007, APIs `receptions.api.ts`, `supplierRegularizations.api.ts` |
| Restrictions de stock par localisation | VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST déclaré pour 160001 | Copie locale active dans `supabase/migrations_hold` ; statut distant à revérifier avant nouvelle application |
| Transferts groupés, brouillons et remise/réception | VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST déclaré pour 180002/180004 | Migrations présentes dans `migrations_hold`; l’historique manuel doit rester la référence opérationnelle |
| Champs métier des besoins (`business_origin`, `intended_use_id`, etc.) | VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST déclaré pour 180005 ; VALIDÉ TEST non établi ici | Migration 202609180005 et frontend local |
| Prix réel d’achat qualifié et normalisé | VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; migration additive 202609230001 non déployée TEST ; VALIDÉ TEST non établi | A1 fournit `purchase_actual_price_candidates` et les RPC de lecture ; 202609230001 transfère la qualification du contrôle d’achat espèces au Contrôleur de façon atomique. |
| Prix provisoire de travail dans une FT sans NORMAL | VALIDÉ MÉTIER ; CODÉ LOCALEMENT avec migrations additives 202609230002 et 202609260001 ; DÉPLOYÉ TEST pour 230002, non établi pour 260001 ; VALIDÉ TEST partiellement pour 230002, non établi pour 260001 | Saisie, persistance et calcul simple validés sur TEST ; la propagation V1 → V2 est codée localement avec traçabilité d'origine, sans reprise rétroactive ; append-only FT, TTC, prioritaire seulement en l’absence de NORMAL ; jamais une qualification Achats ni un prix Stock. |
| Statut de coût FT et validation avec provisoire | VALIDÉ MÉTIER ; CODÉ LOCALEMENT avec migration 202609240002 présente dans `supabase/migrations` ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi | Statut distinct PROVISOIRE/CONFIRME/A_REVOIR, propagation récursive des sous-recettes, recalcul économique après NORMAL, seuils NULL sûrs et tâche Direction dédupliquée ; aucun push dans ce lot. |
| Fiches techniques / Lot A | VALIDÉ MÉTIER ; CODÉ LOCALEMENT A1 à A6 ; DÉPLOYÉ TEST non confirmé par l’audit documentaire courant ; VALIDÉ TEST non établi | Migrations 202609210001–005, `src/pages/recipes`, `recipes.api.ts`. La validation Chef et le renvoi en correction exigent le PIN personnel, vérifié côté base et audité. |
| UX progressive des formulaires FT | VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi | Valeurs par défaut sélectionnables sans effacer les données persistées, brouillon serveur réutilisant `recipes`, recherche d'articles avec résultats immédiats puis affinement dès le premier caractère. Généralisation aux autres modules à traiter formulaire par formulaire. |
| OP / planification / Composition Lot B | VALIDÉ MÉTIER partiel ; CODÉ LOCALEMENT non effectué ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi | La validation Direction de l’OP est indépendante de la validation Direction des `purchase_needs` ; toutes les versions FT utilisées doivent être validées Direction avant l’OP. Modèle autonome explicitement hors Lot A. |

## Carte des objets partagés

| Objet | Module propriétaire | Consommateurs principaux |
|---|---|---|
| `stock.articles` | STOCKS / référentiel | Achats, recettes, réceptions, inventaires, transferts, sorties |
| `stock.units` | STOCKS / référentiel | Articles, recettes, achats, mouvements |
| `stock.locations` | STOCKS / référentiel | Stock, inventaires, réceptions, transferts, restrictions d’accès |
| `stock.article_locations` / règles de disponibilité article | STOCKS | Stock et formulaires d’article ; achats uniquement pour sélectionner un article |
| `stock.recipes`, `stock.recipe_ingredients` | FICHES TECHNIQUES | Production/événements, calcul des besoins, coûts |
| `stock.events`, `stock.event_recipes` | FICHES TECHNIQUES / événements | Besoins liés aux événements et planification |
| `stock.purchase_needs` | ACHATS | Direction, regroupement, commandes, achats espèces, rapports |
| `stock.purchase_orders` et lignes | ACHATS | Fournisseurs, réceptions, suivi, factures |
| `stock.receptions` et lignes/documents | ACHATS / réception | Contrôle, factures, stock, rapports Caisse et Direction |
| `stock.suppliers` | ACHATS / référentiel | Besoins, commandes, réceptions, factures, régularisations |
| `stock.stock_movements` | STOCKS | Inventaires, stock actuel, journal, transferts, production/consommation |
| `stock.cash_purchases` et lignes | ACHATS / Caisse | Décaissement, contrôle, réceptions comptant, journal financier |
| `stock.purchase_price_qualifications` et historique | ACHATS | Qualification Direction des prix réels issus des lignes finales ; lecture officielle FT/OP |

## Règle de synchronisation

Avant de modifier un objet partagé : lire ces documents, inspecter le code, les migrations actives/disabled/hold, identifier le propriétaire, recenser les consommateurs et réutiliser l’existant. Une contradiction doit être signalée avant tout codage.

```text
=== SYNCHRO CODEX ===
Module principal:
Décisions validées:
Impacts sur les autres modules:
Objets partagés concernés:
État d’implémentation:
Documents à mettre à jour:
Points ouverts:
```

`SYNCHRO uniquement` signifie documentation et analyse seulement. `SYNCHRO + IMPLÉMENTATION` est nécessaire pour modifier le code ou le schéma.

## Documents historiques

Le dépôt contenait déjà de nombreux rapports racine et `docs/SOCLES_CRITIQUES_1_13.md`. Les sept fichiers numérotés sont la consolidation officielle ; les rapports historiques restent des preuves de décisions ou d’audits, pas une seconde spécification concurrente.

## Contradictions ou limites connues

- Les statuts legacy (`status`, `decision_status`, `processing_mode`) coexistent avec des statuts métier plus récents (`workflow_status`). Toute transition doit documenter les deux.
- Les migrations Stocks 160001, 170001, 180001, 180002 et 180004 ont été déplacées dans `migrations_hold` localement ; leur application manuelle TEST et leur historique CLI ne sont pas déductibles du dépôt seul.
- Les recettes et événements existent, mais un modèle OP complet et ses transitions doivent encore être distingués des écrans événements.
- La règle métier OP est arrêtée, mais son implémentation reste à définir : validation Direction de l’OP après validation définitive des FT utilisées, puis préparation et décision indépendante des besoins Achats. Le code actuel ne fournit pas encore la preuve d’un circuit OP autonome.
- Les révisions OP à la hausse et à la baisse sont validées métier : réservation/libération partielle par le Chef, sans fabrication ni achat supplémentaire avant validation Direction. En cas de refus d’une hausse, aucune libération automatique ni expiration liée à l’âge du brouillon n’a lieu ; le Chef décide de libérer ou de maintenir temporairement les réservations supplémentaires, avec revue quotidienne et historique nominatif. Aucun contrat technique de réservation atomique partagé n’existe encore.
- Une seule proposition de révision OP est active à la fois ; une nouvelle modification actualise cette proposition, tandis que les demandes précédentes restent historisées et ne sont jamais additionnées. Les besoins Achats sont recalculés depuis la dernière révision approuvée et restent soumis à la validation Direction.
- Le stock actuel est calculé à partir des mouvements ; autoriser un article dans une localisation ne crée pas une quantité.
- La base opérationnelle officielle du coût matière FT est TTC. Les informations HT et TVA restent des données fournies par Achats, sans piloter le calcul opérationnel FT dans cette version.
