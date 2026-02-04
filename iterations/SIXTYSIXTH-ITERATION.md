# SIXTYSIXTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make “fresh clone → running app” a predictable one-click workflow.

Iteration goal: add a VS Code task that bootstraps infra + DB, **seeds dev data**, then runs the stack.

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds `Dev: Fresh clone (Bootstrap + Seed + Run)` which runs, in sequence:
    1) `Dev: Bootstrap DB (Infra + Prisma)`
    2) `Backend: Seed dev data (demo user)`
    3) `Dev: Run stack (Backend + Mobile)`

### Docs

- `docs/MOBILE_DEV.md`
  - Mentions the new “Bootstrap + Seed + Run” task for first-time setup (prevents an empty UI on a fresh DB).

## 2) How to use

- VS Code: `Run Task...` -> `Dev: Fresh clone (Bootstrap + Seed + Run)`

This should get you to a running stack with sample PnL + news.

## 3) Next steps (suggested)

- Add an equivalent “Reset DB + Seed + Run” task (for when local state is corrupted).
- Consider making the seed email configurable via an input prompt (like the Android AVD prompt).

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

