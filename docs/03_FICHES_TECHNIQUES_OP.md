# Fiches techniques / Production / OP

## Modèle présent

Le dépôt contient `stock.recipes`, `stock.recipe_ingredients`, les versions et statuts de recette, ainsi que `stock.events`, `stock.event_recipes` et des écrans de production/événements. Les articles utilisables en recette sont marqués dans le référentiel article.

Les recettes portent les ingrédients, quantités, unités et coûts calculés. Les événements peuvent produire des besoins théoriques et relier une fiche à une demande. Les besoins d’achat conservent `event_id` et `recipe_id` lorsque le parcours spécialisé les fournit.

Les dépendances Stocks nécessaires au Lot A sont **VALIDÉES TEST** : `articles.locations_restricted`, `article_locations`, `units`, les colonnes de conversion de `recipe_ingredients` et leurs FK attendues. Leur conversion runtime sur une recette contenant réellement un ingrédient reste à confirmer ultérieurement ; cette absence de donnée ne bloque pas le Lot A.

## OP / planification

Un modèle OP complet et ses transitions n’ont pas été identifié comme objet autonome dans l’audit documentaire. Aucun frontend de besoin ne doit donc créer artificiellement un OP. La cible métier reste à préciser avant de relier production planifiée, besoins par date et consommation.

La règle métier cible est indépendante des objets encore à définir techniquement : toutes les versions de FT utilisées par les lignes d’un OP doivent être définitivement validées par la Direction avant que la Direction puisse valider l’OP. Cette validation de l’OP porte sur les productions, stocks, engagements, besoins prévisionnels et montant estimatif ; elle ne valide pas les besoins d’achat. Après l’OP validé, les besoins sont préparés dans le circuit Achats puis soumis aux décisions Direction propres à `purchase_needs`, sans fusionner leurs origines.

Pour une révision OP à la baisse, le Chef peut libérer immédiatement les réservations excédentaires de produits finis et sous-recettes après confirmation des nouvelles quantités. Cette libération doit préserver les quantités déjà sorties ou consommées, mettre à jour immédiatement les disponibilités communiquées aux autres OP et à Ventes, et rester distincte de la suspension de production en attente de validation. Le mécanisme technique de réservation, de révision atomique et d’historisation n’est pas encore identifié dans le dépôt.

Pour une révision OP à la hausse, les réservations de la version approuvée sont conservées. Le Chef peut réserver immédiatement les produits finis et sous-recettes supplémentaires réellement disponibles, avec réservation partielle et manque prévisionnel séparé si nécessaire. Cette action ne modifie pas la production approuvée et ne déclenche ni fabrication ni achat supplémentaire avant décision Direction.

Une seule proposition de révision peut être active en attente de validation par OP. Une nouvelle modification remplace les quantités de cette proposition active, tandis que les demandes précédentes restent dans l’historique. Le calcul repart toujours de la dernière révision approuvée ; les suppléments successifs ne sont pas cumulés.

Si la Direction refuse cette révision, aucune production supplémentaire n’est autorisée et aucune libération automatique, y compris par ancienneté du brouillon, n’est exécutée. Le Chef décide explicitement de libérer ou de maintenir les réservations supplémentaires, avec revue quotidienne et historique de l’OP, de la révision, des quantités, de l’auteur et de la date.

## Propriété et consommateurs

Fiches techniques / Production est propriétaire des recettes et de leurs versions. Achats consomme les articles, unités, événements et liens recette pour calculer ou expliquer un besoin ; Stocks consomme les mêmes articles/unités pour les mouvements et la consommation. Les prix réels et coûts matière doivent revenir des réceptions/mouvements validés, pas du prix indicatif d’une fiche.

## États

- Recettes et événements : VALIDÉ MÉTIER partiel ; CODÉ LOCALEMENT ; état DÉPLOYÉ TEST à confirmer par écran/RPC.
- OP / planification : VALIDÉ MÉTIER partiel, incluant l’indépendance OP/Achats et la prévalidation Direction des FT utilisées ; CODÉ LOCALEMENT non démontré comme modèle complet ; pas de statut DÉPLOYÉ TEST établi.
- Propagation des besoins par date vers Achats : VALIDÉ MÉTIER ; partiellement CODÉ LOCALEMENT ; VALIDÉ TEST à organiser.

