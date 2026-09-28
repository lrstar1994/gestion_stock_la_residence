# Liaisons entre modules

## Chaîne métier de référence

```text
FT / Recettes
  → OP / Planification
  → Besoins matières par date
  → Stock disponible / minimum / prévisionnel
  → Manques
  → Besoins d'achat
  → Décision Direction
  → Achat direct ou commande
  → Réception / contrôle
  → Magasin principal
  → Transferts
  → Production
  → Consommation
  → Coût réel
  → retour vers FT / analyse
```

## Contrats entre étapes

| Étape | Source de vérité | Consommateur | Règle |
|---|---|---|---|
| FT / recettes | `recipes`, `recipe_ingredients` | événements, planification, besoins | prix indicatif et quantités théoriques ne sont pas des coûts réels |
| OP / planification | modèle à définir | besoins matières, production | ne pas fabriquer un OP à partir d’un simple champ `event_id` |
| Besoin | `purchase_needs` | Direction, commandes, achats espèces | une ligne source reste traçable ; date et utilisation sont propres à la ligne |
| Décision | décisions Direction / RPC existantes | `purchase_orders` ou `cash_purchases` | la validation Direction de l’OP et la décision Direction du besoin sont indépendantes ; l’autorisation ne crée pas de mouvement financier |
| Réception | `receptions` et lignes/documents | contrôle, stock, factures | réception physique initiale au Magasin principal |
| Stock | `stock_movements` et vues | inventaires, transferts, production | aucune table métier parallèle ne doit devenir un second stock |
| Transfert | batches/lignes/handoffs/receipts | stock origine, transit, destination | idempotence et audit par ligne |
| Consommation | mouvements de sortie/consommation | coûts, analyse | l’unité doit rester cohérente avec l’article |
| Coût réel | réceptions/mouvements validés | recettes/analyse | ne pas remplacer silencieusement un coût réel par un prix indicatif ; la base opérationnelle FT est le coût matière TTC |
| Prix réel qualifié | `purchase_actual_price_candidates` + qualifications | FT/OP, analyses Achats | filtrer `normal`, conserver unité/conversion/TVA, ne pas créer une source de vérité concurrente |
| Import FT | modèle Excel FT + `pending_ingredients` + alias confirmés | recettes et référentiel Articles | un libellé importé ne crée jamais automatiquement un article ; le prix Excel reste indicatif et ne devient jamais un prix Achats |
| Validation FT | RPC A6 + `recipe_validation_history` + snapshots de lignes | ventes, futures OP et analyses | Chef valide la technique, Direction valide l’économie avec le prix NORMAL Achats ; une variation ultérieure du prix recalcule le coût actuel sans réécrire le snapshot validé |

## Propriété des objets partagés

- **Articles, unités, localisations** : propriétaire Stocks / référentiel.
- **Recettes, ingrédients, événements et liens recette** : propriétaire Fiches techniques / Production.
- **`purchase_needs`, commandes, achats espèces** : propriétaire Achats.
- **Réceptions et justificatifs** : propriété opérationnelle Achats / réception, avec effet contrôlé sur Stocks.
- **Mouvements de stock et inventaires** : propriétaire Stocks.
- **Fournisseurs et prix fournisseur** : référentiel Achats ; les prix réels validés alimentent les coûts consommés.

## Invariants à préserver

1. La disponibilité d’un article dans une localisation ne crée pas de quantité.
2. Une décision Direction n’est pas un mouvement de stock ou financier.
3. Une réception contrôlée peut créer des mouvements ; une simple lecture de réception ne donne pas un droit d’écriture stock.
4. Un refus déjà payé ouvre une régularisation unique et traçable, sans être confondu avec la monnaie Caisse.
5. Les transferts normaux conservent le total établissement ; une perte confirmée est une exception auditée.
6. Les anciennes colonnes et statuts restent lisibles tant qu’une migration de convergence n’est pas validée.
7. Un prix promotionnel ou exceptionnel ne devient pas le prix normal sans qualification Direction et motif ; les historiques non qualifiés restent non qualifiés.
8. Une observation normale peut rester sans prix normalisé lorsque la conversion d’unité est inconnue ; aucun prix supposé ne doit être fabriqué.
9. Un alias d’import confirmé relie un libellé normalisé à un seul article actif ; une suggestion approximative ne vaut pas confirmation.
10. Une FT validée est immuable ; une évolution métier crée une nouvelle version. Une variation de prix Achats ne crée pas de version.
11. Toutes les versions de FT utilisées par un OP doivent être définitivement validées par la Direction avant validation de l’OP. La validation OP reste une étape de planification et d’autorisation prévisionnelle ; elle ne remplace pas la validation ultérieure de chaque `purchase_need`.
12. Une révision OP à la baisse peut libérer immédiatement, par le Chef après confirmation, les réservations excédentaires de produits finis et sous-recettes. Cette libération doit être atomique, idempotente et auditée, sans modifier les quantités déjà sorties/consommées ni les achats engagés. Les disponibilités destinées aux autres OP et à Ventes doivent être recalculées après l’opération ; aucun objet technique de réservation commun n’est encore présent.
13. Une révision OP à la hausse conserve les réservations approuvées et peut réserver seulement la quantité supplémentaire effectivement libre. Le manque reste prévisionnel ; aucune fabrication ni demande d’achat supplémentaire ne part avant validation Direction. Après validation, les besoins restent des lignes `purchase_needs` traçables et soumis à Achats. Les réservations concurrentes doivent être sérialisées et idempotentes pour éviter la sur-réservation entre OP et Ventes. En cas de refus, aucune libération automatique ni expiration liée à l’âge du brouillon n’est permise : le Chef décide explicitement du maintien ou de la libération des réservations supplémentaires, et cette décision est historisée.
14. Une seule proposition de révision OP est active à la fois. Toute nouvelle modification actualise cette proposition ; les demandes antérieures restent historisées et ne sont jamais additionnées. Les nouveaux besoins Achats sont recalculés uniquement depuis la dernière révision approuvée et ne sont transmis qu’après validation Direction.

=== SYNCHRO CODEX ===
Module principal: transversal
Décisions validées: une source de vérité par objet, contrats explicites entre étapes
Impacts sur les autres modules: tous
Objets partagés concernés: articles, units, locations, recipes, events, purchase_needs, purchase_orders, receptions, suppliers, stock_movements
État d’implémentation: contrats documentés ; OP et certains retours analytiques restent ouverts
Documents à mettre à jour: 00_MASTER_APP, 01_ACHATS, 02_STOCKS, 03_FICHES_TECHNIQUES_OP
Points ouverts: modèle OP, synchronisation planification-stock, coût réel de retour vers recettes
## Fiches techniques / Achats / Stock - état du lot A

FT reste propriétaire de `recipes`, `recipe_ingredients`, procédures et validations. Le prix matière normal provient de la couche Achats `get_last_normal_actual_purchase_price(s)` ; Stock ne sert plus de source de prix pour FT. Les consommations et événements continuent de consommer les quantités stockées et leurs unités via les colonnes de conversion existantes.

État : **CODÉ LOCALEMENT** ; le déploiement TEST du contrat prix, de la fondation et de l’import A5 n’est pas confirmé par le présent audit documentaire. Aucune création d’OP, de planification ou de mouvement de stock n’est introduite par ce lot.
