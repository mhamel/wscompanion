# NINETYSECOND ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make “Android emulator on Windows” a single, reliable workflow that also unlocks gated features for local testing.

Iteration goal: add composite VS Code tasks that fully bootstrap and run the stack on Android emulator (including setting the right API baseUrl, seeding, unlocking Pro + disclaimer, and opening dashboards).

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds building blocks:
    - `Dev: Bootstrap DB + Seed Prompt pro+disclaimer (Infra + Prisma + Seed)`
    - `Dev: Run stack (Backend + Android)`
  - Adds end-to-end tasks:
    - `Dev: Android emulator (Bootstrap + Seed Prompt pro+disclaimer + Run)`
    - `Dev: Android emulator (Full + Dashboards)`

These tasks compose:
- env bootstrap, mobile API baseUrl preset (10.0.2.2), emulator start, DB bootstrap, seed+unlock, backend API/worker, Expo Android, and dashboards.

### Docs

- `docs/MOBILE_DEV.md`
  - Mentions the new one-task Android emulator flow.

## 2) How to use

- VS Code: `Dev: Android emulator (Full + Dashboards)`
  - You will be prompted for `seedEmail` when seeding runs.

## 3) Notes / gotchas

- This starts long-running watchers (API/worker/Expo). Stop tasks when you’re done.
- If you have multiple AVDs, `Android: Start Emulator (first AVD)` uses the first in the emulator list.

## 4) Next steps (suggested)

- Add a similar “iOS device” flow that sets baseUrl to LAN IP (prompt) and starts Metro only (since iOS can’t be launched from Windows).

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

