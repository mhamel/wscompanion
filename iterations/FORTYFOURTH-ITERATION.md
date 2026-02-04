# FORTY-FOURTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make local dev smooth (infra + backend + mobile) with minimal setup steps and fewer “how do I…” questions.

Iteration goal: expand VS Code Tasks to cover backend DB setup + OpenAPI checks, and update docs accordingly.

## 1) What changed

### VS Code Tasks (backend DB + OpenAPI)

- `.vscode/tasks.json`
  - Adds backend DB tasks:
    - `Backend: Prisma generate`
    - `Backend: DB migrate (dev)`
    - `Backend: Setup DB (generate + migrate)` (dependsOn, sequential)
  - Adds OpenAPI verification task:
    - `API: Check OpenAPI is up-to-date` (runs `npm run api:check`)

### Docs

- `docs/MOBILE_DEV.md`
  - Backend setup section now references the new tasks (generate/migrate + shortcut task).

## 2) How to use

In VS Code: `Terminal` -> `Run Task...`

Suggested flow (fresh clone):
1) `Infra: Up (docker compose)`
2) `Backend: Setup DB (generate + migrate)`
3) `Backend: API (dev)` (and optionally `Backend: Worker (dev)`)
4) `Mobile: Metro (Expo)` / `Mobile: Android (Expo)`

When editing backend routes/schemas:
- Run `API: Check OpenAPI is up-to-date` before committing to ensure the generated mobile schema is in sync.

## 3) Notes

- The DB tasks assume `apps/backend/.env` exists with a valid `DATABASE_URL`.
- If Docker is not running, `db:migrate` will fail (expected). Start infra first.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

