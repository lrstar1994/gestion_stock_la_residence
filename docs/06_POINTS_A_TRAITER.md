# Points à traiter

Les points ci-dessous ne sont pas des autorisations de développement.

| Point | Module propriétaire | Impact | État |
|---|---|---|---|
| Définir le modèle OP autonome : objet, statuts, validations, planification, prévalidation des versions FT et indépendance de la validation des besoins Achats | Fiches techniques / Production | FT, besoins, stock, consommation | VALIDÉ MÉTIER partiel ; CODÉ LOCALEMENT non établi ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi |
| Définir le contrat commun de réservation OP : quantités physiques/engagées/réservées, libération Chef à la baisse, idempotence, audit et propagation aux disponibilités | Stocks + FT-OP | autres OP, Ventes, achats engagés | VALIDÉ MÉTIER ; CODÉ LOCALEMENT non établi ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi |
| Implémenter le traitement des réservations supplémentaires après refus Direction : décision explicite du Chef, maintien temporaire ou libération, revue quotidienne et audit, sans libération automatique ni expiration liée à l’âge du brouillon | Stocks + FT-OP | disponibilités, Ventes, production | VALIDÉ MÉTIER ; CODÉ LOCALEMENT non établi ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi |
| Définir techniquement une seule proposition de révision active par OP, son actualisation, son historique et le recalcul sans cumul des propositions précédentes | FT-OP + Stocks | réservations, Achats, disponibilités | VALIDÉ MÉTIER ; CODÉ LOCALEMENT non établi ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi |
| Vérifier l’historique TEST des migrations Stocks déplacées dans `migrations_hold` | Stocks / infrastructure | RLS, transferts, inventaires | VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST déclaré mais preuve CLI incomplète ; VALIDÉ TEST non établi |
| Confirmer runtime des transferts 180002/180004 : préparation, remise, réception, retry, écart | Stocks | stock et audit | VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; VALIDÉ TEST à exécuter |
| Exposer stock actuel et quantité suggérée pour renouvellement sans inventer de calcul | Achats + Stocks | formulaire besoins | VALIDÉ MÉTIER ; évolution à analyser |
| Définir le stockage d’une date limite d’opportunité | Achats | opportunités d’achat | VALIDÉ MÉTIER ; aucune colonne dédiée identifiée |
| Définir la consolidation visuelle multi-date et multi-utilisation dans les rapports | Achats | traçabilité et prévision | VALIDÉ MÉTIER ; CODÉ LOCALEMENT partiel |
| Harmoniser `status`, `decision_status`, `processing_mode`, `workflow_status` | Achats transverse | transitions et compteurs | VALIDÉ MÉTIER ; décision SQL à préparer séparément |
| Définir le retour coût réel TTC vers recettes / analyse | Production + Stocks | coût matière TTC | VALIDÉ MÉTIER ; architecture à spécifier |
| Vérifier les droits de lecture réception Caisse après restrictions Stocks | Achats + Stocks | rapports et régularisations | VALIDÉ MÉTIER ; RPC dédiée préparée/à vérifier TEST |
| Confirmer objectuellement puis valider la couche de qualification des prix réels et ses RPC | Achats + FT/OP | prix normal, conversion, TVA, analyses | VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST non confirmé par l’audit documentaire courant ; VALIDÉ TEST non établi |
| Définir l’écran Direction de qualification promotionnelle/exceptionnelle | Achats | justification et audit | VALIDÉ MÉTIER ; UI non implémentée |
| Vérifier les sources finales admissibles et unités sur TEST | Achats + Stocks | exactitude du dernier prix normal | VALIDÉ MÉTIER ; audit runtime à effectuer |
| Résoudre les observations normales dont `normalized_unit_price` est NULL | Achats + FT/OP | coût incomplet jusqu’à conversion fiable | VALIDÉ MÉTIER ; suivi à organiser |
| Définir le PV théorique complet de `RENDEMENT_PRODUIT` | FT / Direction | tarification par kg/litre/pièce | VALIDÉ MÉTIER non établi ; A6 ne crée aucun fallback |
| Tester sur TEST le coût récursif TTC des sous-recettes, le gel de leur snapshot à la validation et la copie indépendante de la photo entre versions | FT / Direction | coûts et versionnement | CODÉ LOCALEMENT via 202609210006 ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi |
| Confirmer objectuellement puis valider A1 à A6 dans l’ordre 210001 → 210005 | FT / infrastructure | workflow, snapshots, import, photo, validations | VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST non confirmé par l’audit documentaire courant ; VALIDÉ TEST non établi |
| Décider si une validation Chef doit devenir une action sensible avec PIN | FT / sécurité | validation technique | point métier ouvert ; A6 utilise l’identité de session active sans inventer de PIN |
| Maintenir une seule documentation officielle | Gouvernance | tous | CODÉ LOCALEMENT : ce dossier ; VALIDÉ TEST documentaire à confirmer par revue équipe |

