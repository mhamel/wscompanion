# FIFTY-FIRST ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): reduce onboarding friction so a fresh clone can be started with minimal manual steps.

Iteration goal: add VS Code tasks that support a “fresh clone bootstrap” flow (infra up + prisma migrate, then run watchers).

## 1) What changed

### VS Code Tasks: bootstrap + run split

- `.vscode/tasks.json`
  - Adds:
    - `Dev: Bootstrap DB (Infra + Prisma)` (sequence):
      - `Infra: Up (docker compose)`
      - `Backend: Setup DB (generate + migrate)`
    - `Dev: Run stack (Backend + Mobile)` (parallel):
      - `Backend: API (dev)`
      - `Backend: Worker (dev)`
      - `Mobile: Metro (Expo)`
    - `Dev: Fresh clone (Bootstrap + Run)` (sequence):
      - `Dev: Bootstrap DB (Infra + Prisma)`
      - `Dev: Run stack (Backend + Mobile)`

### Docs

- `docs/MOBILE_DEV.md`
  - Mentions the new “fresh clone” task as the recommended first-time setup.

## 2) How to use

In VS Code: `Run Task...` -> `Dev: Fresh clone (Bootstrap + Run)`

Notes:
- The “Run stack” portion is long-running (watchers); VS Code will keep the tasks alive.
- If Docker isn’t running, bootstrap will fail (expected).

## 3) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

