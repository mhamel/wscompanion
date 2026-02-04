# NINETYTHIRD ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make “first target = iOS physical device” practical from Windows by automating the network/baseUrl setup.

Iteration goal: add VS Code tasks that bootstrap a fully-unlocked stack + dashboards, while setting `EXPO_PUBLIC_API_BASE_URL` to a LAN-reachable URL for iPhone.

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds:
    - `Dev: iOS device (LAN IP first + Full stack pro+disclaimer + Dashboards)`
    - `Dev: iOS device (LAN prompt + Full stack pro+disclaimer + Dashboards)`

These tasks do (sequence):
- env bootstrap → show LAN IPs → set mobile baseUrl (LAN-first or prompt) → start the full stack (seed+unlock+dashboards)

### Docs

- `docs/MOBILE_DEV.md`
  - Documents the new “one task” iOS device flow (scan QR in Expo Go).

## 2) How to use

- VS Code: `Dev: iOS device (LAN IP first + Full stack pro+disclaimer + Dashboards)`
- When prompted, enter your email (seed).
- On iPhone: open Expo Go and scan the QR code printed by Metro.

## 3) Notes / gotchas

- iPhone must be on the same Wi‑Fi as your PC (unless you use tunnel mode).
- Windows Firewall may block port 3000; allow inbound if needed.

## 4) Next steps (suggested)

- Add infra logs/status tasks in VS Code to debug docker-compose issues faster.

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

