# STOCK / PROD — CRÉATION DU RÉFÉRENTIEL COMMUN DE GOUVERNANCE V2

TYPE DE MISSION : LOT DOCUMENTAIRE UNIQUEMENT

OBJECTIF UNIQUE :
Créer et préparer dans Git le fichier commun :

docs/00_GOUVERNANCE_DEVELOPPEMENT.md

contenant la version 2 consolidée de la gouvernance STOCK / PROD.

IMPORTANT :
Cette mission ne doit modifier aucun code métier, aucune migration, aucune RPC, aucune table, aucun test applicatif.

Elle ne doit pas perturber le chantier métier du chat dans lequel elle est exécutée.

==================================================
1. PRÉFLIGHT OBLIGATOIRE
==================================================

Avant toute action :

- vérifier le chemin courant ;
- vérifier la racine Git ;
- vérifier la branche active ;
- afficher le HEAD ;
- afficher `git status --short` ;
- identifier les modifications préexistantes ;
- vérifier si `docs/00_GOUVERNANCE_DEVELOPPEMENT.md` existe déjà ;
- vérifier les règles `.gitignore` applicables à `/docs`.

NE MODIFIER AUCUNE MODIFICATION PRÉEXISTANTE.

Interdictions :

- git reset ;
- git clean ;
- git stash ;
- checkout destructif ;
- écrasement d’un fichier préexistant sans analyse ;
- modification d’un autre worktree.

==================================================
2. BRANCHE DOCUMENTAIRE DÉDIÉE
==================================================

Ne pas créer le fichier directement sur la branche métier active.

Préparer une branche documentaire dédiée, proposée :

codex/governance-v2-20261020

Avant de créer cette branche :

- vérifier qu’elle n’existe pas déjà localement ;
- vérifier qu’elle n’existe pas déjà sur le remote ;
- vérifier que le changement de branche ne risque pas d’emporter ou de masquer des modifications non commitées.

SI LE WORKTREE ACTUEL CONTIENT DES MODIFICATIONS NON COMMITTÉES ET QUE LE CHANGEMENT DE BRANCHE N’EST PAS SÛR :

STOP.

Ne pas stash.
Ne pas commit ces modifications.
Ne pas reset.

Me signaler le blocage et proposer la manière la plus sûre de créer cette branche documentaire.

==================================================
3. FICHIER À CRÉER
==================================================

Créer uniquement :

docs/00_GOUVERNANCE_DEVELOPPEMENT.md

avec exactement le contenu V2 fourni ci-dessous.

Ne pas :
- reformuler ;
- raccourcir ;
- ajouter de nouvelles règles ;
- modifier la terminologie ;
- corriger des décisions métier ;
- inventer des propriétaires supplémentaires.

Le texte de référence commence après :

--- DEBUT GOUVERNANCE V2 ---

[COLLER ICI LA VERSION V2 CONSOLIDÉE COMPLÈTE]

--- FIN GOUVERNANCE V2 ---

==================================================
4. CONTRÔLES
==================================================

Après création :

1. vérifier que seul le fichier attendu a été créé ou modifié dans cette mission ;
2. vérifier que le fichier n’est pas ignoré par Git ;
3. afficher :
   - `git status --short`
   - `git diff -- docs/00_GOUVERNANCE_DEVELOPPEMENT.md`
4. exécuter :
   - `git diff --check`
5. confirmer que le Markdown ne présente pas d’anomalie évidente ;
6. vérifier qu’aucun fichier métier, SQL, migration ou test n’a été modifié.

==================================================
5. RAPPORT ATTENDU
==================================================

Produire un rapport court indiquant :

- worktree courant ;
- branche de départ ;
- branche documentaire créée ou proposée ;
- HEAD de départ ;
- état Git avant ;
- état Git après ;
- fichier créé ;
- résultat de `git diff --check` ;
- éventuels problèmes `.gitignore` ;
- éventuels conflits ou blocages.

Verdict attendu :

- READY_FOR_COMMIT_REVIEW
ou
- BLOCKED_GOVERNANCE_SETUP

==================================================
6. GIT — AUCUN COMMIT POUR L’INSTANT
==================================================

