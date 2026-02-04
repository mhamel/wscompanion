# SIXTYNINTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): reduce dev friction — especially around “starting the Android emulator” in VS Code.

Iteration goal: make Android emulator startup usable without knowing an AVD name upfront.

## 1) What changed

### Android emulator script: optional AVD name

- `scripts/android/start-emulator.ps1`
  - `-AvdName` is now optional:
    - If missing/empty, it starts the **first** AVD returned by `emulator.exe -list-avds`.
    - If provided, it validates that the AVD exists (and prints available AVDs if not).

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds:
    - `Android: Start Emulator (first AVD)`
    - `Mobile: Android (Start First Emulator + Expo)`

### Docs

- `docs/MOBILE_DEV.md`
  - Documents the new “first AVD” tasks.

## 2) How to use

- Fast path (no prompt):
  - VS Code: `Mobile: Android (Start First Emulator + Expo)`

- If you want a specific AVD:
  1) `Android: List AVDs`
  2) `Android: Start Emulator (prompt AVD)`

## 3) Notes / gotchas

- If you have multiple AVDs, “first AVD” depends on the order returned by `-list-avds`.
- If Expo starts before the emulator fully boots, rerun `Mobile: Android (Expo)` once the device is ready.

## 4) Next steps (suggested)

- Refresh README quickstart to mention the best VS Code “fresh clone” and “reset+seed” tasks.

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

