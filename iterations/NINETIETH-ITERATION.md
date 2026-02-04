# NINETIETH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): reduce friction when switching between emulator/device networking setups.

Iteration goal: make updating `apps/mobile/.env` (`EXPO_PUBLIC_API_BASE_URL`) a one-click VS Code action (no manual editing).

## 1) What changed

### Script: set mobile API base URL

- `scripts/dev/set-mobile-api-baseurl.ps1`
  - Updates `apps/mobile/.env` by setting (or adding) `EXPO_PUBLIC_API_BASE_URL=<url>`.
  - Supports presets:
    - `localhost`
    - `android` (10.0.2.2)
    - `lan-first` (first detected LAN IPv4)
  - Prints the chosen value and reminds you to restart Metro.

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds:
    - `Dev: Set Mobile API baseUrl (prompt)`
    - `Dev: Set Mobile API baseUrl (localhost)`
    - `Dev: Set Mobile API baseUrl (Android emulator 10.0.2.2)`
    - `Dev: Set Mobile API baseUrl (LAN IP first)`
  - Adds `inputs.mobileApiBaseUrl` used by the prompt task.

### Docs

- `docs/MOBILE_DEV.md`
  - Documents the new tasks and ties them to the emulator/device baseUrl recommendations.

## 2) How to use

Typical flows:
- Android emulator:
  - `Dev: Set Mobile API baseUrl (Android emulator 10.0.2.2)`
- iPhone / physical device (same Wi‑Fi):
  - `Dev: Show LAN IP (for iOS device)` then `Dev: Set Mobile API baseUrl (LAN IP first)` (or use prompt)
- Custom:
  - `Dev: Set Mobile API baseUrl (prompt)`

After changing `.env`, restart Metro.

## 3) Notes / gotchas

- `apps/mobile/.env` is gitignored; this change is local-only.
- `LAN IP first` picks the first detected IPv4; if you have multiple NICs, prefer the prompt task.

## 4) Next steps (suggested)

- Improve `Dev Doctor` to display the current `EXPO_PUBLIC_API_BASE_URL` value and warn about common mistakes.

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

