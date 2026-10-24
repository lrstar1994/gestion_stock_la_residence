# STOCK PROD — RÉFÉRENTIEL COMMUN DE GOUVERNANCE DU DÉVELOPPEMENT

**Version : V2.1 consolidée**
**Date de validation proposée : 24 octobre 2026**
**Statut : V2.1 APPROUVÉE PAR LA DIRECTION — EN ATTENTE D’INTÉGRATION GIT**

**Périmètre : ACHATS · STOCKS · FT/OP · INT-1**
Le contenu a été approuvé par la Direction ; il reste en attente d’intégration Git et n’est pas encore entré officiellement en vigueur.

## 1. Objet du référentiel

Le présent document propose des règles communes pour les développements, corrections, migrations, tests, intégrations et déploiements de l’application STOCK PROD.

Il vise à :

- préserver l’intégrité des quatre projets Codex ;
- éviter les changements contradictoires entre modules ;
- protéger les données métier, financières et historiques ;
- assurer la traçabilité des décisions et des modifications ;
- distinguer développement local, validation technique et déploiement ;
- permettre à la Direction de contrôler les étapes sensibles.

Ces règles ne deviennent applicables qu’après adoption formelle selon la section 19.

## 2. Organisation des projets

Les quatre projets de développement sont distincts.

| Projet | Worktree connu |
|---|---|
| ACHATS | `_lotA_git_prepare_20260727` |
| STOCKS | `_stock_res_git_prepare_20260929` |
| FT/OP | `_op_git_prepare_20260928` |
| INT-1 | `_stock_res_int1` |

