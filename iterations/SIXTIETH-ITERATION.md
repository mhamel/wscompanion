# SIXTIETH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make local dev workflows predictable and fast for contributors (especially when DB state gets messy).

Iteration goal: add a clear “reset local DB” workflow (script + VS Code task) and document it.

## 1) What changed

### Backend: db reset script

- `apps/backend/package.json`
  - Adds `db:reset`: `prisma migrate reset --force`

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds `Backend: DB reset (DANGEROUS)` which runs `npm --workspace apps/backend run db:reset`.

### Docs

- `docs/BACKEND_DEV.md`
  - Documents the reset flow and warns that it deletes local data.

## 2) How to use

When your local DB is broken / you want a clean slate:
- VS Code: `Run Task...` -> `Backend: DB reset (DANGEROUS)`
- Then: `Backend: Setup DB (generate + migrate)` (if needed) and restart backend tasks.

## 3) Notes

- This is meant for local/dev only. Do NOT use against shared/staging/prod DBs.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