## Consommation du prix réel officiel

Les fiches et analyses qui auront besoin d’un prix réel doivent appeler la couche Achats `purchase_actual_price_candidates` via `get_last_normal_actual_purchase_price` ou sa version batch. Elles ne lisent pas directement une table de prix parallèle et ne requalifient pas localement un prix. Seuls les prix de lignes finales admissibles et classés `normal` sont retournés par ces RPC ; les unités sont normalisées par le moteur de conversion existant et les champs TVA conservés lorsqu’ils existent. `normalized_unit_price = NULL` signifie qu’une observation normale existe mais que sa conversion vers l’unité de référence n’est pas fiable. FT/OP doivent alors signaler le coût comme incomplet et ne doivent jamais remplacer cette valeur par un facteur 1 implicite, un prix Stock ou une estimation.

La readiness distingue maintenant deux cas : absence d’observation NORMAL (prix NORMAL manquant) et observation NORMAL avec `normalized_unit_price = NULL` (prix NORMAL existant, coût non normalisable). Sans provisoire normalisé, les deux bloquent la soumission/validation et ne déclenchent aucun fallback. Avec un provisoire normalisé exploitable, la soumission, la revue Chef et la validation Direction restent possibles avec `cost_status = PROVISOIRE`.

État : VALIDÉ MÉTIER ; CODÉ LOCALEMENT côté contrat partagé ; DÉPLOYÉ TEST non confirmé par l’audit documentaire courant ; VALIDÉ TEST non établi.

La base opérationnelle officielle du coût matière FT est TTC. Le contrat Achats reste propriétaire des prix et des informations fiscales : FT conserve les informations HT et TVA disponibles, sans les utiliser comme base du calcul opérationnel dans cette version.

### Prix provisoire de travail (correctif local)

Lorsqu'aucun prix NORMAL Achats n'existe pour une ligne article, un utilisateur habilité à gérer les recettes peut enregistrer un prix provisoire TTC append-only dans `recipe_ingredient_provisional_prices`. Ce prix conserve l'auteur, la date, l'unité et l'observation. Un prix NORMAL officiel reste prioritaire dès qu'il existe. Un prix NORMAL non normalisable ne peut pas être remplacé par un provisoire. Depuis le correctif local du workflow, la validation Direction peut accepter un coût provisoire ; la FT devient alors officielle et verrouillée avec `cost_status = PROVISOIRE`. Le prix provisoire ne rejoint jamais le contrat Achats, le Stock ou son historique de qualification.

État : VALIDÉ MÉTIER ; CODÉ LOCALEMENT (`202609230002_recipe_provisional_ingredient_prices.sql`) ; DÉPLOYÉ TEST ; VALIDÉ TEST partiellement (saisie, persistance et calcul simple).

Lors de la création d'une nouvelle version depuis une FT validée, la migration locale `202609260001_recipe_version_provisional_price_carryover.sql` reprend le dernier prix provisoire normalisé de la version précédente uniquement si l'article, l'unité de la ligne et la normalisation sont compatibles et qu'aucun prix NORMAL Achats n'existe pour cet article. La reprise est enregistrée dans le même référentiel avec `copied_from_recipe_id` et `copied_from_price_id`, sans modifier la version source ni son historique. Un NORMAL existant, y compris non normalisable, reste prioritaire et interdit tout fallback provisoire. Aucune reprise rétroactive des versions déjà créées n'est effectuée.

État de cette propagation V1 → V2 : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi.

Le statut technique de la FT et le statut de son coût sont indépendants. Le coût peut être `PROVISOIRE`, `CONFIRME` ou `A_REVOIR`. Le calcul est récursif : une sous-recette validée dont le coût actif est provisoire rend provisoire le coût de la FT parente lorsqu'elle y contribue. Un prix NORMAL arrivé ensuite remplace le provisoire, recalcule le coût courant, le coût par portion et le PV théorique sans créer de version technique et sans réécrire le snapshot validé.

Les seuils d'écart sont configurables. Lorsque tous les seuils sont `NULL`, aucun seuil implicite n'est inventé : un écart strictement positif passe à `A_REVOIR`, tandis qu'une absence d'écart reste `CONFIRME`. Un écart `A_REVOIR` ouvre une seule tâche Direction via l'agrégateur existant `listMyTasks`, avec un identifiant stable ; il ne crée pas une seconde table de tâches.

