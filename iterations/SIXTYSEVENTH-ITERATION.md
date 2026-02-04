# SIXTYSEVENTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make onboarding and day-to-day local dev “one-click” in VS Code, including the common “DB got messy” recovery path.

Iteration goal: add repeatable **reset + seed + run** workflows and make seeding work for non-demo users.

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds `Backend: Seed dev data (prompt email)` (prompts for `seedEmail`, runs seed script with `--reset`).
  - Adds:
    - `Dev: Reset DB (DANGEROUS) + Run`
    - `Dev: Reset DB (DANGEROUS) + Seed + Run`
  - Adds a new `inputs` entry:
    - `seedEmail` (default: `demo@justlovethestocks.local`)

### Docs

- `docs/MOBILE_DEV.md`
  - Mentions the reset + seed task for when the local DB is broken.
- `docs/BACKEND_DEV.md`
  - Documents the prompt-based seed task and the new reset/seed shortcuts.

## 2) How to use

Most common recovery flows:
- “My local DB is broken / I want a clean slate”:
  - VS Code: `Dev: Reset DB (DANGEROUS) + Seed + Run`
- “Seed my own email (OTP login user)”:
  - VS Code: `Backend: Seed dev data (prompt email)`

## 3) Notes / gotchas

- `DB reset` is destructive and intended for **local dev only**.
- If you run reset/seed while API is already running, you may want to refresh the mobile app (or use the in-app dev reset/local state tool).

## 4) Next steps (suggested)

- Improve the backend seed script to always load `.env` reliably and optionally bump Redis cache version keys so the mobile UI reflects seed changes immediately.

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

