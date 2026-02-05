# NINETYSEVENTH ITERATION (Knowledge Transfer)

Owner: Backend/Platform (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): keep the app fast and reliable by default (sane cache headers, stable pagination, and queue hygiene) so onboarding and day-to-day dev stays smooth.

Iteration goal: deliver the most impactful parts of the remaining backend NFR gap (BE-132 + a reliability slice of BE-133): HTTP cache defaults, BullMQ job retention hygiene, and a small performance fix in `/v1/sync/status`.

## 1) What changed

### Backend: default HTTP cache headers

- `apps/backend/src/server.ts`
  - Adds a global `onSend` hook that sets safe default cache headers.
  - Behavior:
    - For `GET /v1/*` read endpoints: `Cache-Control: private, max-age=30` and `Vary: Authorization`.
    - For sensitive/diagnostic endpoints: `Cache-Control: no-store`.
      - Includes: `/v1/version`, `/v1/health`, `/v1/ready`, `/v1/me`, `/v1/auth/*`, `/v1/billing/*`, `/v1/disclaimer*`, `/v1/exports/:id/download`.

### Worker: BullMQ job retention hygiene

- `apps/backend/src/worker.ts`
  - Adds `defaultJobOptions` on all queues to prevent Redis from growing indefinitely with completed/failed jobs.
  - Defaults:
    - `removeOnComplete: { count: 500 }`
    - `removeOnFail: { count: 2000 }`

### API perf: `/v1/sync/status` N+1 removed

- `apps/backend/src/routes/sync.ts`
  - Replaces the previous per-connection query loop with a single Postgres query to fetch the latest `SyncRun` per `brokerConnectionId`.
  - Uses `SELECT DISTINCT ON ("brokerConnectionId") ... ORDER BY createdAt DESC` via `prisma.$queryRaw`.

### Tests

- `apps/backend/src/server.test.ts`
  - Adds coverage for the cache header behavior:
    - `/v1/version` returns `Cache-Control: no-store`.
    - A generic `/v1/test-cache` route returns `Cache-Control: private, max-age=30` and `Vary: Authorization`.

### Docs/backlog

- `docs/TODO_BACKEND.md`
  - Keeps `BE-132` open but notes partial delivery.

## 2) How to test

### Backend unit tests

- `npm --workspace apps/backend test`

### Manual sanity

- Start backend normally, then probe:
  - `GET /v1/version` should include `Cache-Control: no-store`
  - `GET /v1/tickers` (or most GET `/v1/*` reads) should include `Cache-Control: private, max-age=30`

## 3) Notes / gotchas

- Cache headers are intentionally conservative.
  - `private` ensures shared proxies won’t cache user data.
  - Short TTL reduces backend load while keeping UI fresh.
- We did not add ETags yet (possible future enhancement).
- BullMQ retention defaults are meant for dev/staging too; if you need longer retention for debugging, adjust counts in `worker.ts`.

## 4) Next steps (suggested)

- Finish `BE-133` properly:
  - add an incident/playbook doc (what to check when queues stall / Redis grows / DLQ fills)
  - consider adding metrics/alerts for DLQ size
- Consider adding optional `ETag` to the heaviest `GET` endpoints (`/v1/transactions`, `/v1/tickers/:symbol/news`).

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)
