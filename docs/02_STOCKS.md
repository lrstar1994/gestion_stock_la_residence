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

L’audit local n’a identifié aucune table, RPC ou vue de réservation OP dédiée. Les disponibilités actuelles sont calculées à partir des mouvements et des contrôles de stock ; elles ne permettent donc pas encore de distinguer de façon atomique quantité physique, quantité engagée et quantité réservée par OP. La décision reste **CODÉE LOCALEMENT non établie ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi**. Aucun mécanisme de libération ne doit être ajouté dans ce lot.

**VALIDÉ MÉTIER — révision OP à la hausse** : les réservations déjà approuvées sont conservées. Le Chef peut réserver immédiatement la quantité supplémentaire réellement libre ; si elle est insuffisante, seule la quantité disponible est réservée et le manque prévisionnel est affiché séparément. La production déjà approuvée continue seule. Aucune fabrication supplémentaire ni nouveau besoin d’achat ne peut être déclenché avant validation Direction de la révision ; après cette validation, les besoins passent par `purchase_needs` et ses décisions indépendantes.

Un OP ne peut avoir qu’une seule proposition de révision active en attente. Une nouvelle modification actualise cette proposition active ; les propositions précédentes restent historisées mais ne sont jamais additionnées. Les besoins sont recalculés par rapport à la dernière révision approuvée, en tenant compte des réservations existantes et des mouvements physiques.

Le futur contrat devra verrouiller la disponibilité au moment de la réservation, accepter les réservations partielles, dédupliquer chaque révision/opération, rapprocher les quantités réservées des mouvements physiques et recalculer la disponibilité commerciale. En cas de refus Direction, aucune libération automatique ni expiration liée à l’âge du brouillon n’est déclenchée : les réservations de la dernière révision approuvée restent intactes ; le Chef décide ensuite de libérer ou de maintenir temporairement les réservations supplémentaires, avec revue quotidienne et audit de cette décision.

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
