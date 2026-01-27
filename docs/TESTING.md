# Testing (QA-001)

Ce repo vise 3 niveaux de couverture :

1) **Contract tests (OpenAPI)**  
   - But : s’assurer que le backend exporte un contrat stable et que le mobile consomme des types à jour.  
   - Commande : `npm run api:check` (génère + vérifie qu’il n’y a pas de diff git).

2) **Backend tests (unitaires / intégration)**  
   - Unitaires : fonctions “pures” (calculs P&L, wheel detection) — rapides, pas de DB.
   - Intégration : Fastify `inject()` + Prisma + Postgres (ex: purge `DELETE /v1/me`).
   - QA-002 (golden files) : fixtures dans `apps/backend/src/analytics/__fixtures__/pnl` et `apps/backend/src/analytics/__fixtures__/wheel` (tests: `apps/backend/src/analytics/pnl.test.ts`, `apps/backend/src/analytics/wheel.test.ts`).

3) **Mobile typecheck**  
   - Commande : `npx tsc -p apps/mobile/tsconfig.json --noEmit`

## Lancer les tests en local (happy path)

1) Démarrer l’infra (Postgres/Redis/MinIO/…):

```powershell
docker-compose up -d
```

2) Migrer la DB :

```powershell
npm --workspace apps/backend run db:migrate
```

3) Lancer les tests backend :

```powershell
npm --workspace apps/backend test
```

## CI

Le workflow `.github/workflows/ci.yml` démarre Postgres + Redis via `services`, applique les migrations (`prisma migrate deploy`), puis exécute les tests et le build.
