# FOURTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Goal of this document: give the next person enough context to be autonomous (objective, what is shipped, where things live, how to run, current git state, and what to do next).

## 0) Source of truth (read first)

- Product vision: `PRODUIT.md`
- Target architecture + contracts + flows: `ARCHITECTURE.md`
- Execution backlog (single entrypoint): `docs/TODO_INDEX.md`
- Detailed backlogs:
  - Backend: `docs/TODO_BACKEND.md`
  - Mobile: `docs/TODO_MOBILE.md`
  - Data/Analytics: `docs/TODO_DATA_ANALYTICS.md`
  - Platform/DevOps: `docs/TODO_PLATFORM_DEVOPS.md`
  - Security/QA/Obs: `docs/TODO_SECURITY_QA_OBS.md`
- Iteration history: `iterations/*.md`

Rule of thumb: one TODO at a time. Implement -> validate -> check the TODO box -> commit -> move on.

Note (Windows/encoding): if Markdown looks garbled in PowerShell, use `Get-Content -Encoding utf8 ...`.

## 1) Project objective (why this exists)

Companion mobile app that connects to Wealthsimple via SnapTrade (read-only by default) and provides "power user" features users come back for:

- P&L 360 per ticker (main "wow")
- Wheel / covered calls tracker (cycle-based view)
- Accountant-friendly exports (CSV first)
- News + alerts (push) for retention and trust

Success criteria:
- "Time to wow" < 2 minutes after SnapTrade connect (initial sync -> top tickers P&L visible).
- Trust: transparent privacy posture (disconnect, purge tokens, no secret leaks).

## 2) Where we are now (what is shipped)

Monorepo with:
- Backend API (Fastify + TS + Prisma) + worker (BullMQ)
- Mobile app (Expo + React Native + TS)

### Snapshot of TODO status (at this iteration)

Authoritative status is always the checkboxes in TODO docs. Quick orientation:

- Roadmap: `docs/TODO_INDEX.md`
  - `M3-02` is checked (alerts end-to-end: rules + events + push + screens).
- Backend: `docs/TODO_BACKEND.md`
  - Done: Foundations, OpenAPI-first, DB schema/migrations, Auth, SnapTrade connect+sync, P&L 360, Wheel, News, Alerts (incl. push delivery), Exports
  - Not done yet: `BE-082`, `BE-110..111`, `BE-120..121`, `BE-130..133`
- Mobile: `docs/TODO_MOBILE.md`
  - Done: Foundations, Auth, Home/search-first, Ticker/Transactions/Wheel/News, Alerts screens, Exports screens, Push opt-in (`FE-072`)
  - Not done yet: `FE-090..091`, `FE-100..101`, `FE-110..112`
- Security/Privacy: `docs/TODO_SECURITY_QA_OBS.md`
  - Not done yet: `SEC-010` ("Disconnect SnapTrade": purge tokens + stop sync + UX)

## 3) What changed in this iteration (delta vs THIRD-ITERATION.md)

This iteration was mainly a stabilization/documentation pass to make the current WIP ready for handoff:

- Validated that the push work compiles and tests pass:
  - Backend: `npm --workspace apps/backend test`, `npm --workspace apps/backend run build`
  - Mobile: `cd apps/mobile; npx tsc --noEmit`
- Updated `docs/TODO_INDEX.md` intro to reflect that the repo contains the implementation (not "docs only").
- Added this handoff doc: `iterations/FOURTH-ITERATION.md`.

## 4) High-signal entry points (where things live)

Backend:
- Server bootstrap: `apps/backend/src/api.ts`
- Routes registration: `apps/backend/src/server.ts`
- Worker entry + schedules: `apps/backend/src/worker.ts`
- Alerts API: `apps/backend/src/routes/alerts.ts`
- Devices API: `apps/backend/src/routes/devices.ts`
- Expo push client: `apps/backend/src/notifications/expoPush.ts`
- Prisma models: `apps/backend/prisma/schema.prisma` (`Device`, `AlertRule`, `AlertEvent`)

Mobile:
- Navigation stack: `apps/mobile/src/navigation/MainStack.tsx`
- Tabs: `apps/mobile/src/navigation/MainTabs.tsx`
- Alerts screen + push toggle UI: `apps/mobile/src/screens/AlertsScreen.tsx`
- Push helpers: `apps/mobile/src/notifications/push.ts`
- Persisted registration: `apps/mobile/src/notifications/notificationsStore.ts`
- API calls: `apps/mobile/src/api/client.ts` (`deviceRegister`, `deviceDelete`)