## Lot A - socle local (21/09/2026)

La migration `202609210001_recipe_workflow_foundation.sql` ajoute les champs de rendement (portions ou rendement produit), coût matière, prix théorique TTC, prix TTC retenu et validation, ainsi que les tables de procédures, formes de préparation et historique de validation. Les formulaires utilisent le contrat Achats officiel pour afficher le prix normalisé quand il est disponible et ne lisent plus l’historique Stock comme source de prix. La base opérationnelle FT est le coût matière TTC.

La route `/recipes/to-validate` liste les fiches `en_attente`. Le modèle Excel officiel est désormais décrit dans le sous-lot A5 ci-dessous ; l’import reste exclusivement un import de brouillons et la validation TEST de la structure et du contrat prix n’est pas acquise.

État : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST non confirmé par l’audit documentaire courant ; VALIDÉ TEST non établi.

### Sous-lot A5 - import Excel, rapprochement et alias

Le circuit unique `/recipes/import` télécharge `MODELE_IMPORT_FICHES_TECHNIQUES.xlsx` avec exactement quatre feuilles : `FICHES`, `INGRÉDIENTS`, `DÉROULÉ` et `AIDE`. Le parseur valide les feuilles, colonnes, codes de fiche, modes `PORTIONS`/`RENDEMENT_PRODUIT`, valeurs `BRUT`/`NET`, quantités et ordres. Chaque fiche est enregistrée atomiquement par `stock.import_recipe_draft(jsonb,jsonb,jsonb,jsonb)` et reste `brouillon` avec `workflow_status = draft`.

Les ingrédients sont rapprochés automatiquement uniquement par nom exact non ambigu ou alias actif explicitement confirmé. Une suggestion approximative ne vaut jamais validation. Les ingrédients, unités, conversions et formes NET non résolus restent dans `pending_ingredients`, enrichi avec mode BRUT/NET, forme importée, observation et prix indicatif importé. L’écran `/recipes/pending-ingredients` conserve le rapprochement manuel, la correction de libellé et la création d’article par le service Catalogue existant ; la mémorisation d’un alias exige une case explicite. `recipe_import_aliases` interdit deux articles actifs pour un même libellé normalisé.

Le prix Excel est conservé uniquement dans `imported_indicative_price`. Les lignes résolues sont créées sans prix officiel et le prix indicatif n’alimente ni le contrat Achats A1, ni le coût FT, ni le Stock. La readiness existante doit ensuite constater les prix NORMAL absents ou non normalisables. Le résumé d’import expose fiches créées/non créées, doublons possibles, lignes reconnues/en attente, unités inconnues, conversions manquantes, formes à contrôler et erreurs.

Audit et permissions : la création, le rapprochement et les alias réutilisent `can_current_user_manage_recipes()` ; les acteurs et horodatages des recettes, pending et alias sont conservés. Aucun journal générique de recettes compatible n’a été identifié, donc aucun journal parallèle n’a été créé. La migration additive locale est `202609210004_recipe_import_aliases.sql` et dépend des structures locales A1-A4.

État : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST non confirmé par l’audit documentaire courant ; VALIDÉ TEST non établi.

### Sous-lot A4 - procédé et photo de dressage

La migration locale `202609210003_recipe_procedure_and_dressing_photo.sql` complète `recipe_steps` avec durées active/passive, observations et audit, et utilise un bucket Supabase Storage privé `recipe-assets` pour la photo principale. La photo est liée à chaque ligne/version de `recipes` par son chemin ; une nouvelle version peut donc porter une autre photo sans écraser la précédente. Les recettes historiques restent lisibles sans étapes ni photo. Le procédé manquant est signalé par readiness ; la photo reste facultative.

État : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST non confirmé par l’audit documentaire courant ; VALIDÉ TEST non établi.

### Sous-lot A3 - formes parées et sous-recettes

La migration locale `202609210002_recipe_subrecipes_and_snapshots.sql` étend `recipe_ingredients` avec le type de ligne, les snapshots de forme/rendement/prix et le coût de sous-recette. Une fonction SQL bloque les dépendances circulaires. L’éditeur propose les formes actives pour les lignes NET et les sous-recettes validées en rendement produit. Le coût enfant est recalculé récursivement depuis les prix NORMAL Achats ; une donnée enfant incomplète bloque le parent sans fallback.

État : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST non confirmé par l’audit documentaire courant ; VALIDÉ TEST non établi.

Points encore ouverts : test runtime avec des lignes `recipe_ingredients`, confirmation objectuelle du déploiement TEST du contrat prix `202609200001` et règle métier du PV théorique complet pour `RENDEMENT_PRODUIT`.

### Sous-lot A2 - rendements et calculs

Le mode portions utilise désormais 10 portions par défaut pour une nouvelle FT. Le mode rendement produit conserve quantité et unité de rendement. Les lignes peuvent être BRUT ou NET/paré ; un rendement NET valide calcule la quantité brute théorique sans arrondi intermédiaire. Le readiness bloque les rendements absents, nuls ou supérieurs à 100 % et les coûts incomplets.

État : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST non confirmé par l’audit documentaire courant ; VALIDÉ TEST non établi.

### Sous-lot A6 - workflow, validations et versionnement

La migration locale `202609210005_recipe_workflow_validation_and_versioning.sql` complète le workflow existant sans nouvel enum : `brouillon/draft` → `en_attente/submitted` → `en_attente/chef_validated` → `validee/approved`. Un retour Chef ou Direction utilise `status = brouillon` et `workflow_status = needs_correction`, ce qui représente l’état métier « à corriger » avec les conventions existantes. La soumission, les revues Chef/Direction, l’archivage et l’audit passent par des RPC `SECURITY DEFINER` à `search_path` fixé. Les écritures directes ne peuvent pas forger les transitions ni modifier le contenu soumis, validé ou archivé.

Le Chef cuisine actif doit valider avec son PIN personnel : la validation Chef et le renvoi en correction passent par une action sensible vérifiée côté base avec `stock.assert_sensitive_action`, puis sont inscrits dans l’historique d’audit. La Direction utilise exclusivement l’action sensible existante `recipes.final_validate` et son PIN personnel. Un retour exige un motif. La validation finale exige la validation Chef, recalcule le coût à partir des prix NORMAL Achats ou d’un provisoire normalisé lorsque le NORMAL manque, distingue prix absent et NORMAL non normalisable, fixe le PV retenu et fige les snapshots économiques. L’écran distingue coût actuel, coût à la validation et statut du coût.

Pour `PORTIONS`, le PV théorique TTC total est `(coût matière TTC total × 4) + (2 000 Ar × nombre de personnes)` et le PV théorique TTC par personne est `(coût matière TTC par personne × 4) + 2 000 Ar`. Pour `RENDEMENT_PRODUIT`, seul le coût TTC par unité de rendement est calculé ; aucun PV théorique complet ni majoration de 2 000 Ar n’est inventé. Le PV retenu est exprimé comme total pour `PORTIONS` et par unité de rendement pour `RENDEMENT_PRODUIT`.

Une fiche validée est immuable. L’édition crée une nouvelle version brouillon, liée à la racine par `parent_version_id`, sans hériter des validations actives ; la photo est copiée vers un chemin Storage distinct et l’action `version_created` est auditée. Les anciennes versions restent consultables. Le type legacy `BF` reste lisible mais toute nouvelle insertion BF est refusée. L’archivage est nominatif, protégé par PIN Direction et non destructif.

La route `/recipes/to-validate` est une vue dédiée avec filtres attente Chef, attente Direction, à corriger et validées récemment. `RecipeDetail` expose readiness, validations, historique, coût actuel/snapshot, statut du coût, PV et actions autorisées. La liste `/recipes` expose les colonnes économiques et les deux validations.

La page Direction `Mes validations` réutilise désormais ce workflow et affiche les fiches déjà validées par le Chef (`workflow_status = chef_validated`) qui attendent la validation finale Direction. Chaque ligne indique le nom, la version, la date de soumission et le statut du coût, avec un accès direct à la fiche. Après validation Direction, la fiche sort de cette liste ; un coût `PROVISOIRE` n'est pas, à lui seul, un motif de maintien dans les validations en attente. Les libellés métier communs sont : **Brouillon**, **À valider par Chef**, **À valider par Direction**, **À corriger** et **Validée par Direction**. Le statut du coût reste affiché séparément : **PROVISOIRE**, **CONFIRMÉ** ou **À REVOIR**. Une version validée est signalée comme verrouillée et sa modification passe par la création d'une nouvelle version.

