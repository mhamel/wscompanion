# FIRST ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

## 0) Source of truth (read this first)

- Product vision: `PRODUIT.md`
- Target architecture + contracts + flows: `ARCHITECTURE.md`
- Execution backlog (single entrypoint): `docs/TODO_INDEX.md`
- Detailed backlogs:
  - Backend: `docs/TODO_BACKEND.md`
  - Mobile: `docs/TODO_MOBILE.md`
  - Data/Analytics: `docs/TODO_DATA_ANALYTICS.md`
  - Platform/DevOps: `docs/TODO_PLATFORM_DEVOPS.md`
  - Security/QA/Obs: `docs/TODO_SECURITY_QA_OBS.md`

Rule: when you implement a task, check it in the relevant TODO doc, then commit, then move to the next task.

## 1) Where we are now (what is shipped)

This repo is no longer "docs only": we have a working monorepo with a backend API + worker + a mobile app.

### Snapshot of TODO status (at this iteration)

The authoritative status is always the checkboxes in the TODO docs, but to orient you quickly:

- Backend: `docs/TODO_BACKEND.md`
  - Done: Foundations, OpenAPI-first, DB schema/migrations, Auth, SnapTrade connect+sync, P&L 360, Wheel, News, Alerts (MVP), Exports (BE-100..102)
  - Not done yet: `BE-082`, `BE-110..111`, `BE-120..121`, `BE-130..133`
- Mobile: `docs/TODO_MOBILE.md`
  - Done: Foundations, Auth, Home/search-first (FE-030..031), Ticker/Transactions/Wheel/News, Alerts screens, Exports screens (FE-080..081)
  - Not done yet: `FE-072`, `FE-090..091`, `FE-100..101`, `FE-110..112`

### Backend (Fastify + TS + Prisma + BullMQ)

Delivered capabilities (high level):

- Auth: OTP start/verify, JWT access + refresh rotation, session validation.
- Core data model: users/sessions/devices/entitlements + portfolio tables + analytics tables.
- SnapTrade onboarding (MVP): start + callback + broker_connection persisted (tokens encrypted).
- Sync pipeline (worker): initial + incremental jobs, idempotent ingestion of transactions, basic portfolio entities.
- Analytics (worker): P&L 360 aggregates (totals + daily timeline) and caching hooks.
- Wheel: cycle detection + read APIs + manual overrides with audit.
- News: RSS/Atom ingestion worker + per-ticker news endpoint.
- Alerts: templates + CRUD rules + events list + scheduled evaluation worker (MVP: `news_spike` only).
- Exports: export jobs (BullMQ) -> CSV generation -> store in S3-compatible storage (MinIO local) -> list + signed download URL.

Where to look:

- Server bootstrap: `apps/backend/src/api.ts`
- Server routes registration: `apps/backend/src/server.ts`
- Prisma schema (models): `apps/backend/prisma/schema.prisma`
- Worker (all queues/jobs): `apps/backend/src/worker.ts`
- Exports routes: `apps/backend/src/routes/exports.ts`
- Exports generation + S3: `apps/backend/src/exports/csv.ts`, `apps/backend/src/exports/s3.ts`

### Mobile (Expo + React Native + TS)

Delivered capabilities (high level):

- Auth screens + token storage + refresh flow.
- SnapTrade connect flow via in-app browser + deep link callback.
- Home "search-first": ticker suggestions, history, quick nav to Ticker tabs, Ask shortcut.
- Ticker screen: summary + tabs (Trades/News/Wheel/Insights) + timeline interactions -> filtered transactions.
- News detail: open article + linked tickers.
- Wheel screens: cycles list + cycle detail + edit tags/notes.
- Alerts screens: list rules + events + create alert from templates.
- Exports: list jobs, create exports ("prepare my year"), share signed download link.

Where to look:

- Navigation stack: `apps/mobile/src/navigation/MainStack.tsx`
- Tabs: `apps/mobile/src/navigation/MainTabs.tsx`
- API client (OpenAPI fetch): `apps/mobile/src/api/client.ts`
- Exports UI: `apps/mobile/src/screens/ExportsScreen.tsx`

### Contract-first (OpenAPI)

We enforce "OpenAPI-first" as a workflow rule:

- Backend generates OpenAPI: `packages/contract/openapi.json`
- Mobile types are generated from that file: `apps/mobile/src/api/schema.ts`
- Root script to keep them in sync: `npm run api:generate`

If you touch backend routes/schemas, always run `npm run api:generate` and commit the regenerated files.

### Secrets + local keys (important)

