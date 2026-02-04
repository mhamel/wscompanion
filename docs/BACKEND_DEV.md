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

Raccourci:
- VS Code: `Backend: Setup DB (generate + migrate)`

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
- `Dev: Fresh clone (Bootstrap + Run)` (infra + migrate puis watchers)

## 6) Commandes utiles

- Export OpenAPI: `npm --workspace apps/backend run openapi:export`
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