## Contradictions à surveiller

- Les copies de migrations en `migrations_hold` ne doivent jamais être réactivées automatiquement pour résoudre un problème de frontend.
- Les statuts historiques ne doivent pas être remplacés par `workflow_status` sans mapping documenté.
- Une liste d’articles/localisations ou une consolidation UI ne doit pas créer de lignes de stock ni supprimer les lignes sources.
- Une page visible par un rôle ne constitue pas un droit backend d’écriture.

=== SYNCHRO CODEX ===
Module principal: transversal
Décisions validées: aucune nouvelle décision prise par cette liste
Impacts sur les autres modules: voir chaque ligne
Objets partagés concernés: voir 00_MASTER_APP
État d’implémentation: points ouverts explicitement suivis
Documents à mettre à jour: après chaque arbitrage ou implémentation
Points ouverts: tableau ci-dessus
## Lot A - Fiches techniques / Recettes

- **VALIDÉ MÉTIER** : rendement par portions ou produit, coût matière officiel, prix TTC retenu, fiches versionnées et procédure traçable.
- **CODÉ LOCALEMENT** : fondation additive `202609210001`, formulaire rendement/prix TTC, lecture du prix Achats officiel, route `/recipes/to-validate`, modèle Excel quatre feuilles.
- **CODÉ LOCALEMENT** : readiness distingue désormais prix NORMAL absent et prix NORMAL non normalisable (`normalized_unit_price = NULL`) ; les deux bloquent la soumission/validation sans fallback.
- **CODÉ LOCALEMENT** : A2 ajoute les modes portions/rendement produit, les lignes BRUT/NET, le calcul de quantité brute à partir d’un rendement et les contrôles de cohérence associés.
- **CODÉ LOCALEMENT** : A3 ajoute les snapshots de forme et de coût, les lignes Article/Sous-recette et une protection SQL contre les cycles.
- **CODÉ LOCALEMENT** : A4 ajoute le procédé ordonné, les durées active/passive et la photo principale dans Supabase Storage privé.
- **CODÉ LOCALEMENT** : A5 remplace l’ancien import mono-feuille par le modèle officiel `FICHES` / `INGRÉDIENTS` / `DÉROULÉ` / `AIDE`, une transaction par FT, un rapprochement prudent et des alias confirmés. Le prix Excel reste indicatif et n’alimente aucun coût officiel.
- **DÉPLOYÉ TEST** : non confirmé par le présent audit documentaire ; la CLI locale n’a pas fourni de lecture exploitable de l’historique.
- **VALIDÉ TEST** : non établi ; TEST ne contient pas encore de lignes `recipe_ingredients` permettant de confirmer le comportement runtime avec conversion.

Actions de validation ultérieures : auditer puis déployer séparément les migrations A1-A5 dans leur ordre de dépendance, créer un jeu de test FT contrôlé, vérifier l’import multi-FT, les alias, les conversions, les formes NET et les coûts récursifs, puis valider les permissions Chef/Direction.
