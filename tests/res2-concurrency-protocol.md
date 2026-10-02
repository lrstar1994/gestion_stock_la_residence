# RES-2 — protocole à deux sessions PostgreSQL

Statut : protocole local. Aucune autorisation d'exécution sur TEST. Une transaction
READ COMMITTED par appel RPC ; ne pas composer plusieurs appels d'écriture dans
des ordres arbitraires au sein d'une même transaction applicative.

## Exécution reproductible isolée

`node tests/run-res2-local.mjs`

Le lanceur crée un cluster temporaire avec `initdb`, uniquement sur `127.0.0.1`
et un port libre. Il utilise PostgreSQL installé localement (`RES2_PG_BIN` peut
indiquer le répertoire des binaires ; aucun endpoint distant n'est accepté).
Il importe RES-1 et RES-2 dans ce cluster, exécute la validation transactionnelle,
puis ouvre **deux processus psql distincts**, donc deux sessions PostgreSQL.
Il vérifie dans `pg_stat_activity` que B attend réellement un verrou détenu par A
avant de valider A. `lock_timeout=10s`, `statement_timeout=15s` font échouer un
blocage anormal. Le cluster est arrêté dans `finally` ; les logs restent dans le
répertoire temporaire affiché. Aucun fichier de migration historique n'est modifié.

Le propriétaire `postgres` de la fixture est NOSUPERUSER BYPASSRLS. Les RPC sont
appelées sous `SET ROLE authenticated` avec un acteur de fixture ; les helpers
de verrouillage ne sont appelés directement que par postgres. Les contrôles
simulent `auth.uid()` via un GUC de test, pas via le service Auth Supabase réel.

## Scénarios et preuves attendues

| Cas | Session A, transaction ouverte | Session B, transaction distincte | Vérification après COMMIT A puis B |
|---|---|---|---|
| A | reserve, request X, quantité 1 | même X, mêmes paramètres/acteur | B attend ; même résultat enregistré ; une réservation, un segment, un événement |
| B | reserve, request Y, quantité 1 | même Y, quantité 2 | B attend puis erreur `RESERVATION_REQUEST_PAYLOAD_MISMATCH` ; aucune mutation B |
| C/D | reserve, request Z, quantité 4, stock libre 4 | autre request W, quantité 4, même article/localisation | B attend ; A réserve 4, B réserve 0 avec shortage 4 |
| E/F | helper, clés nouvelles K1 puis K2 | helper, mêmes clés en entrée K2 puis K1 | insertions et verrous triés ; B attend ; aucun deadlock |
| G/H | ensemble des réservations C/D | lecture après les deux commits | somme protégée = stock physique 6, jamais 10 ; sérialisation démontrée |

Les clés du cas E portent deux ressources et deux localisations ; elles sont
absentes avant le test, afin de vérifier aussi l'ordre des insertions concurrentes.
Le test A contrôle le nombre d'événements et de segments, pas seulement les retours.

## Reproduction manuelle du principe

Dans une base **locale jetable** préparée avec la fixture, prendre les UUID
article/localisation/acteur dans `res2-local-fixture.sql` et deux request UUID neufs.
Ouvrir deux psql sur le même hôte loopback/port/base, avec des `application_name`
distincts. Dans chaque session :

```sql
SET ROLE authenticated;
SET request.jwt.claim.sub = '50000000-0000-0000-0000-000000000001';
SET lock_timeout = '10s';
SET statement_timeout = '15s';
BEGIN ISOLATION LEVEL READ COMMITTED;
-- Appel du cas choisi ci-dessus ; ne pas COMMIT immédiatement dans A.
```

Lancer l'appel B pendant que la transaction A reste ouverte. Constater l'attente
de B depuis une connexion d'observation propriétaire, puis faire COMMIT dans A :

```sql
SELECT pid, application_name, wait_event_type, wait_event
FROM pg_stat_activity WHERE application_name IN ('res2_A','res2_B');
```

Valider B pour les succès ; faire ROLLBACK pour l'erreur attendue du cas B.
Comparer les résultats avec `stock.stock_reservation_requests`, compter les
segments/événements et rapprocher les protections actives/en transit de
`stock.stock_location_view`. Ne jamais remplacer ces sessions par deux appels
successifs dans une seule transaction.

## Limites

Ces scénarios testent le moteur PostgreSQL et le SQL réel RES-1/RES-2 avec une
fixture minimale. Ils ne certifient pas le schéma complet de TEST 17.6, son service
Auth, ses données, ni ses writers VENTES/transferts. Ces writers ne prennent pas
encore le verrou commun : l'activation opérationnelle des réservations reste interdite.