État A6 : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST non confirmé par l’audit documentaire courant ; VALIDÉ TEST non établi.

### Lot A.1 - finition locale

Le modèle Excel officiel reste strictement limité à `FICHES`, `INGRÉDIENTS`, `DÉROULÉ` et `AIDE` : il ne contient aucune colonne de PV retenu TTC. L’import crée exclusivement des brouillons avec `retained_sale_price_ttc = NULL`; seul le flux Direction dans l’application peut renseigner le PV retenu officiel avec son PIN.

Le coût courant TTC prend maintenant en charge les sous-recettes validées de manière récursive et rapportée à leur rendement. Une mise à jour de prix NORMAL Achats recalcule le coût courant des parents sans créer de version. À la validation Direction, le coût unitaire de sous-recette utilisé est figé par ligne, de façon cohérente avec le total validé. La migration locale complémentaire est `202609210006_recipe_current_subrecipe_costs.sql`.

État A.1 : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi.

### UX transversale - saisie, brouillons et recherche d'articles

Une valeur numérique initiale de formulaire est sélectionnée au premier focus uniquement lorsqu'elle est encore la valeur par défaut. Une donnée chargée depuis une fiche existante n'est jamais sélectionnée ni effacée automatiquement. Cette règle est **VALIDÉE MÉTIER** et **CODÉE LOCALEMENT** pour les champs concernés des nouvelles FT ; son application aux autres formulaires reste progressive afin de préserver leurs contrats de saisie.

Une nouvelle FT est enregistrée dans `stock.recipes` avec le statut `brouillon` dès qu'un nom est renseigné et que le formulaire est structurellement valide. Le mécanisme réutilise les écritures de brouillon existantes : aucun second référentiel ni stockage parallèle n'est créé. Une fiche vide ne crée donc aucune ligne. Une fois créée, la fiche est reprise sur sa route d'édition et reste visible dans la liste des brouillons.

Le sélecteur d'ingrédients FT affiche une liste limitée dès l'ouverture puis affine la recherche dès le premier caractère. Il recherche les articles actifs marqués `usable_in_recipes` et les alias d'import confirmés. Le prix NORMAL ne filtre jamais un article : son absence est signalée après sélection et bloque la validation uniquement lorsqu'aucun provisoire normalisé n'est disponible. Les localisations, le stock physique et `article_locations` ne participent pas à ce filtre.

État : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi.

### Correctif pré-déploiement A1–A6

Les migrations A1–A6 ajoutent la permission Direction `recipes.final_validate`, réutilisent `can_current_user_manage_recipes()` pour les procédures et formes, empêchent tout PV retenu lors d’un import, contrôlent strictement les lignes article/sous-recette et figent le coût unitaire de sous-recette utilisé à la validation. La création d’une nouvelle version passe par une RPC transactionnelle unique. La lecture des prix Achats et des photos exige un profil actif. Ces corrections sont **CODÉES LOCALEMENT** ; leur état **DÉPLOYÉ TEST** n’est pas confirmé par le présent audit documentaire et leur état **VALIDÉ TEST** n’est pas établi.

État Lot A (A1 à A6) : VALIDÉ MÉTIER ; CODÉ LOCALEMENT ; DÉPLOYÉ TEST non confirmé par l’audit documentaire courant ; VALIDÉ TEST non établi. Aucun OP, planning ou objet Composition Lot B n’a été créé.

=== SYNCHRO CODEX ===
Module principal: Fiches techniques / Production / OP
Décisions validées: une fiche peut alimenter des besoins matières ; aucun OP fictif
Impacts sur les autres modules: besoins d’achat, stock disponible, consommation, coûts
Objets partagés concernés: articles, units, recipes, recipe_ingredients, events, event_recipes, purchase_needs
État d’implémentation: recettes/événements présents ; OP autonome non confirmé
Documents à mettre à jour: 00_MASTER_APP, 04_LIAISONS_ENTRE_MODULES, 06_POINTS_A_TRAITER
Points ouverts: définir l’objet OP, ses statuts, ses validations, sa consommation et son retour analytique
