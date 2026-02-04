# SIXTYSECOND ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): keep local dev fast and realistic — the mobile UI should have meaningful data quickly on a fresh DB.

Iteration goal: add a **dev seeding** workflow to populate PnL totals + PnL daily timeline + a few news items for a chosen user (by email).

## 1) What changed

### Backend: dev seed script

- `apps/backend/src/scripts/seedDevData.ts`
  - New script that:
    - Upserts a user by `--email`
    - Upserts `UserPreferences.baseCurrency`
    - Seeds `TickerPnlTotal` + `TickerPnlDaily` (default: 60 days) for a list of symbols
    - Seeds a few `NewsItem` + `NewsItemSymbol` rows (provider = `seed`)
  - Supports `--reset` to delete existing PnL rows for those symbols before re-seeding.

- `apps/backend/package.json`
  - Adds `seed:dev`: `tsx src/scripts/seedDevData.ts`

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds `Backend: Seed dev data (demo user)` which runs:
    - `npm --workspace apps/backend run seed:dev -- --email demo@justlovethestocks.local --reset`

### Docs

- `docs/BACKEND_DEV.md`
  - Documents the seed workflow (CLI + task).

## 2) How to use

Typical “fresh DB” flow:
1. `Infra: Up (docker compose)`
2. `Backend: Setup DB (generate + migrate)`
3. `Backend: Seed dev data (demo user)`
4. Start API + worker and open the mobile app.

CLI examples:
- `npm --workspace apps/backend run seed:dev -- --email demo@justlovethestocks.local --reset`
- `npm --workspace apps/backend run seed:dev -- --email you@domain.tld --days 90 --symbols AAPL,TSLA,NVDA --reset`

## 3) Notes / gotchas

- `TickerPnlTotal` / `TickerPnlDaily` use **minor units** (e.g., cents). The seed values are synthetic and intended for UI validation only.
- News items are **synthetic** and use URLs under `example.com` so the `urlHash` is deterministic.

## 4) Next steps (suggested)

- Improve mobile dev UX by adding “baseUrl presets” buttons (Android emulator `10.0.2.2`, localhost, etc.) to avoid typing.

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

