# SIXTYFOURTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): reduce onboarding friction and make “run the app” a one-click flow in VS Code.

Iteration goal: add VS Code tasks to **list** and **start** an Android emulator (AVD) on Windows, then optionally launch the Expo Android flow.

## 1) What changed

### Android emulator helper scripts (PowerShell)

- `scripts/android/list-avds.ps1`
  - Finds Android SDK via `ANDROID_SDK_ROOT` / `ANDROID_HOME` / default `LOCALAPPDATA\\Android\\Sdk`
  - Prints available AVD names via `emulator.exe -list-avds`

- `scripts/android/start-emulator.ps1`
  - Starts an emulator by AVD name (detached via `Start-Process`)
  - Validates that the AVD exists and prints the PID

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds:
    - `Android: List AVDs`
    - `Android: Start Emulator (prompt AVD)` (prompts for the AVD name)
    - `Mobile: Android (Start Emulator + Expo)` (starts emulator then runs Expo Android task)
  - Adds an `inputs` prompt `androidAvdName` used by the start task.

### Docs

- `docs/MOBILE_DEV.md`
  - Documents the new Android emulator tasks under the Android emulator section.

## 2) How to use

1) VS Code: `Run Task...` -> `Android: List AVDs` (note the exact name)
2) VS Code: `Run Task...` -> `Android: Start Emulator (prompt AVD)` (paste the name)
3) VS Code: `Run Task...` -> `Mobile: Android (Expo)` (or use `Mobile: Android (Start Emulator + Expo)`)

If the tasks can’t find your SDK, set `ANDROID_SDK_ROOT` in your environment.

## 3) Notes / gotchas

- The emulator start task is “best effort”: it starts the process and returns; boot may take a bit.
- If `Mobile: Android (Start Emulator + Expo)` runs before the emulator is fully booted, just rerun `Mobile: Android (Expo)` once the emulator is ready.

## 4) Next steps (suggested)

- Make the Android AVD prompt default smarter (e.g., default to the first AVD returned by `-list-avds`).
- Add a task to open Android Studio’s Device Manager as a fallback.

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

