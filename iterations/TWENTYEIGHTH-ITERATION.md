# TWENTY-EIGHTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif: handoff autonome.

## 1) Ce qui a été fait

Objectif: réduire le risque de double-ingestion en sync (idempotence).

- Ajout tests DB (conditionnels) pour `ingestTransactions`:
  - `apps/backend/src/sync/ingestTransactions.test.ts`
  - vérifie idempotence via unique `(provider, accountId, externalId)` + `skipDuplicates`
  - vérifie validation: `instrumentId` et `optionContractId` exclusifs

## 2) Comment valider

Local (nécessite Postgres):
```powershell
docker-compose up -d postgres
$env:DATABASE_URL='postgresql://justlove:justlove@localhost:5432/justlove?schema=public'
npm --workspace apps/backend exec prisma migrate deploy
npm --workspace apps/backend test
```

CI: le test s’exécute automatiquement (CI fournit Postgres + `DATABASE_URL`).

## 3) Notes

- Le test est “DB-only” et est skipped si `DATABASE_URL` absent (comme `meDelete.test.ts`).

## 4) Git

- Branche: `main`
- Commit: voir `git log -1` (message: `test: add ingestTransactions idempotence DB test`)

