# FORTY-SEVENTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): reduce friction to “start the whole system” (infra + backend + mobile) for contributors and testers.

Iteration goal: add compound VS Code tasks to launch the stack in one action.

## 1) What changed

### VS Code Tasks: one-click start

- `.vscode/tasks.json`
  - Adds compound tasks (dependsOn):
    - `Dev: Backend (API + Worker)` (starts both watchers in parallel)
    - `Dev: Full stack (Infra + Backend + Mobile)` (starts infra + backend + Metro in parallel)

### Docs

- `docs/MOBILE_DEV.md`
  - Mentions the full-stack task as a shortcut.
- `README.md`
  - Adds a quick tip pointing to the full-stack task.

## 2) How to use

VS Code: `Terminal` -> `Run Task...` -> `Dev: Full stack (Infra + Backend + Mobile)`

Notes:
- The task will keep running because `Backend: API (dev)`, `Backend: Worker (dev)` and `Mobile: Metro (Expo)` are long-running.
- If Docker isn’t running, infra startup will fail (expected) — start Docker Desktop first.

## 3) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

