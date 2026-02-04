# FORTY-SECOND ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make the repo easy to run locally (infra + backend + mobile) with minimal tribal knowledge.

Iteration goal: improve onboarding by adding VS Code tasks for infra/backend and updating docs to reference them.

## 1) What changed

### VS Code tasks (infra + backend + API client generation)

- `.vscode/tasks.json`
  - Adds tasks:
    - `Infra: Up (docker compose)`
    - `Infra: Down (docker compose)`
    - `Backend: API (dev)`
    - `Backend: Worker (dev)`
    - `API: Generate mobile client (OpenAPI)`

### Docs

- `docs/MOBILE_DEV.md`
  - References the new tasks in the Backend section.
  - Mentions cache-busting tasks for Metro/Android when needed.

## 2) How to use

In VS Code: `Terminal` -> `Run Task...`

Suggested flow:
1) `Infra: Up (docker compose)`
2) `Backend: API (dev)` (and optionally `Backend: Worker (dev)`)
3) `Mobile: Metro (Expo)` or `Mobile: Android (Expo)`

If you change backend OpenAPI and need to refresh mobile types:
- Run `API: Generate mobile client (OpenAPI)`

## 3) Notes

- The infra tasks assume Docker is installed and the daemon is running.
- `Backend: Worker (dev)` is required for scheduled jobs (alerts/news/maintenance pruning).

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

