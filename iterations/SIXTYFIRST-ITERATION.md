# SIXTYFIRST ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make local dev workflows predictable and fast for contributors (especially for device connectivity + API debugging).

Iteration goal: make it trivial to confirm what backend build you’re talking to (local vs remote) via `/v1/version`, from both VS Code and the mobile app.

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds `Backend: Check /v1/version` (hits `http://localhost:3000/v1/version`).

### Mobile: Dev diagnostics

- `apps/mobile/src/screens/SettingsScreen.tsx`
  - Adds buttons to **test** and **open** `/v1/version` using the effective API base URL.

### Docs

- `docs/BACKEND_DEV.md`
  - Documents the `/v1/version` endpoint and the new VS Code task.

## 2) How to use

- VS Code: `Run Task...` -> `Backend: Check /v1/version`
- Mobile: Settings -> (dev section) -> `Tester /v1/version` or `Ouvrir /v1/version`

Expected: JSON `{ ok: true, nodeEnv, gitSha?, release? }`.

## 3) Why it matters

This reduces “it works on my machine” debugging time by making it explicit **which backend instance** the app is hitting (and with what build metadata).

## 4) Next steps (suggested)

- Add a backend dev seeding script to quickly populate PnL + news for the demo user (so the mobile UI isn’t empty on fresh DBs).

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