NE PAS COMMITTER.

NE PAS PUSHER.

NE PAS MERGER.

NE PAS CHERRY-PICKER.

S’arrêter après la revue du diff.

Proposer uniquement le message de commit suivant :

docs(governance): add STOCK PROD development governance v2

Attendre mon autorisation explicite avant tout commit.

--- FIN DU FICHIER ---


Cette autorisation constitue une exception de bootstrap AVANT adoption de la gouvernance V2.
Elle ne vaut pour aucune autre mission.

==================================================
1. NE PAS TOUCHER À INT-1
==================================================

Le worktree suivant doit rester strictement inchangé :

C:\Users\EliteBook\Documents\Codex\_stock_res_int1

Branche :
codex/stock-res-int1

Ne pas :
- stash ;
- reset ;
- clean ;
- commit ;
- changer de branche ;
- modifier un fichier ;
- déplacer ses modifications non commitées.

==================================================
2. CRÉER UN WORKTREE DOCUMENTAIRE SÉPARÉ
==================================================

Créer, si Git le permet sans toucher au worktree INT-1 :

C:\Users\EliteBook\Documents\Codex\_stock_prod_governance_20261020

Branche :

codex/governance-v2-20261020

Base autorisée pour cette opération :

f6fdbf18c1c227097c329b4cead64b80a6ad8306

Avant création :
- vérifier que le chemin du nouveau worktree n’existe pas déjà ;
- vérifier que la branche locale n’existe pas déjà ;
- ne pas dépendre du remote puisque GitHub est actuellement inaccessible.

Si la création nécessite de modifier, masquer ou déplacer les changements INT-1 :
STOP.

==================================================
3. DOCS EST IGNORÉ : TRAITEMENT MINIMAL
==================================================

Le préflight a constaté :

docs/*

dans les règles d’ignore.

Ne pas supprimer cette règle globale.

Déterminer l’endroit exact où elle est définie.

Préparer uniquement l’exception Git minimale nécessaire pour suivre :

docs/00_GOUVERNANCE_DEVELOPPEMENT.md

et, si techniquement nécessaire pour les futurs rapports validés, NE PAS encore ajouter d’autres exceptions dans cette mission.

Le diff doit rester minimal.

==================================================
4. CRÉER LA GOUVERNANCE V2
==================================================

Créer :

docs/00_GOUVERNANCE_DEVELOPPEMENT.md

avec exactement la version V2 consolidée que je vais fournir immédiatement après ce prompt.

Ne pas reformuler.
Ne pas compléter.
Ne pas créer de nouvelle règle.
Ne pas modifier les décisions.

ATTENDS LE TEXTE COMPLET V2 AVANT DE CRÉER LE FICHIER.

==================================================
5. PÉRIMÈTRE STRICT
==================================================

Dans le nouveau worktree, les seules modifications autorisées sont :

1. docs/00_GOUVERNANCE_DEVELOPPEMENT.md
2. la modification minimale de .gitignore strictement nécessaire pour que ce fichier soit suivi.

Aucun :
- SQL ;
- migration ;
- TypeScript ;
- test applicatif ;
- RPC ;
- package ;
- configuration Supabase ;
- fichier métier.

==================================================
6. CONTRÔLES
==================================================

Après création :

- afficher chemin courant ;
- branche ;
- HEAD ;
- git status --short ;
- git check-ignore -v docs/00_GOUVERNANCE_DEVELOPPEMENT.md ;
- git diff --check ;
- diff exact de .gitignore si modifié ;
- diff exact de docs/00_GOUVERNANCE_DEVELOPPEMENT.md ;
- confirmer que le worktree INT-1 initial est resté inchangé.

==================================================
7. VERDICT
==================================================

Verdict attendu :

READY_FOR_COMMIT_REVIEW

ou

BLOCKED_GOVERNANCE_BOOTSTRAP

==================================================
8. AUCUN COMMIT / PUSH
==================================================

NE PAS COMMITTER.
NE PAS PUSHER.
NE PAS MERGER.
NE PAS CHERRY-PICKER.

Message de commit proposé uniquement :

docs(governance): add STOCK PROD development governance v2

S’arrêter après le rapport.
