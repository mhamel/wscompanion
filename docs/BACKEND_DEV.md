# Backend dev (API + worker)

Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif: démarrer l’API Fastify + le worker BullMQ localement (avec Postgres/Redis via docker-compose) et savoir quoi faire quand ça casse.

## 1) Prérequis

- Node.js + npm
- Docker Desktop / Docker Engine (recommandé)
- (Optionnel) VS Code (tasks versionnées dans `.vscode/tasks.json`)

## 2) Infra locale (Postgres/Redis/etc.)

Le repo fournit `docker-compose.yml` avec:
- Postgres (5432)
- Redis (6379)
- MinIO (9000/9001)
- Mailhog (1025/8025)
- Jaeger (16686/4317/4318)

UIs (dans ton navigateur):
- Mailhog: `http://localhost:8025` (VS Code: `Infra: Open Mailhog (8025)`)
- Jaeger: `http://localhost:16686` (VS Code: `Infra: Open Jaeger (16686)`)
- MinIO Console: `http://localhost:9001` (VS Code: `Infra: Open MinIO Console (9001)`)
- Raccourci: `Infra: Open All UIs (Mailhog + Jaeger + MinIO)`

Lancer:
- CLI: `docker compose up -d`
- VS Code: `Run Task...` -> `Infra: Up (docker compose)`

Arrêter:
- CLI: `docker compose down`
- VS Code: `Infra: Down (docker compose)`

## 3) Config `.env`

- Copier `apps/backend/.env.example` -> `apps/backend/.env`
- Valeurs importantes:
  - `DATABASE_URL` (Postgres)
  - `REDIS_URL` (Redis)
  - `AUTH_JWT_SECRET` (dev ok)

## 4) Prisma (DB)

Générer le client Prisma:
- CLI: `npm --workspace apps/backend run db:generate`
- VS Code: `Backend: Prisma generate`

Appliquer les migrations (dev):
- CLI: `npm --workspace apps/backend run db:migrate`
- VS Code: `Backend: DB migrate (dev)`

Reset DB (DANGEREUX: supprime les données locales):
- CLI: `npm --workspace apps/backend run db:reset`
- VS Code: `Backend: DB reset (DANGEROUS)`

Raccourci:
- VS Code: `Backend: Setup DB (generate + migrate)`
- VS Code: `Backend: Setup DB + Seed (demo user)`

Seed data (dev, optionnel):
- CLI: `npm --workspace apps/backend run seed:dev -- --email demo@justlovethestocks.local --reset`
- VS Code: `Backend: Seed dev data (demo user)`
- VS Code: `Backend: Seed dev data (prompt email)` (permet de seed ton user)
Note: le seed tente de bump la “cache version” PnL dans Redis (si `REDIS_URL` est configuré) pour refléter les changements immédiatement; option `--noBumpCache` pour désactiver.
Option dev (pour tester features gatees sans RevenueCat):
- `--pro` (seed un entitlement Pro local)
- `--acceptDisclaimer` (marque le risk disclaimer comme accepte)
- VS Code: `Backend: Seed dev data (demo user, pro+disclaimer)` / `Backend: Seed dev data (prompt email, pro+disclaimer)`

Raccourcis (VS Code, pro+disclaimer):
- `Dev: Fresh clone (Bootstrap + Seed Prompt pro+disclaimer + Run)`
- `Dev: Reset DB (DANGEROUS) + Seed Prompt pro+disclaimer + Run`

## 5) Lancer l’API + le worker

API (Fastify):
- CLI: `npm --workspace apps/backend run dev`
- VS Code: `Backend: API (dev)`

Worker (BullMQ / jobs):
- CLI: `npm --workspace apps/backend run dev:worker`
- VS Code: `Backend: Worker (dev)`

Raccourcis:
- `Dev: Backend (API + Worker)`
- `Dev: Full stack (Infra + Backend + Mobile)` (si tu veux aussi Metro)
- `Dev: Open Dashboards (Mailhog + Jaeger + MinIO + Swagger)`
- `Dev: Fresh clone (Bootstrap + Run)` (infra + migrate puis watchers)
- `Dev: Fresh clone (Bootstrap + Seed + Run)` (idem + seed dev data)
- `Dev: Fresh clone (Bootstrap + Seed Prompt + Run)` (idem + seed pour ton email)
- `Dev: Fresh clone (Bootstrap + Seed Prompt pro+disclaimer + Run)` (idem + seed pour ton email)
- `Dev: Full stack (Seed Prompt + Dashboards)` (seed + stack + ouvre les UIs)
- `Dev: Full stack (Seed Prompt pro+disclaimer + Dashboards)` (idem, avec Pro + disclaimer)
- `Dev: Bootstrap DB + Seed (Infra + Prisma + Seed)` (infra + migrations + seed, sans lancer les watchers)
- `Dev: Reset DB (DANGEROUS) + Seed Prompt pro+disclaimer + Run` (reset DB + seed pour ton email + watchers)
- `Dev: Reset DB (DANGEROUS) + Seed + Run` (reset DB locale + seed + watchers)
- `Dev: Reset DB (DANGEROUS) + Seed Prompt + Run` (reset DB + seed pour ton email + watchers)

Checks (VS Code tasks):
- `Backend: Check /v1/health`
- `Backend: Check /v1/ready`
- `Backend: Check /v1/version`
- `Backend: Open Swagger UI (/docs)`
- `Backend: Open Health (/v1/health)`
- `Backend: Open Ready (/v1/ready)`
- `Backend: Open Version (/v1/version)`

## 6) Commandes utiles

- Health endpoints:
  - Liveness: `GET /health` (infra) ou `GET /v1/health` (API)
  - Readiness: `GET /ready` (infra) ou `GET /v1/ready` (API) — retourne `503` si DB/Redis non prêts
  - Version: `GET /v1/version` (API) — retourne `nodeEnv` et, si configurés, `gitSha` / `release`

- Export OpenAPI: `npm --workspace apps/backend run openapi:export`
- Swagger UI (navigateur): `http://localhost:3000/docs`
- Regénérer le client mobile (OpenAPI): `npm run api:generate`
- Vérifier que l’OpenAPI est à jour: `npm run api:check`
- Tests: `npm --workspace apps/backend test`
- Lint: `npm --workspace apps/backend run lint`
- Build: `npm --workspace apps/backend run build`

## 7) Troubleshooting (rapide)

- Docker pas démarré:
  - Symptôme: `connect ECONNREFUSED` vers Postgres/Redis, migrations qui fail.
  - Fix: démarre Docker Desktop, puis `docker compose up -d`.

- Ports déjà utilisés (5432/6379/3000):
  - Symptôme: “address already in use”.
  - Fix: stoppe le service qui occupe le port, ou change les ports dans `docker-compose.yml` / `.env`.

- Migrations Prisma bloquent:
  - Symptôme: erreurs Prisma/DB.
  - Fix: vérifie `DATABASE_URL`, puis relance `Backend: Setup DB (generate + migrate)`.

- Mobile ne rejoint pas l’API:
  - Android emulator: `http://10.0.2.2:3000`
  - iPhone/device: IP LAN de ton PC (même Wi‑Fi)
  - Dans l’app (dev): `Paramètres` -> `Dev` -> `Override API baseUrl`
