# EIGHTYNINTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make the “new dev machine → productive” path one-task, and make recovery (reset DB) equally streamlined.

Iteration goal: add onboarding + reset+dashboards composite tasks to reduce manual steps and context switching.

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds:
    - `Dev: Reset DB (DANGEROUS) + Seed Prompt + Dashboards`
    - `Dev: Reset DB (DANGEROUS) + Seed Prompt pro+disclaimer + Dashboards`
    - `Dev: Onboarding (Env + Full stack pro+disclaimer + Dashboards)`
    - `Dev: Onboarding (Doctor + Env + Full stack pro+disclaimer + Dashboards)`

These tasks compose existing building blocks:
- doctor (preflight), env bootstrap, DB bootstrap/reset, seed (prompt email), unlock (pro+disclaimer), run stack, open dashboards.

### Docs

- `docs/MOBILE_DEV.md` and `docs/BACKEND_DEV.md`
  - Mention the new onboarding and reset+dashboards shortcuts.

## 2) How to use

- Best “first time” workflow:
  - VS Code: `Dev: Onboarding (Doctor + Env + Full stack pro+disclaimer + Dashboards)`

- Best “DB is broken” workflow:
  - VS Code: `Dev: Reset DB (DANGEROUS) + Seed Prompt pro+disclaimer + Dashboards`

## 3) Notes / gotchas

- Onboarding tasks will start long-running watchers (API/worker/Metro). Stop tasks when you’re done.
- Reset tasks are destructive and intended for local dev only.

## 4) Next steps (suggested)

- Add a helper to update `apps/mobile/.env` API baseUrl quickly from VS Code (preset localhost / 10.0.2.2 / LAN IP).

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

