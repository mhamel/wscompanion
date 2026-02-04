# FIFTIETH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): iOS-first delivery, but with realistic dev/testing (native modules, dev client) and minimal onboarding friction.

Iteration goal: improve the EAS/iOS dev build workflow documentation and VS Code tasks so new contributors can get to a device build faster.

## 1) What changed

### VS Code Tasks (EAS)

- `.vscode/tasks.json`
  - Adds:
    - `Mobile: EAS login`
    - `Mobile: EAS whoami`
    - `Mobile: EAS build Android (development)`
  - Keeps existing tasks:
    - `Mobile: Metro (Dev Client)`
    - `Mobile: EAS init`
    - `Mobile: EAS build iOS (development)`

### Docs

- `docs/EAS_DEV_BUILD.md`
  - Now references the VS Code tasks for EAS login and Metro dev client.
  - Adds a section explaining how to set the API base URL on iPhone via the in-app Dev settings (no rebuild needed).
- `docs/MOBILE_DEV.md`
  - Mentions the in-app override path: `Paramètres` -> `Dev` -> `Override API baseUrl`.

## 2) Validation

- `.vscode/tasks.json` parses as valid JSON.
- `npx tsc -p apps/mobile/tsconfig.json --noEmit`

## 3) Next steps

- Once bundle IDs and signing are finalized, add a `preview` and/or `production` EAS profile guide for TestFlight.
- Optionally add a short “EAS setup checklist” for Apple Developer account requirements.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

