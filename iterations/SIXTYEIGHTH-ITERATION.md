# SIXTYEIGHTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): keep dev workflows reliable even when caches exist (so “seed data” shows up immediately in the mobile UI).

Iteration goal: harden the backend dev seed script so it loads env config and invalidates PnL Redis cache keys automatically.

## 1) What changed

### Backend seed script improvements

- `apps/backend/src/scripts/seedDevData.ts`
  - Loads `.env` via `dotenv/config` (consistent with other scripts).
  - By default, if `REDIS_URL` is set, it connects to Redis and calls `bumpPnlCacheVersion(...)` for the user/baseCurrency so PnL caches are invalidated immediately.
  - Adds a flag `--noBumpCache` to disable Redis cache invalidation.

### Docs

- `docs/BACKEND_DEV.md`
  - Mentions that the seed workflow bumps Redis PnL cache version (and how to disable it).

## 2) How to use

Typical usage (same as before, now safer with caches):
- `npm --workspace apps/backend run seed:dev -- --email demo@justlovethestocks.local --reset`

If you don’t want Redis cache invalidation:
- `npm --workspace apps/backend run seed:dev -- --email demo@justlovethestocks.local --reset --noBumpCache`

## 3) Notes / gotchas

- Redis bump is “best effort”: if Redis is down, the seed still succeeds and just prints `failed` for the bump step.

## 4) Next steps (suggested)

- Improve Android emulator tasks by adding a “start first available AVD” task (no prompt needed).

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