Racine connue : `C:\Users\EliteBook\Documents\Codex\`

Branche ACHATS connue : `codex/local-development-20260727`. Les branches des autres projets sont à vérifier avant intervention.

Un projet Codex ne modifie pas directement le worktree d’un autre projet. Les travaux intermodules sont coordonnés explicitement, en identifiant les projets concernés et l’ordre des interventions.

L’emplacement d’un objet dans un worktree ne détermine pas à lui seul son propriétaire fonctionnel. Celui-ci doit être établi à partir des décisions et contrats disponibles ; s’il ne peut pas l’être, il est indiqué « à confirmer ».

## 3. Autorité des décisions et rôles

### 3.1 Direction

La Direction valide notamment :

- les règles métier et leurs exceptions ;
- les modifications de contrats intermodules ;
- les opérations sensibles sur les données ;
- les changements significatifs de périmètre ;
- les passages vers TEST et Production ;
- les opérations Git sensibles lorsqu’elles sont nécessaires ;
- l’adoption et l’évolution du référentiel commun.

### 3.2 ChatGPT — coordination

ChatGPT aide à formaliser les décisions, préparer les missions, examiner les rapports, repérer les contradictions et coordonner la cohérence fonctionnelle des quatre projets.

Une recommandation de coordination ne vaut pas autorisation d’exécution.

### 3.3 Codex — exécution technique

Codex intervient dans le périmètre explicitement autorisé. Il vérifie le dépôt, respecte les décisions, signale les contradictions, limite ses changements à la mission, exécute les contrôles demandés et rapporte les preuves et limites.

Codex n’élargit pas de lui-même une mission à d’autres modules, environnements ou opérations Git.

## 4. Hiérarchie des références et contradictions

Après adoption du présent référentiel, les missions respectent les références suivantes :

1. les contraintes de sécurité et les autorisations applicables ;
2. les décisions métier explicitement validées par la Direction ;
3. le présent référentiel ;
4. les contrats intermodules validés ;
5. les spécifications et documents techniques des modules ;
6. le prompt de mission, pour les modalités d’exécution qui ne contredisent pas les références supérieures.

Une exception doit être explicite, limitée et autorisée par la Direction. Un prompt ne peut pas transformer une autorisation en une autorisation plus large par simple implication.

En cas de contradiction non résolue, Codex arrête les modifications concernées, décrit les textes en conflit et attend l’arbitrage avant de poursuivre ces modifications.

## 5. Contrôles préalables

Avant toute modification, Codex doit :

1. se placer dans le worktree désigné ;
2. vérifier le chemin courant, la racine Git, la branche et le HEAD ;
3. examiner `git status` et préserver les changements préexistants, suivis ou non ;
4. consulter les documents pertinents de `/docs` ;
5. identifier les migrations actives, désactivées, historiques et HOLD ;
6. rechercher les objets et contrats partagés concernés ;
7. évaluer les impacts sur ACHATS, STOCKS, FT/OP et INT-1 ;
8. repérer les dépendances techniques et fonctionnelles ;
9. confirmer que les actions prévues restent dans les autorisations reçues.

Si le référentiel annoncé est absent, incomplet ou différent de la version attendue, Codex le signale et ne le présente pas comme un texte officiel consolidé.

## 6. Classification des missions

Chaque prompt comporte un bloc **CONTEXTE TRANSVERSAL CODEX** précisant le module principal, le projet, le worktree, la branche connue, le type de mission, les impacts, les dépendances et le statut d’exécution.

### 6.1 SYNCHRO UNIQUEMENT

Mission de lecture, audit, analyse, comparaison, documentation ou préparation de contrats. Aucune modification de code, migration ou donnée n’est autorisée par défaut. Une modification documentaire doit être expressément incluse dans le périmètre.

### 6.2 SYNCHRO + IMPLÉMENTATION

Mission autorisant des modifications locales précises. Le prompt définit le périmètre, les comportements attendus, les tests, les interdictions, les conditions d’arrêt et les livrables.

Aucune classification n’autorise implicitement un déploiement.

## 7. Préservation et autorisations Git

Les modifications préexistantes doivent être conservées, qu’elles soient suivies ou non par Git. Une modification non committée ne peut pas être écrasée au motif qu’elle n’appartient pas à un commit.

Sans autorisation explicite, sont interdits :

- `git reset` destructif et `git clean` ;
- la suppression de fichiers préexistants ;
- le changement de branche ;
- commit, push, merge, rebase ou cherry-pick.

Les autorisations suivantes sont **distinctes et non implicites** :

- autorisation de commit ;
- autorisation de push ;
- autorisation de merge ou cherry-pick ;
- autorisation d’intervention sur TEST ;
- autorisation d’intervention en Production.

La préparation de fichiers, les tests et la revue ne valent pas autorisation de commit. Une autorisation donnée pour une étape ne permet pas automatiquement la suivante.

Avant et après la mission, le rapport distingue autant que possible les changements préexistants des changements de la mission.

## 8. Gouvernance des migrations SQL

Les migrations sont classées selon leur situation réelle :

- **actives** : présentes dans le chemin normal d’exécution ;
- **HOLD** : préparées mais non autorisées à l’application ;
- **historiques** : conservées comme références ou pour compatibilité ;
- **désactivées** : lorsqu’un mécanisme explicite de désactivation existe.

Le nom d’un répertoire ou d’un fichier ne prouve pas qu’une migration a été appliquée sur un environnement.

Une migration HOLD peut être examinée et testée localement, mais ne peut être activée ou déplacée vers le chemin actif sans autorisation. Sa présence locale ne prouve pas sa présence sur TEST ou Production.

Toute nouvelle migration est examinée avec ses dépendances, son ordre d’application, ses privilèges, ses politiques RLS, ses contrats intermodules et la compatibilité des données historiques.

Une migration déjà appliquée n’est pas réécrite silencieusement. Une migration HOLD explicitement protégée par la mission ne peut être modifiée dans ce cadre.

## 9. Environnements et déploiements

### 9.1 Développement local

Les changements et tests locaux sont limités au périmètre autorisé. Les bases temporaires utilisées pour les tests doivent être isolées et leur périmètre décrit.

### 9.2 Supabase TEST

Toute écriture, migration, correction de données ou déploiement sur TEST exige une autorisation distincte. Un audit en lecture seule n’autorise aucune écriture.

### 9.3 Production

Toute intervention en Production nécessite une autorisation spécifique de la Direction, distincte de l’autorisation TEST.

La réussite de tests locaux ne permet jamais de déduire une autorisation de déploiement.

## 10. Tests, preuves et niveaux de validation

Les rapports distinguent l’analyse statique, la compilation, les tests unitaires, d’intégration, transactionnels et de concurrence, ainsi que les essais sur fixtures ou schéma réduit et sur environnement représentatif. Les tests non exécutés sont indiqués comme tels.

Un mécanisme PIN simulé ne prouve pas la sécurité du mécanisme réel. Deux appels successifs ne prouvent pas la concurrence. Une migration exécutée sur un schéma minimal n’est pas automatiquement validée sur le schéma complet.

### 10.1 Statuts de validation

Les niveaux ci-dessous décrivent des preuves techniques, pas une adoption métier implicite :

| Statut | Signification et preuve attendue | Limite ou autorité |
|---|---|---|
| `STATIC_OK` | Contrôles statiques déclarés exécutés et réussis. | Ne prouve pas l’exécution SQL ni le fonctionnement métier. |
| `LOCAL_DB_OK` | Contrôles SQL réalisés sur la base locale déclarée, avec périmètre et résultat documentés. | Ne prouve pas la représentativité de TEST ou de Production. |
| `LOCAL_FUNCTIONAL_OK` | Scénarios fonctionnels locaux déclarés exécutés et réussis. | Ne constitue pas une recette métier sur TEST. |
| `PASS_LOCAL` | Les contrôles statiques, base locale et fonctionnels prévus pour le lot sont réussis, dans le périmètre annoncé. | N’implique ni intégration ni autorisation TEST. |
| `PASS_INTEGRATION` | Tests locaux d’intégration réussis après l’intégration autorisée des changements concernés, selon la section 16. | N’implique pas une validation sur TEST. |
| `TEST_DB_OK` | Vérifications techniques sur la base TEST réellement ciblée, avec preuves et périmètre explicites. | N’équivaut pas à une acceptation métier. |
| `PASS_METIER_TEST` | Scénarios métier convenus exécutés sur TEST avec résultats et limites consignés. | Ne remplace pas l’approbation métier formelle de la Direction. |
| `BUSINESS_VALIDATED` | Validation métier explicitement donnée par l’autorité compétente pour le périmètre défini. | N’autorise pas à elle seule Production. |

Les statuts de blocage ou d’inachèvement restent disponibles : `BLOCKED`, `PARTIAL_LOCAL` et `INTEGRATION_BLOCKED`. Chaque statut est accompagné des preuves, limites et éventuelles dépendances.

Correspondance des anciens libellés :

- `LOCAL_SQL_VALIDATED` ne vaut `LOCAL_DB_OK` que si les preuves et le périmètre satisfont la définition de ce dernier ; aucune requalification rétroactive automatique.
- `TEST_VALIDATED` doit être précisé comme `TEST_DB_OK`, `PASS_METIER_TEST`, ou les deux, selon les preuves réelles.
- `PRODUCTION_DEPLOYED` décrit un fait de déploiement ; il ne remplace pas les niveaux de validation précédents.

## 11. Sécurité des opérations sensibles

Les opérations sensibles sont sécurisées côté serveur selon leur nature : authentification, rôle, permissions, PIN lorsque requis, état métier, transaction atomique, idempotence, verrouillage, audit et protections contre les écritures directes.

Le frontend n’est pas une frontière de sécurité suffisante. L’analyse porte, selon le contrat, sur les RPC `SECURITY DEFINER`, leurs privilèges `EXECUTE`, leurs chemins de recherche, les politiques RLS et les accès aux objets internes.

Les secrets et identifiants d’accès ne figurent pas dans les rapports ou journaux partagés.

## 12. Propriété fonctionnelle, worktrees et registre des objets partagés

Le **worktree** est l’emplacement Git où une modification est effectuée. La **propriété fonctionnelle** est la responsabilité de définir et faire évoluer un objet ou un contrat. Ces deux notions sont distinctes.

Un objet présent dans INT-1 peut appartenir fonctionnellement à STOCKS ou à un autre module. Cela vaut notamment pour RES-2, `stock_movements`, l’outbox, les writers, RPC, tables, vues et contrats d’intégration. Aucune responsabilité ne doit être attribuée sur la seule base d’un chemin de fichier. Toute propriété non démontrée est marquée « à confirmer ».

Un **registre commun des objets partagés** doit être consulté avant toute modification d’un tel objet et actualisé lors d’une évolution de contrat autorisée. Il indique au minimum :

- nom technique et nature de l’objet ;
- propriétaire fonctionnel ;
- projet ou worktree chargé de l’implémentation ;
- modules consommateurs ;
- contrat attendu ;
- migration source ou emplacement du code ;
- dépendances ;
- tests de non-régression ;
- statut de validation ;
- dernière évolution connue du contrat.

Les informations non établies restent « à confirmer ». Une modification respecte le propriétaire fonctionnel établi et les contrats des consommateurs.

## 13. Intégrité métier et historique

Les développements préservent les identifiants métier, les relations entre dossiers, les décisions validées, les mouvements physiques et financiers, les journaux, les audits, les allocations, les réservations, la provenance des besoins et les événements irréversibles.

Une correction technique ne modifie pas silencieusement des données historiques et ne produit pas d’effet métier non prévu. Toute régularisation de données est identifiée et autorisée séparément.

## 14. Contradictions et blocages

En cas de contradiction ou d’incertitude critique :

1. arrêter les modifications concernées ;
2. conserver l’état existant ;
3. identifier les textes et objets en conflit ;
4. préciser les fichiers, fonctions et modules touchés ;
5. évaluer les conséquences et dépendances ;
6. présenter les options de résolution ;
7. attendre l’arbitrage requis.

Un arrêt n’autorise pas la suppression ou la restauration de changements déjà réalisés. Toute restauration nécessite une instruction explicite.

## 15. Rapports de mission

Le rapport couvre, selon le périmètre :

**A. État initial :** worktree, branche, HEAD, état Git, documents et migrations concernés.

**B. Travail :** fichiers créés ou modifiés, changements réalisés et écarts par rapport au plan.

**C. Tests :** contrôles exécutés, résultats, preuves, limites et tests non exécutés.

**D. Impacts intermodules :** ACHATS, STOCKS, FT/OP et INT-1.

**E. Risques et blocages :** défauts établis, dépendances et arbitrages nécessaires.

**F. Statut final :** niveau réel de validation, migrations actives ou HOLD, opérations d’environnement réalisées ou non et étape suivante proposée.

## 16. Processus de développement par petits lots et intégration

Le cycle obligatoire est :

**Petit lot → test → correction → sécurisation Git → lot suivant.**

Chaque lot a un périmètre limité et vérifiable. Ses tests sont exécutés avant de le déclarer terminé. Les anomalies constatées sont corrigées dans le périmètre autorisé, puis les tests concernés sont réexécutés. La sécurisation Git est une étape distincte et contrôlée ; elle requiert les autorisations Git correspondant à l’action envisagée. Le lot suivant ne commence qu’après revue et décision de passage. Toute dépendance bloquante entraîne l’arrêt du travail concerné.

Le processus général est :

**Décision métier → spécification → audit technique → implémentation locale → tests locaux → revue → autorisation TEST → validation TEST → autorisation Production → déploiement contrôlé.**

Après chaque merge ou cherry-pick autorisé, un test d’intégration local est obligatoire et précède toute intervention sur TEST. Il vérifie, selon le périmètre, la compilation, les migrations, les contrats et objets partagés, le fonctionnement métier, les non-régressions, les conflits résolus et les modifications inattendues.

Un lot validé isolément n’est pas automatiquement validé après intégration. Le statut `PASS_INTEGRATION` n’est attribué que lorsque les conditions correspondantes sont satisfaites et documentées.

## 17. Gestion des versions et référentiel maître

Toute version du référentiel précise son numéro, sa date, son statut, l’autorité l’ayant validée, son chemin Git, le commit contenant effectivement le texte complet et l’historique des modifications.

Un commit ne devient pas la référence officielle d’une version si son contenu ne correspond pas au texte adopté. Une nouvelle version distingue les règles maintenues, ajoutées, modifiées et supprimées.

Un référentiel maître unique fait autorité. Son emplacement documentaire vérifié est :

- **Worktree documentaire maître :** `C:\Users\EliteBook\Documents\Codex\_stock_prod_governance_20261020`
- **Branche :** `codex/governance-v2-20261020`
- **Fichier maître :** `docs/00_GOUVERNANCE_DEVELOPPEMENT.md`

Ces références identifient l’emplacement du document maître sans attribuer la propriété fonctionnelle de la gouvernance à ACHATS ou à un autre module. Le commit historique `157f4f013a84f02a26d7e7fd3331eaceabbd054e` demeure identifié comme un bootstrap incomplet, et non comme la référence officielle de la V2.1. Le SHA officiel V2.1 reste à déterminer après commit autorisé et vérification du contenu enregistré.

Des copies synchronisées et vérifiées doivent être disponibles dans les projets concernés. La synchronisation vérifie la version et le contenu réel, pas seulement le nom du fichier. Les modalités de diffusion et de vérification des copies sont documentées.

La gouvernance est transversale. Aucun projet, notamment ACHATS, n’en acquiert la propriété fonctionnelle du fait qu’il prépare ou héberge un document. La désignation technique définitive du worktree maître sera vérifiée lors d’une mission ultérieure.

## 18. Dispositions transitoires

À la date de préparation de cette proposition :

- Le commit historique `157f4f013a84f02a26d7e7fd3331eaceabbd054e` contient un bootstrap documentaire avec un emplacement réservé, et non le texte consolidé complet. Il ne constitue pas le référentiel V2 consolidé applicable.
- Le lot 1 ACHATS conserve le statut `PARTIAL_LOCAL`. Son correctif local du trigger est conservé dans son état actuel, sans que cela constitue une validation de déploiement.
- Les migrations suivantes du lot 1 sont présentes dans `supabase/migrations_hold` et restent en HOLD :
  - `202609250003_cash_purchase_buyer_directory_atomic.sql` : répertoire des acheteurs et contrat associé au décaissement espèces ;
  - `20261021100000_achats_v1_cash_purchase_cancel_status.sql` : état d’annulation des achats espèces ;
  - `20261021100100_achats_v1_cash_purchase_transition_security.sql` : sécurisation des transitions de validation, refus et annulation avant décaissement.
- La migration distincte `202610030003_cash_purchase_stock_handover_transactional.sql` est également présente dans `supabase/migrations_hold` et reste en HOLD. Son en-tête la décrit comme la finalisation transactionnelle de la remise espèces pour l’intégration au stock, avec dépendance à STOCKS `202610030001`.
- La présence de ces migrations dans le dépôt ne prouve pas qu’elles ont été appliquées sur Supabase TEST ou Production.
- Aucune autorisation de déploiement ne découle de ces dispositions.

L’adoption d’une nouvelle gouvernance n’a aucun effet rétroactif automatique. Elle n’autorise ni n’impose commit, push, merge ou cherry-pick, activation HOLD, déploiement TEST ou Production, reprise d’un lot suspendu, suppression ou restauration de modifications, ni requalification de tests antérieurs. Toute régularisation doit être examinée et autorisée séparément.

## 19. Entrée en vigueur

Le contenu de la V2.1 a été approuvé par la Direction le 24 octobre 2026. Cette approbation ne vaut pas autorisation de commit, push, merge, cherry-pick ou déploiement.

La gouvernance n’entre officiellement en vigueur qu’après :

1. intégration du texte approuvé dans le dépôt documentaire désigné ;
2. vérification que le contenu enregistré correspond au texte approuvé ;
3. identification du commit contenant ce contenu vérifié ;
4. communication de cette référence aux quatre projets Codex.

Le SHA officiel V2.1 reste à déterminer après commit autorisé et vérification du contenu. Jusqu’à cette entrée en vigueur, le statut du document demeure : **V2.1 APPROUVÉE PAR LA DIRECTION — EN ATTENTE D’INTÉGRATION GIT**.
