# Décisions métier validées

Ce document regroupe les décisions réutilisables. Le statut technique est indiqué séparément.

| Décision | Statut métier | État technique connu |
|---|---|---|
| `Besoins d’achat` est le point d’entrée unique | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; DÉPLOYÉ TEST selon les écrans |
| Une demande comporte des lignes traçables, non fusionnées physiquement | VALIDÉ MÉTIER | CODÉ LOCALEMENT |
| Origines : renouvellement, production/fiche, mise en place, opportunité | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; DÉPLOYÉ TEST déclaré via 180005 |
| Utilisation prévue est distincte d’une localisation physique | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; DÉPLOYÉ TEST déclaré |
| Réception initiale au Magasin principal | VALIDÉ MÉTIER | CODÉ LOCALEMENT dans les parcours réception/stock |
| TVA par ligne : HT+TVA, TTC, sans TVA | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; DÉPLOYÉ TEST déclaré |
| `estimated_payable_amount` est la base payable, avec fallback historique `estimated_cost` | VALIDÉ MÉTIER | CODÉ LOCALEMENT |
| Le contrôle Caisse/Contrôleur est atomique et protégé par PIN | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; DÉPLOYÉ TEST par lots 3B |
| Monnaie et régularisation fournisseur sont deux circuits distincts | VALIDÉ MÉTIER | CODÉ LOCALEMENT |
| Une régularisation fournisseur unique suit une marchandise refusée déjà payée | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; déploiement TEST déclaré |
| Stock courant dérivé des mouvements | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; migrations Stocks manuelles TEST déclarées |
| Direction lecture globale ; Contrôleur lecture globale prévue ; autres rôles restreints | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; déploiement TEST à vérifier par historique |
| EN TRANSIT est technique et exclu des sélecteurs ordinaires | VALIDÉ MÉTIER | CODÉ LOCALEMENT |
| Inventaire : corrections à la validation, clôture sans nouveau mouvement | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; TEST à confirmer |
| Transfert normal : total établissement constant ; perte confirmée traitée séparément | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; TEST à confirmer |
| Aucun OP fictif tant que le modèle OP n’est pas défini | VALIDÉ MÉTIER | Règle documentaire à respecter |
| La validation Direction d’un OP et la validation Direction des besoins d’achat qui en découlent sont deux étapes obligatoires et indépendantes | VALIDÉ MÉTIER | CODÉ LOCALEMENT non établi ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi |
| Toutes les versions de FT utilisées par un OP doivent être définitivement validées par la Direction avant validation de l’OP | VALIDÉ MÉTIER | CODÉ LOCALEMENT non établi ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi |
| Après validation OP, la magasinière prépare les `purchase_needs` ; la Direction décide ensuite l’achat direct ou la commande fournisseur, avec les validations propres aux commandes et décaissements | VALIDÉ MÉTIER | CODÉ LOCALEMENT non établi ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi |
| Lors d’une révision OP à la baisse, le Chef peut libérer immédiatement les réservations excédentaires de produits finis et sous-recettes après confirmation ; la validation Direction de la révision n’est pas préalable | VALIDÉ MÉTIER | Mécanisme commun de réservation, libération atomique et audit non identifié ; CODÉ LOCALEMENT non établi ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi |
| Lors d’une révision OP à la hausse, les réservations approuvées sont conservées ; le Chef peut réserver immédiatement la quantité supplémentaire réellement disponible, partiellement si nécessaire, sans fabrication ni achat avant validation Direction | VALIDÉ MÉTIER | Contrat commun de réservation non implémenté ; CODÉ LOCALEMENT non établi ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi |
| Après refus Direction d’une révision à la hausse, aucune libération automatique ni expiration liée à l’âge du brouillon n’a lieu ; le Chef décide de libérer ou de maintenir temporairement les réservations supplémentaires, avec revue quotidienne et audit des quantités | VALIDÉ MÉTIER | Règle documentaire ; contrat technique non implémenté ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi |
| Un OP ne possède qu’une proposition de révision active en attente ; une nouvelle modification actualise cette proposition, les demandes précédentes restent historisées et ne sont jamais cumulées | VALIDÉ MÉTIER | Modèle OP et contrat de réservation non implémentés ; DÉPLOYÉ TEST non établi ; VALIDÉ TEST non établi |
| Le prix réel normal officiel provient d’une ligne finale admissible et qualifiée, avec unité normalisée et TVA conservée | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; DÉPLOYÉ TEST non effectué ; VALIDÉ TEST non effectué |
| Les classifications promotionnelle et exceptionnelle exigent un motif et une qualification Direction ; aucun backfill historique | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; DÉPLOYÉ TEST non effectué ; VALIDÉ TEST non effectué |
| `normalized_unit_price` peut être NULL si la conversion vers l’unité de référence n’est pas fiable ; FT/OP doit signaler un coût incomplet | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; DÉPLOYÉ TEST non effectué ; VALIDÉ TEST non effectué |
| Workflow FT : soumission, validation Chef, validation Direction avec PIN, correction, validation finale | VALIDÉ MÉTIER | CODÉ LOCALEMENT via 202609210005 ; DÉPLOYÉ TEST non effectué ; VALIDÉ TEST non effectué |
| Base opérationnelle FT = coût matière TTC. PV théorique PORTIONS total = (coût matière TTC total × 4) + (2 000 Ar × nombre de personnes) ; PV théorique TTC/personne = (coût matière TTC/personne × 4) + 2 000 Ar ; aucune formule complète inventée pour RENDEMENT_PRODUIT | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; DÉPLOYÉ TEST non confirmé par l’audit documentaire courant ; VALIDÉ TEST non établi |
| Une FT validée est immuable et toute évolution métier crée une nouvelle version ; les prix courants ne créent pas de version | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; DÉPLOYÉ TEST non effectué ; VALIDÉ TEST non effectué |
| Le type BF reste historique et lisible, mais aucune nouvelle BF ne peut être créée dans le Lot A | VALIDÉ MÉTIER | CODÉ LOCALEMENT ; DÉPLOYÉ TEST non effectué ; VALIDÉ TEST non effectué |

## Règle de changement

Une décision ne devient pas automatiquement une autorisation de coder. Toute modification d’un objet partagé doit être accompagnée du bloc SYNCHRO et d’une mise à jour des documents concernés.

=== SYNCHRO CODEX ===
Module principal: gouvernance transverse
Décisions validées: tableau ci-dessus
Impacts sur les autres modules: explicites dans 04_LIAISONS_ENTRE_MODULES
Objets partagés concernés: tous les objets listés dans 00_MASTER_APP
État d’implémentation: chaque ligne distingue métier et technique
Documents à mettre à jour: ce fichier et le module propriétaire
Points ouverts: validations TEST manquantes et décisions OP