- `.keys/` is ignored by git via `.gitignore`. Do not commit secrets.
- Dev-only loader exists: `apps/backend/src/devSecrets.ts` (loads local SnapTrade keys if present).

## 2) How to run locally (happy path)

Prereqs:

- Node + npm
- Docker

Start infra (Postgres + Redis + MinIO + Mailhog):

```powershell
docker-compose up -d
```

Create env file:

- Copy `apps/backend/.env.example` -> `apps/backend/.env`
- Ensure `DATABASE_URL` + `REDIS_URL` are correct.
- For exports, ensure S3 vars are set (MinIO local is already in `.env.example`).

Create the MinIO bucket once (required for exports):

- MinIO console: http://localhost:9001 (default user/pass are in `docker-compose.yml`)
- Create bucket name matching `S3_BUCKET` (example: `justlove-exports`)

DB migrate:

```powershell
npm --workspace apps/backend run db:migrate
```

Run backend API:

```powershell
npm --workspace apps/backend run dev
```

Run worker:

```powershell
npm --workspace apps/backend run dev:worker
```

Run mobile:

```powershell
npm --workspace apps/mobile start
```

OpenAPI docs:

- Swagger UI: http://localhost:3000/docs

## 3) Guardrails (do not break these)

### 3.1 One task at a time (and commit discipline)

Process per task (mandatory):

1) Pick ONE unchecked task in `docs/TODO_*.md`
2) Implement it
3) Run the closest validations (build/tests/typecheck)
4) Check the task in the TODO doc
5) Commit with a message like `BE-123 ...` or `FE-123 ...`

### 3.2 OpenAPI-first

Any API contract change requires:

```powershell
npm run api:generate
git add packages/contract/openapi.json apps/mobile/src/api/schema.ts
git commit -m "..."
```

### 3.3 Do not commit secrets

- Keep secrets in `.env` (ignored) and/or `.keys/` (ignored).
- If you need new secrets, document the variable name in `.env.example` but do NOT put the value.

## 4) Known limitations / tech debt (be honest)

- Exports "prepare my year":
  - `option_premiums_by_year` supports an optional `params.year`.
  - `pnl_realized_by_ticker` currently exports totals (not year-sliced). If you need true "tax-year" export, implement year slicing from transactions.
- Mobile exports shares the signed URL (Share sheet). It does not download the file to disk yet.
- Alerts worker only evaluates `news_spike` and only creates events. No push/email delivery yet.
- Ask screen is a placeholder UI; no backend ask endpoint exists yet.
- There is some mojibake in the console output for accented strings in a few files. Prefer ASCII text in new patches or ensure your editor uses UTF-8 consistently.

## 5) What you should do next (prioritized)

As product owner, the next iteration should maximize user value and retention while keeping the platform safe.

Priority A (retention + trust):

1) Push opt-in + device registration + alert delivery
   - Mobile task: `FE-072` in `docs/TODO_MOBILE.md`
   - Backend tasks: delivery mechanism (new job) + mark `AlertEvent.deliveredAt` when sent.
   - Use existing devices endpoints: `apps/backend/src/routes/devices.ts`
2) Disconnect SnapTrade (privacy/trust)
   - Security task: `SEC-010` in `docs/TODO_SECURITY_QA_OBS.md`
   - Add backend endpoint to disconnect + purge tokens, and a mobile screen/action.

Priority B (exports quality):

3) Fix "prepare my year" for realized PnL export (year slicing)
   - Start from `apps/backend/src/exports/csv.ts`
   - Use transactions filtering by UTC year and compute realized per ticker (do not reuse all-time totals).
4) Better export UX
   - Download file and share actual CSV (not only a signed URL).

Priority C (monetization path):

5) RevenueCat entitlements + feature gates
   - Backend: `BE-110..111` in `docs/TODO_BACKEND.md`
   - Mobile: `FE-100..101` in `docs/TODO_MOBILE.md`

## 6) How to keep yourself autonomous

Start every work session by:

- Reading `PRODUIT.md` (scope and "why")
- Reading `ARCHITECTURE.md` (how and constraints)
- Picking tasks in `docs/TODO_INDEX.md` + their detailed doc

Then follow the guardrails (Section 3).

## 7) If you need to delegate to another AI agent

This repo is structured for multi-agent parallelism:

- Keep domains separate (auth/sync/analytics/wheel/news/alerts/exports/billing).
- Use the TODO IDs to avoid conflicts.
- If you must use another local CLI agent (per prior workflow), do it only after you have a clean git state and you have written down the exact task + acceptance criteria in the TODO doc.