Contract-first (OpenAPI):
- Backend exports OpenAPI to: `packages/contract/openapi.json`
- Mobile types generated in: `apps/mobile/src/api/schema.ts`
- Sync script: `npm run api:generate`

## 5) How to run locally (happy path)

Prereqs:
- Node + npm
- Docker

Start infra (Postgres + Redis + MinIO + Mailhog):

```powershell
docker-compose up -d
```

Backend env:
- Copy `apps/backend/.env.example` -> `apps/backend/.env`

DB migrate:

```powershell
npm --workspace apps/backend run db:migrate
```

Run backend API:

```powershell
npm --workspace apps/backend run dev
```

Run worker (includes alerts-evaluate + alerts-deliver schedules):

```powershell
npm --workspace apps/backend run dev:worker
```

Run mobile:

```powershell
npm --workspace apps/mobile start
```

Very common (physical phone): `http://localhost:3000` points to the phone, not your dev machine.
Set `EXPO_PUBLIC_API_BASE_URL` to your LAN IP (ex: `http://192.168.x.x:3000`) when testing on device (`apps/mobile/.env.example`).

Swagger UI: http://localhost:3000/docs

## 6) Alerts push (end-to-end) quick verify

1) On a physical device, open `Alerts` tab -> toggle `Push` on (this registers a `Device` in DB).
2) Create a `news_spike` alert rule with low thresholds (ex: `minArticles=1`) so it triggers easily.
3) Ensure you have RSS feeds configured in `NEWS_RSS_FEEDS_JSON` (see `apps/backend/.env.example`) and let the worker run:
   - `news-scan` ingests items
   - `alerts-evaluate` creates `AlertEvent`
   - `alerts-deliver` sends push and sets `AlertEvent.deliveredAt`

Notes:
- Only `news_spike` is evaluated today (templates exist for other types but worker doesn’t trigger them yet).
- Env knobs for delivery:
  - `ALERTS_DELIVERY_SCHEDULE_EVERY_SECONDS` (default 60)
  - `ALERTS_DELIVERY_MAX_AGE_HOURS` (default 48)
  - `EXPO_PUSH_ACCESS_TOKEN` (optional)

## 7) Git state (important) + suggested commits

At the time of writing, the repo has local uncommitted changes.

Working tree changes include (non-exhaustive):
- Mobile push opt-in: `apps/mobile/src/notifications/*`, `apps/mobile/src/screens/AlertsScreen.tsx`, `apps/mobile/src/providers/AppProviders.tsx`, `apps/mobile/src/api/client.ts`, `apps/mobile/package.json`, `package-lock.json`
- Backend push delivery: `apps/backend/src/notifications/*`, `apps/backend/src/worker.ts`, `apps/backend/.env.example`
- Backlog docs: `docs/TODO_MOBILE.md`, `docs/TODO_BACKEND.md`, `docs/TODO_INDEX.md`
- Iteration docs: `iterations/*` + delete legacy root `FIRST-ITERATION.md`

Suggested split commits (after review):

1) `FE-072 push opt-in flow + notifications settings`
2) `BE-093 alerts push delivery worker (Expo) + docs`
3) `docs(iterations) move iteration docs under iterations/`

Reminder: `npm run api:check` expects a clean git diff; it will fail if you have local changes (even if OpenAPI itself is in sync).

## 8) Next steps (prioritized)

Priority A (trust + retention):
1) `SEC-010` Disconnect SnapTrade (backend endpoint to purge tokens + stop sync + mobile UX surface).
2) Expand alerts beyond `news_spike` (earnings/expiry/price move) + improve push copy + deep links.

Priority B (exports quality):
3) Fix "prepare my year" realized PnL export (year slicing from transactions), starting from `apps/backend/src/exports/csv.ts`.

Priority C (monetization path):
4) RevenueCat entitlements + feature gates (`BE-110..111`, `FE-100..101`).

## 9) Validation commands

- Backend tests: `npm --workspace apps/backend test`
- Backend build: `npm --workspace apps/backend run build`
- Mobile typecheck: `cd apps/mobile; npx tsc --noEmit`

