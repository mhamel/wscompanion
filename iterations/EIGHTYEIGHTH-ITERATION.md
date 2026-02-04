# EIGHTYEIGHTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): remove repetitive onboarding steps and keep the “fresh clone → running app” flow fast.

Iteration goal: add a safe env bootstrap helper to create missing `.env` files from `.env.example`.

## 1) What changed

### Env bootstrap script

- `scripts/dev/bootstrap-env.ps1`
  - Copies:
    - `apps/backend/.env.example` → `apps/backend/.env` (if missing)
    - `apps/mobile/.env.example` → `apps/mobile/.env` (if missing)
  - Supports `-Force` to overwrite existing `.env` files.

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds `Dev: Bootstrap env (.env from .env.example)` to run the script.

### Docs

- `docs/BACKEND_DEV.md` and `docs/MOBILE_DEV.md`
  - Mention the new bootstrap env task as an alternative to manual copying.

## 2) How to use

- VS Code: `Run Task...` -> `Dev: Bootstrap env (.env from .env.example)`

Then customize:
- `apps/backend/.env`
- `apps/mobile/.env`

## 3) Notes / gotchas

- `.env` files are ignored by git; this task won’t dirty the repo with tracked secrets.
- Use `-Force` only if you really want to overwrite local changes.

## 4) Next steps (suggested)

- Add a “Fresh clone (Bootstrap env + DB + seed + run)” task that chains env bootstrap with the existing DB/bootstrap tasks (optional).

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

