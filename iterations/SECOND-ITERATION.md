# SECOND ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Goal of this document: give the next person enough context to be autonomous (what the product is, what is shipped, where things live, how to run, and what to do next).

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

## 1) Project objective (why this exists)

This is a companion mobile app that connects to Wealthsimple via SnapTrade (read-only by default) and provides "power user" features that users keep coming back for:

- P&L 360 per ticker (the main "wow")
- Wheel / covered calls tracker (cycle-based view)
- Accountant-friendly exports (CSV first)
- News + alerts to drive retention and trust

Success criteria:
- "Time to wow" < 2 minutes after SnapTrade connect (initial sync -> top tickers P&L visible).
- Trust: transparent privacy posture (disconnect, purge tokens, no secret leaks).

## 2) Where we are now (what is shipped)

Monorepo with:
- Backend API (Fastify + TS + Prisma) + worker (BullMQ)
- Mobile app (Expo + React Native + TS)

### Snapshot of TODO status (at this iteration)

Authoritative status is always the checkboxes in TODO docs. Quick orientation:

- Backend: `docs/TODO_BACKEND.md`
  - Done: Foundations, OpenAPI-first, DB schema/migrations, Auth, SnapTrade connect+sync, P&L 360, Wheel, News, Alerts (MVP events), Exports
  - Not done yet: `BE-082`, `BE-110..111`, `BE-120..121`, `BE-130..133`
- Mobile: `docs/TODO_MOBILE.md`
  - Done: Foundations, Auth, Home/search-first, Ticker/Transactions/Wheel/News, Alerts screens, Exports screens, Push opt-in (`FE-072`)
  - Not done yet: `FE-090..091`, `FE-100..101`, `FE-110..112`

### What changed in this iteration (delta vs FIRST-ITERATION.md)

- Completed `FE-072` (push opt-in flow + notification settings UI).
- Added Expo push registration in the mobile app:
  - New code: `apps/mobile/src/notifications/notificationsStore.ts`, `apps/mobile/src/notifications/push.ts`
  - UI is integrated into `apps/mobile/src/screens/AlertsScreen.tsx`
- Mobile API client now calls the existing backend devices endpoints:
  - `POST /v1/devices/register`
  - `DELETE /v1/devices/{id}`
  - Implemented in `apps/mobile/src/api/client.ts`
- New mobile dependencies: `expo-notifications`, `expo-device` (see `apps/mobile/package.json`).
- `FE-072` checkbox is checked in `docs/TODO_MOBILE.md`.

Important: at the time of writing this, git has local uncommitted changes.
Suggested commit message: `FE-072 push opt-in flow + notifications settings`.

Files touched by FE-072 (what you should expect in the commit):
- `apps/mobile/package.json` (+ `expo-notifications`, `expo-device`)
- `apps/mobile/src/api/client.ts` (added `deviceRegister` / `deviceDelete`)
- `apps/mobile/src/providers/AppProviders.tsx` (hydrates notifications store)
- `apps/mobile/src/screens/AlertsScreen.tsx` (push toggle UI)
- `apps/mobile/src/notifications/notificationsStore.ts` (SecureStore state)
- `apps/mobile/src/notifications/push.ts` (permissions + Expo push token)
- `docs/TODO_MOBILE.md` (checkbox)
- `package-lock.json`

## 3) Where to look (high-signal entry points)

Backend:
- Server bootstrap: `apps/backend/src/api.ts`
- Routes registration: `apps/backend/src/server.ts`
- Prisma schema: `apps/backend/prisma/schema.prisma`
- Worker queues/jobs: `apps/backend/src/worker.ts`
- Devices endpoints: `apps/backend/src/routes/devices.ts`
- Alerts endpoints: `apps/backend/src/routes/alerts.ts`

Mobile:
- Navigation stack: `apps/mobile/src/navigation/MainStack.tsx`
- Tabs: `apps/mobile/src/navigation/MainTabs.tsx`
- API client (OpenAPI + auth/refresh): `apps/mobile/src/api/client.ts`
- Alerts UI (+ push toggle): `apps/mobile/src/screens/AlertsScreen.tsx`
- Push registration helpers/state: `apps/mobile/src/notifications/push.ts`, `apps/mobile/src/notifications/notificationsStore.ts`

Contract-first (OpenAPI):
- Backend exports OpenAPI to: `packages/contract/openapi.json`
- Mobile types generated in: `apps/mobile/src/api/schema.ts`
- Sync script: `npm run api:generate`

If you touch backend routes/schemas, run `npm run api:generate` and commit the regenerated files.

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
- Ensure `DATABASE_URL`, `REDIS_URL`, and S3 vars for MinIO are correct.

