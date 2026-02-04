# SEVENTYFIRST ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make local dev steps composable in VS Code (bootstrap infra/DB, seed data, then optionally run watchers).

Iteration goal: add “setup + seed” tasks so contributors can quickly get realistic data without necessarily launching the full stack immediately.

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds `Backend: Setup DB + Seed (demo user)` (generate+migrate then seed).
  - Adds `Dev: Bootstrap DB + Seed (Infra + Prisma + Seed)` (infra up + DB setup + seed).

### Docs

- `docs/BACKEND_DEV.md`
  - Mentions the new setup+seed shortcuts.
- `docs/MOBILE_DEV.md`
  - Mentions the “bootstrap DB + seed” task as an alternative to full stack startup.

## 2) How to use

- If you want a seeded DB but don’t want watchers yet:
  - VS Code: `Dev: Bootstrap DB + Seed (Infra + Prisma + Seed)`
- If infra is already up:
  - VS Code: `Backend: Setup DB + Seed (demo user)`

## 3) Next steps (suggested)

- Improve mobile diagnostics output to include details when a check fails (status + short JSON snippet).

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

