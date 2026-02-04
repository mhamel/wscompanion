# EIGHTYFIRST ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make it easy to run the mobile app on a physical device even when networking is annoying (Wi‑Fi isolation, VPN, etc.).

Iteration goal: add Expo “tunnel” tasks in VS Code for Metro + Android/iOS launch.

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds:
    - `Mobile: Metro (Expo, Tunnel)`
    - `Mobile: Android (Expo, Tunnel)`
    - `Mobile: iOS (Expo, Tunnel)`

### Docs

- `docs/MOBILE_DEV.md`
  - Mentions the tunnel option for cases where the phone is not on the same LAN.

## 2) How to use

- VS Code: `Mobile: Metro (Expo, Tunnel)` then scan the QR code with Expo Go.

Notes:
- Tunnel can be slower than LAN mode.
- If LAN mode works (same Wi‑Fi), prefer it.

## 3) Next steps (suggested)

- Add a VS Code task to open backend Swagger UI (`/docs`) to speed up API exploration.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