Create the MinIO bucket once (required for exports):
- MinIO console: http://localhost:9001
- Create bucket matching `S3_BUCKET` (example: `justlove-exports`)

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

Note (very common): on a physical phone, `http://localhost:3000` points to the phone, not your dev machine.
Set `EXPO_PUBLIC_API_BASE_URL` to your LAN IP (ex: `http://192.168.x.x:3000`) when testing on device.
You can copy `apps/mobile/.env.example` -> `apps/mobile/.env` to set this locally.

OpenAPI docs:
- Swagger UI: http://localhost:3000/docs

## 5) FE-072 (push opt-in) - implementation details

What it does:
- Adds a toggle ("Push") in the Alerts screen to opt-in/out.
- On opt-in:
  - Requests OS notification permission.
  - Obtains an Expo push token (requires a physical device).
  - Calls backend `POST /v1/devices/register` with `{ pushToken, platform }`.
  - Stores `{ deviceId, pushToken, platform }` in SecureStore via `useNotificationsStore`.
- On opt-out:
  - Calls backend `DELETE /v1/devices/{id}` (best effort) and clears local SecureStore state.

Key files:
- UI: `apps/mobile/src/screens/AlertsScreen.tsx`
- Token + permission helpers: `apps/mobile/src/notifications/push.ts`
- Persisted state: `apps/mobile/src/notifications/notificationsStore.ts`
- API calls: `apps/mobile/src/api/client.ts`
- Backend endpoints: `apps/backend/src/routes/devices.ts`

How to verify quickly:
1) Run API + worker + mobile (see Section 4).
2) On the phone, open `Alerts` tab -> toggle `Push` on.
3) Check DB: a row should exist in `Device` (`apps/backend/prisma/schema.prisma` -> model `Device`).
4) Toggle `Push` off -> device should be deleted (or at least local state cleared; backend delete is best effort).

What is NOT done yet (important):
- There is no actual alert delivery yet. The worker currently creates `AlertEvent` rows (MVP: `news_spike`) but does not send push/email.
- `AlertEvent.deliveredAt` is never set today (it is ready in DB + API response schema).
- Standalone push config (FCM/APNS, EAS credentials) is not set up yet. Current flow is aimed at local dev + Expo Go.

## 6) Next steps (prioritized)

Priority A (retention + trust):
1) Backend push delivery for alerts:
   - Add a worker job to deliver undelivered `AlertEvent`s to all user `Device`s.
   - Use Expo push tokens first (simplest path) and mark `AlertEvent.deliveredAt` when sent.
   - Handle invalid tokens (cleanup `Device`) and retries/DLQ (align with existing BullMQ patterns in `apps/backend/src/worker.ts`).
2) Disconnect SnapTrade (privacy/trust):
   - Task: `SEC-010` in `docs/TODO_SECURITY_QA_OBS.md`
   - Backend endpoint to disconnect + purge tokens + stop sync.
   - Mobile UI/action (likely `FE-110` ConnectionsScreen) to expose it.

Priority B (exports quality):
3) Fix "prepare my year" realized PnL export (year slicing from transactions), starting from `apps/backend/src/exports/csv.ts`.

Priority C (monetization path):
4) RevenueCat entitlements + gates:
   - Backend: `BE-110..111` in `docs/TODO_BACKEND.md`
   - Mobile: `FE-100..101` in `docs/TODO_MOBILE.md`

Mobile cleanup (UX/trust):
5) Finish Settings/Connections/robust error states:
   - `FE-110..112` in `docs/TODO_MOBILE.md`

## 7) Guardrails (do not break these)

- One task at a time; keep TODO docs as the source of truth.
- OpenAPI-first: any backend contract change requires `npm run api:generate` and committing regenerated files.
- Never commit secrets:
  - `.keys/` is gitignored; keep secrets there and/or in `.env` (also ignored).

## 8) Known limitations / tech debt (be honest)

- Alerts: only creates events (MVP: `news_spike`); no push/email delivery yet.
- Exports: `pnl_realized_by_ticker` is currently totals (not year-sliced); year slicing is still needed for true "tax year" exports.
- Mobile exports shares the signed URL; it does not download the CSV file to disk yet.
- Ask screen is placeholder; no backend "ask" endpoint exists yet.
- Some mojibake exists in console output / strings; prefer ASCII in new patches unless you are sure your editor/output is UTF-8 consistent.

## 9) Quick validation commands

- Backend tests: `npm --workspace apps/backend test`
- Mobile typecheck: `cd apps/mobile; npx tsc --noEmit`
- Contract drift check (if you touched API): `npm run api:check`
