# Module Achats

## Périmètre

Le point d’entrée métier est `Besoins d’achat` avec le bouton `+ Créer un besoin d’achat`. Une ligne de besoin reste une entité traçable ; un regroupement de commande ne supprime pas les besoins sources.

## Objets et sources

| Objet | Rôle |
|---|---|
| `stock.purchase_needs` | Article, quantité, unité, date de besoin, origine legacy et champs métier 180005 (`business_origin`, `intended_use_id`, `supply_difficulty`, `justification`, `workflow_status`) |
| `stock.purchase_intended_uses` | Référentiel actif des utilisations prévues ; neuf valeurs seedées par 180005 |
| `stock.purchase_orders` / lignes | Commandes fournisseur issues du regroupement de besoins |
| `stock.cash_purchases` / lignes | Achat direct espèces et son circuit Caisse/Contrôleur |
| `stock.receptions` / lignes / documents | Réception physique, justificatifs et rattachement commande/achat comptant |
| `stock.suppliers` | Référentiel fournisseur partagé avec réceptions et régularisations |
| `stock.cash_purchase_differences` | Constats financiers typés, séparés des régularisations opérationnelles |
| `stock.cash_purchase_supplier_regularizations` | Suivi partagé des marchandises refusées déjà payées |

## Modèle métier actuel

Chaque combinaison article + quantité + utilisation prévue + date crée une ligne `purchase_needs` distincte. La consolidation est visuelle ou opérationnelle par commande, jamais une suppression de la traçabilité source.

Origines métier :

- `renouvellement_stock` — Renouvellement de stock ;
- `production_fiche` — Production / fiche technique ;
- `mise_en_place` — Mise en place ;
- `opportunite_achat` — Opportunité d’achat soumise à Direction.

Le champ legacy `destination_prevue` reste conservé pour compatibilité. Il ne représente pas une localisation physique : les réceptions arrivent d’abord au Magasin principal.

## Workflow et statuts

Chaîne métier cible : Brouillon → Soumis → En décision Direction → Autorisé / Refusé → À approvisionner. Les anciennes colonnes `status`, `decision_status` et `processing_mode` restent utilisées par les parcours existants. `workflow_status` est additive et nullable historiquement.

Le formulaire local ne possède pas de véritable brouillon serveur : l’état de saisie est conservé en `localStorage`, puis une création définitive utilise `workflow_status = submitted`. Les transitions Direction ne sont pas automatisées par le frontend.

### Indépendance avec la validation des OP

La validation Direction d’un OP et la validation Direction des besoins d’achat qui en découlent sont deux étapes obligatoires et indépendantes. L’accord sur un OP autorise l’examen de ses productions, des stocks disponibles et engagés, des besoins prévisionnels et du montant estimatif ; il ne vaut pas autorisation d’achat et ne remplace aucune décision du circuit `purchase_needs`.

Après validation de l’OP, la magasinière prépare les besoins dans `purchase_needs`, en conservant pour chaque ligne son origine, sa date de besoin, sa quantité et sa justification. La Direction valide ensuite chaque besoin dans le circuit Achats et choisit, selon la décision enregistrée, un achat direct ou une commande fournisseur. Les validations propres aux commandes, aux proformas lorsqu’elles existent, aux décaissements et aux réceptions restent obligatoires. Un regroupement commercial par `group_id` ou commande ne fusionne jamais les provenances.

## TVA et montants

La TVA est portée par ligne (`tax_treatment`, `vat_rate`, montants HT/TTC/payable). `estimated_payable_amount` est la référence payable lorsque disponible ; `estimated_cost` reste le fallback historique. Le prix HT ne doit pas être comparé directement au prix réel TTC.

## Réception, contrôle et finance

Le circuit achat espèces relie décision Direction, remise Caisse, contrôle Contrôleur, réception au Magasin principal, mouvements de stock et journal financier. Le contrôle distingue monnaie, montant payé fournisseur, valeur acceptée et régularisation fournisseur. Aucun écart métier ne doit créer implicitement un mouvement financier IN.

## Droits

Les droits existants (`canCreatePurchaseNeeds`, décisions Direction, regroupement et édition) restent la référence frontend ; les RPC/RLS restent l’autorité réelle. Les erreurs de référentiel doivent être visibles, jamais converties silencieusement en listes vides.

## Contrat de prix réel qualifié

Le prix réel officiel est dérivé des lignes finales admissibles de `cash_purchase_items`, `reception_items` et `invoice_items`. Une qualification explicite (`normal`, `promotional`, `exceptional`) est portée par `purchase_price_qualifications`, sans backfill des historiques non qualifiés. Lors d'un contrôle d'achat espèces, le Contrôleur qualifie chaque ligne admissible dans la même transaction que le contrôle ; une qualification promotionnelle ou exceptionnelle exige un motif. La Direction conserve ses droits de lecture et de décision prévus, sans validation supplémentaire de la qualification.

La vue `purchase_actual_price_candidates` est la couche canonique de lecture. Les RPC `get_last_normal_actual_purchase_price(uuid)` et `get_last_normal_actual_purchase_prices(uuid[])` renvoient uniquement le dernier prix réel normal admissible avec unité source, unité normalisée, facteur de conversion, date, fournisseur, statut et informations TVA disponibles. `normalized_unit_price` est nullable : sa valeur NULL signifie qu’un prix normal existe mais que sa conversion vers l’unité de référence n’est pas fiable. Les formulaires d’achat existants ne sont pas modifiés par ce contrat.

## État

- Besoins et achats : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST par lots historiques ; VALIDÉ TEST selon rapports existants.
- Champs métier 180005 : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST déclaré ; VALIDÉ TEST à confirmer sur les parcours réels.
- Prix réel qualifié et RPC de lecture : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; migration additive 202609230001 non déployée TEST ; VALIDÉ TEST non effectué.
- Sécurisation locale du Lot A : CODÉ LOCALEMENT. La régénération événementielle rapproche les seuls besoins `a_faire`/`en_cours` et conserve les autres en signalant un écart ; les transitions et remplacements de commandes appliquent des préconditions de statut et de réception. Les garanties transactionnelles côté base et la concurrence restent à préparer avant tout déploiement TEST.

=== SYNCHRO CODEX ===
Module principal: Achats
Décisions validées: besoins élémentaires traçables, TVA par ligne, réception au Magasin principal
Impacts sur les autres modules: stock, recettes/événements, finance Caisse
Objets partagés concernés: articles, units, suppliers, purchase_needs, receptions, stock_movements
État d’implémentation: voir les états ci-dessus
Documents à mettre à jour: 00_MASTER_APP, 04_LIAISONS_ENTRE_MODULES, 05_DECISIONS_VALIDEES
Points ouverts: OP complet, stock actuel/suggestion pour renouvellement, date limite d’opportunité
