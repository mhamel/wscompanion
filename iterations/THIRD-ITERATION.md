# THIRD ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Goal of this document: give the next person enough context to be autonomous (objective, what is shipped, where things live, how to run, and what to do next).

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

Rule of thumb: one TODO at a time. Implement -> validate -> check the TODO box -> commit -> move on.

Note (Windows/encoding): if Markdown looks garbled in PowerShell, use `Get-Content -Encoding utf8 ...`.

## 1) Project objective (why this exists)

Companion mobile app that connects to Wealthsimple via SnapTrade (read-only by default) and provides “power user” features users come back for:

- P&L 360 per ticker (main “wow”)
- Wheel / covered calls tracker (cycle-based view)
- Accountant-friendly exports (CSV first)
- News + alerts (push) for retention and trust

Success criteria:
- “Time to wow” < 2 minutes after SnapTrade connect (initial sync -> top tickers P&L visible).
- Trust: transparent privacy posture (disconnect, purge tokens, no secret leaks).

## 2) Where we are now (what is shipped)

Monorepo with:
- Backend API (Fastify + TS + Prisma) + worker (BullMQ)
- Mobile app (Expo + React Native + TS)

### Snapshot of TODO status (at this iteration)

Authoritative status is always the checkboxes in TODO docs. Quick orientation:

- Roadmap: `docs/TODO_INDEX.md`
  - `M3-02` is now checked (alerts end-to-end: rules + events + push + screens).
- Backend: `docs/TODO_BACKEND.md`
  - Done: Foundations, OpenAPI-first, DB schema/migrations, Auth, SnapTrade connect+sync, P&L 360, Wheel, News, Alerts (incl. push delivery), Exports
  - Not done yet: `BE-082`, `BE-110..111`, `BE-120..121`, `BE-130..133`
- Mobile: `docs/TODO_MOBILE.md`
  - Done: Foundations, Auth, Home/search-first, Ticker/Transactions/Wheel/News, Alerts screens, Exports screens, Push opt-in (`FE-072`)
  - Not done yet: `FE-090..091`, `FE-100..101`, `FE-110..112`

## 3) What changed in this iteration (delta vs SECOND-ITERATION.md)

Main outcome: alerts are now “end-to-end” with push delivery (Expo push tokens), not just event creation.

### Backend: push delivery worker (`BE-093`)

- New worker job: `alerts-deliver` scheduled by `ALERTS_DELIVERY_SCHEDULE_EVERY_SECONDS` (default in `.env.example`: 60s).
- Delivery rules:
  - Only considers events with `AlertEvent.deliveredAt = null`.
  - Only considers recent events (default max age 48h, configurable via `ALERTS_DELIVERY_MAX_AGE_HOURS`).
  - Only delivers to devices that existed at trigger time: `Device.createdAt <= AlertEvent.triggeredAt` (prevents “backfilling” old events when a user opts-in later).
  - Marks `AlertEvent.deliveredAt` only when at least one Expo ticket is `status=ok`.
  - Deletes invalid tokens (`DeviceNotRegistered`, `InvalidPushToken`) automatically.
- New code:
  - Expo push sender: `apps/backend/src/notifications/expoPush.ts` (+ tests in `apps/backend/src/notifications/expoPush.test.ts`)
  - Worker integration: `apps/backend/src/worker.ts` (scheduling + `handleAlertsDeliverJob`)
  - Env documented: `apps/backend/.env.example` (new vars)

### Backlog docs updates

- `docs/TODO_INDEX.md`: checked `M3-02`.
- `docs/TODO_BACKEND.md`: added + checked `BE-093` and clarified `BE-091` scope.

## 4) How to run locally (happy path)

Prereqs:
- Node + npm
- Docker

Start infra (Postgres + Redis + MinIO + Mailhog):

```powershell
docker-compose up -d
```

Backend env:
- Copy `apps/backend/.env.example` -> `apps/backend/.env`
- DB migrate:

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

## 5) How to verify alerts push quickly

1) On a physical device, open `Alerts` tab -> toggle `Push` on (this registers a `Device` in DB).
2) Create a `news_spike` alert rule with very low thresholds (ex: `minArticles=1`) so it triggers easily.
3) Ensure you have RSS feeds configured in `NEWS_RSS_FEEDS_JSON` (see `apps/backend/.env.example`) and let the worker run:
   - `news-scan` ingests items
   - `alerts-evaluate` creates `AlertEvent`
   - `alerts-deliver` sends push and sets `AlertEvent.deliveredAt`
4) DB sanity checks:
   - `Device` row exists (push token stored)
   - `AlertEvent` row exists and `deliveredAt` is set after delivery

Notes:
- Only `news_spike` is evaluated today (templates exist for other types but worker doesn’t trigger them yet).
- For delivery, an Expo access token is optional; if you need it for production, set `EXPO_PUSH_ACCESS_TOKEN`.

## 6) High-signal entry points (where things live)

Backend:
- Worker entry + schedules: `apps/backend/src/worker.ts`
- Alerts API: `apps/backend/src/routes/alerts.ts`
- Devices API: `apps/backend/src/routes/devices.ts`
- Expo push client: `apps/backend/src/notifications/expoPush.ts`
- Prisma models: `apps/backend/prisma/schema.prisma` (`Device`, `AlertRule`, `AlertEvent`)

Mobile:
- Alerts screen + push toggle UI: `apps/mobile/src/screens/AlertsScreen.tsx`
- Push helpers: `apps/mobile/src/notifications/push.ts`
- Persisted registration: `apps/mobile/src/notifications/notificationsStore.ts`
- API calls: `apps/mobile/src/api/client.ts` (`deviceRegister`, `deviceDelete`)

## 7) Known limitations / tech debt (important)

- Alerts evaluation: only `news_spike` is actually triggered by the worker today.
- Delivery semantics are event-level (no per-device delivery tracking). A single successful Expo ticket marks the event as delivered.
- Push UX is “MVP”: no deep link on tap yet, no foreground handler customization.
- Trust/privacy: “Disconnect SnapTrade” (`SEC-010`) is still not implemented.

## 8) Next steps (prioritized)

Priority A (trust + retention):
1) `SEC-010` Disconnect SnapTrade (backend endpoint to purge tokens + stop sync + mobile UI).
2) Expand alerts beyond `news_spike` (earnings/expiry/price move) + better push copy + deep links.

Priority B (exports quality):
3) Fix “prepare my year” realized PnL export (year slicing from transactions), starting from `apps/backend/src/exports/csv.ts`.

Priority C (monetization path):
4) RevenueCat entitlements + feature gates (`BE-110..111`, `FE-100..101`).

## 9) Validation commands

- Backend tests: `npm --workspace apps/backend test`
- Backend build: `npm --workspace apps/backend run build`
- Mobile typecheck: `cd apps/mobile; npx tsc --noEmit`

## 10) Git state (important)

At the time of writing, the repo has local uncommitted changes (mobile push opt-in + backend push delivery + docs + iteration files).
Suggested split commits (after review):

1) `FE-072 push opt-in flow + notifications settings`
2) `BE-093 alerts push delivery worker (Expo) + docs`
3) `docs(iterations) move iteration docs under iterations/`

